import { appState } from '../state.js';
import { SENSORS_CATALOG } from '../data/sensors.js';
import { ACTUATORS_CATALOG } from '../data/actuators.js';
import { TASKS_CATALOG } from '../data/tasks.js';
import { sound } from './audio.js';

const orders = {};
const slots = { sensor: Array(11).fill(null), actuator: Array(10).fill(null) };
const sensorCardDescriptions = {
  SENSE_04: 'Measures obstacle distance in front, back, left and right. It does not identify the obstacle.',
  SENSE_07: 'Provides position, heading and an automatically recorded local map. Unknown areas remain unknown; it never chooses a route.',
  SENSE_15: 'Reports the type and location of tagged cups, food, and trash in its forward view. It does not detect the cat, floor dirt, or spills.'
};
function randomized(catalog, kind) {
  if (!orders[kind]) {
    orders[kind] = [...catalog];
    for (let i = orders[kind].length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orders[kind][i], orders[kind][j]] = [orders[kind][j], orders[kind][i]];
    }
  }
  return orders[kind];
}
export function moduleCard(item, kind, mounted = false) {
  const description = kind === 'sensor'
    ? sensorCardDescriptions[item.id] ?? item.measures.split(/(?<=[.!?])\s/)[0]
    : item.id === 'ACTUATOR_SPEED_CTRL' ? 'Adjusts how quickly the robotic arm extends.' : item.does.split(/(?<=[.!?])\s/)[0];
  return `<button class="module-card ${mounted ? 'mounted' : ''}" draggable="false" data-module-id="${item.id}" aria-pressed="${mounted}"><span class="module-icon">${item.icon}</span><strong>${item.name}</strong><span>${description}</span></button>`;
}
export function referenceStrip() {
  const tasks = appState.selectedTasks.map(id => TASKS_CATALOG.find(task => task.id === id)).filter(Boolean);
  return `<div class="task-reference-strip" role="group" aria-label="Current task requirements">${tasks.map(task => `<span>${task.icon} ${task.shortName || task.name}</span>`).join('')}</div>`;
}
function renderClickMounting(container, kind) {
  const sameEditor = container.querySelector('.mounting-editor')?.dataset?.kind === kind;
  const scrollTop = sameEditor ? container.querySelector('.mounting-library')?.scrollTop || 0 : 0;
  const sensor = kind === 'sensor', catalog = sensor ? SENSORS_CATALOG : ACTUATORS_CATALOG;
  const installed = sensor ? appState.installedSensors : appState.installedActuators, capacity = sensor ? appState.sensorBudget : 10;
  slots[kind] = slots[kind].map(id => installed.has(id) ? id : null);
  for (const id of installed) if (!slots[kind].includes(id)) slots[kind][slots[kind].indexOf(null)] = id;
  container.innerHTML = `<div class="mounting-editor click-mounting-editor ${kind}-editor" data-kind="${kind}"><h2>${sensor?'Sensor library':'Actuator library'}</h2><p>${sensor?'Click a Sensor to install it. Click it again to remove it.':'Click an Actuator to install it. Click it again to remove it.'}</p>${referenceStrip()}
    <p class="mount-gate" role="status">${sensor?`Stage ${appState.currentStage} budget: `:''}Up to ${capacity} ${sensor?'sensors':'actuators'}. No minimum selection.</p>
    <div class="mounting-library">${randomized(catalog,kind).map(item => moduleCard(item,kind,installed.has(item.id))).join('')}</div>
    <footer class="step-nav-footer"><span class="mount-count">${installed.size} / ${capacity} mounted</span><button class="btn btn-primary mounting-continue" ${installed.size > capacity ? 'disabled' : ''}>Continue</button></footer></div>`;
  const preview = globalThis.document?.getElementById('sensorAssemblyPreview');
  if (preview) { preview.dataset.kind = kind; preview.setAttribute('aria-label',sensor?'Robot sensor preview':'Robot actuator preview'); }
  if (preview) preview.innerHTML = `<h3>Robot preview</h3><div class="sensor-body-preview">
    <svg viewBox="0 0 320 260" aria-hidden="true"><ellipse cx="160" cy="151" rx="145" ry="91" fill="#94a3b8"/><ellipse cx="160" cy="125" rx="145" ry="101" fill="#e2e8f0" stroke="#64748b" stroke-width="3"/><ellipse cx="160" cy="125" rx="134" ry="91" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/><ellipse cx="160" cy="125" rx="29" ry="23" fill="#cbd5e1"/><path d="M77 207 Q160 246 243 207" fill="none" stroke="#475569" stroke-width="9" stroke-linecap="round"/></svg>
    <div class="sensor-body-slots" role="group" aria-label="${sensor?'Sensor slots':'Actuator slots'}">${slots[kind].slice(0,capacity).map((id,index) => {
      const item = catalog.find(sensor => sensor.id === id), angle = index * Math.PI * 2 / capacity - Math.PI / 2;
      return `<button type="button" class="sensor-body-slot ${item?'mounted':''}" data-mount-index="${index}" ${item?`data-attached-${kind}="${id}"`:''} style="left:${50+33*Math.cos(angle)}%;top:${48+29*Math.sin(angle)}%" aria-label="${item?item.name:(sensor?'Empty sensor slot':'Empty actuator slot')}" title="${item?item.name:(sensor?'Empty sensor slot':'Empty actuator slot')}">${item?item.icon:'+'}</button>`;
    }).join('')}</div></div><h4>${sensor?'Installed Sensors':'Installed Actuators'}</h4><div class="installed-sensor-list">${slots[kind].filter(Boolean).map(id => {
      const item = catalog.find(sensor => sensor.id === id);
      return `<button type="button" class="installed-sensor-name" data-remove-${kind}="${id}" title="${item.name}"><span>${item.name}</span><span aria-hidden="true">×</span></button>`;
    }).join('') || (sensor?'<p>No Sensors installed yet.</p>':'<p>No Actuators installed yet.</p>')}</div><button class="btn btn-outline mounting-pov">See what your robot sees</button>`;
  const toggle = id => {
    const result = sensor ? appState.toggleSensor(id) : appState.toggleActuator(id);
    if (!result.success) { container.querySelector('.mount-gate').textContent = result.reason || `Up to ${capacity} mounted. Remove or replace a module.`; return; }
    sound.playSnap();
    renderClickMounting(container,kind);
    container.querySelector(`[data-module-id="${id}"]`)?.focus({preventScroll:true});
  };
  container.querySelectorAll('.module-card').forEach(card => { card.onclick = () => toggle(card.dataset.moduleId); });
  preview?.querySelectorAll(`[data-attached-${kind}]`).forEach(point => { point.onclick = () => toggle(point.getAttribute(`data-attached-${kind}`)); });
  preview?.querySelectorAll(`[data-remove-${kind}]`).forEach(name => { name.onclick = () => toggle(name.getAttribute(`data-remove-${kind}`)); });
  const pov = preview?.querySelector('.mounting-pov');
  if (pov) pov.onclick = () => window.enterRobotPov?.();
  container.querySelector('.mounting-continue').onclick = () => window.navigateStep?.(sensor?4:5);
  const library = container.querySelector('.mounting-library');
  if (library) library.scrollTop = scrollTop;
}
export function renderSensorStep(container) { renderClickMounting(container,'sensor'); }
export function renderActuatorStep(container) { renderClickMounting(container,'actuator'); }
