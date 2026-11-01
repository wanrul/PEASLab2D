import { appState } from '../state.js';
import { SENSORS_CATALOG } from '../data/sensors.js';
import { ACTUATORS_CATALOG } from '../data/actuators.js';
import { TASKS_CATALOG } from '../data/tasks.js';
import { sound } from './audio.js';

const orders = {};
const slots = { sensor: Array(11).fill(null), actuator: Array(10).fill(null) };
const selected = { sensor: null, actuator: null };
const previews = new WeakMap();
const activePreviews = new Set();
appState.on('stepChanged', () => {
  for (const dispose of activePreviews) dispose();
  activePreviews.clear();
});
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
  const description = item.id === 'ACTUATOR_SPEED_CTRL' ? 'Adjusts how quickly the robotic arm extends.' : (kind === 'sensor' ? item.measures : item.does).split(/(?<=[.!?])\s/)[0];
  return `<button class="module-card ${mounted ? 'mounted' : ''}" draggable="true" data-module-id="${item.id}" aria-pressed="${mounted}"><span class="module-icon">${item.icon}</span><strong>${item.name}</strong><span>${description}</span></button>`;
}
export function referenceStrip() {
  return `<div class="task-reference-strip">${TASKS_CATALOG.filter(t => appState.selectedTasks.includes(t.id)).map(t => `<span>${t.icon} ${t.shortName || t.name}</span>`).join('')}</div>`;
}
function renderMounting(container, kind) {
  const sameEditor = container.querySelector('.mounting-editor')?.dataset?.kind === kind;
  const libraryScroll = sameEditor ? container.querySelector('.mounting-library')?.scrollTop || 0 : 0;
  previews.get(container)?.();
  const sensor = kind === 'sensor';
  const catalog = sensor ? SENSORS_CATALOG : ACTUATORS_CATALOG;
  const installed = sensor ? appState.installedSensors : appState.installedActuators;
  const capacity = sensor ? 11 : 10;
  slots[kind] = slots[kind].map(id => installed.has(id) ? id : null);
  for (const id of installed) if (!slots[kind].includes(id)) slots[kind][slots[kind].indexOf(null)] = id;
  container.innerHTML = `<div class="mounting-editor" data-kind="${kind}"><h2>${sensor ? 'Give your robot senses' : 'Give your robot a body'}</h2><p>${sensor ? 'Walk the apartment. Then mount the sensors your robot needs.' : 'Mount the parts your robot needs for the current tasks.'}</p>${referenceStrip()}
    <div class="mounting-layout"><div class="mounting-library">${randomized(catalog, kind).map(item => moduleCard(item, kind, installed.has(item.id))).join('')}</div>
    <div class="mounting-assembly"><div class="assembly-preview" aria-label="${sensor ? 'Robot sensor silhouette' : '3D robot assembly'}">${sensor ? `<div class="sensor-robot-preview"><div class="sensor-silhouette" aria-hidden="true">◉<br>▰<br>▥ ▥</div>${slots.sensor.map((id,index)=>{const item=SENSORS_CATALOG.find(item=>item.id===id);return item?`<span class="attached-sensor" data-attached-sensor="${id}" style="--sensor-x:${index<6?12:68}%;--sensor-y:${12+(index%6)*14}%" title="${item.name}">${item.icon} ${item.shortName||item.name}</span>`:'';}).join('')}</div>` : '<canvas class="assembly-canvas" style="width:100%;height:260px;display:block"></canvas>'}</div>
    <div class="mounting-points">${slots[kind].map((id, index) => {
      const item = catalog.find(m => m.id === id);
      return `<button class="mount-point ${id ? 'mounted' : ''}" data-mount-index="${index}" aria-label="Mounting point ${index + 1}${item ? ': ' + item.name + ', remove or replace' : ': empty'}">${item ? `${item.icon} ${item.shortName || item.name}` : `＋ ${index + 1}`}</button>`;
    }).join('')}</div><p class="mount-count">${installed.size} / ${capacity} mounted</p>
    <p class="mount-gate">Up to ${capacity} ${sensor ? 'sensors' : 'actuators'}. No minimum selection.</p>
    <div class="mounting-actions">${sensor ? '<button class="btn btn-outline mounting-pov">See what your robot sees</button>' : ''}
    <button class="btn btn-primary mounting-continue" ${installed.size <= capacity ? '' : 'disabled'}>Continue</button></div></div></div></div>`;
  const toggle = id => sensor ? appState.toggleSensor(id) : appState.toggleActuator(id);
  const mount = (index, id) => {
    if (!catalog.some(item => item.id === id)) return;
    const old = slots[kind][index];
    if (old === id) return;
    const existingIndex = slots[kind].indexOf(id);
    if (existingIndex >= 0) {
      slots[kind][existingIndex] = old;
      appState.record(sensor ? 'SENSOR_MOUNTED' : 'ACTUATOR_MOUNTED', id, {mountPoint:index,previousPoint:existingIndex,swappedWith:old,installed:[...installed]});
    }
    else if (old) toggle(old);
    slots[kind][index] = id;
    if (!installed.has(id)) toggle(id);
    sound.playSnap();
    selected[kind] = null;
    renderMounting(container, kind);
    if (!sensor) animateAssembly(container, id);
  };
  container.querySelectorAll('.module-card').forEach(card => {
    card.onclick = () => {
      selected[kind] = card.dataset.moduleId;
      container.querySelectorAll('.module-card').forEach(c => c.classList.toggle('selected', c === card));
    };
    card.ondragstart = event => event.dataTransfer.setData('text/plain', card.dataset.moduleId);
  });
  container.querySelectorAll('.mount-point').forEach(point => {
    const index = Number(point.dataset.mountIndex);
    point.onclick = () => {
      if (selected[kind]) mount(index, selected[kind]);
      else if (slots[kind][index]) {
        const id = slots[kind][index];
        slots[kind][index] = null;
        toggle(id);
        sound.playClick();
        renderMounting(container, kind);
      }
    };
    point.ondragover = event => event.preventDefault();
    point.ondrop = event => { event.preventDefault(); mount(index, event.dataTransfer.getData('text/plain')); };
  });
  container.querySelector('.mounting-continue').onclick = () => {
    if (installed.size > capacity) return;
    if (window.navigateStep) window.navigateStep(sensor ? 3 : 4); else appState.setStep(sensor ? 3 : 4);
  };
  const pov = container.querySelector('.mounting-pov');
  if (pov) pov.onclick = () => window.enterRobotPov?.();
  const library=container.querySelector('.mounting-library');
  if(library)library.scrollTop=libraryScroll;
  if (!sensor) animateAssembly(container);
}
export function renderSensorStep(container) { renderMounting(container, 'sensor'); }
export function renderActuatorStep(container) { renderMounting(container, 'actuator'); }

// Keep the demonstration local: it never changes the learner's simulation.
async function animateAssembly(container, activeId = null) {
  previews.get(container)?.();
  let disposed = false;
  let frame;
  let renderer;
  let scene;
  const dispose = () => {
    activePreviews.delete(dispose);
    disposed = true;
    cancelAnimationFrame(frame);
    scene?.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    renderer?.dispose();
  };
  previews.set(container, dispose);
  activePreviews.add(dispose);
  const THREE = await import('../../lib/three/three.module.js');
  if (disposed || !container.isConnected) return;
  const canvas = container.querySelector('.assembly-canvas');
  if (!canvas) return;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch {
    canvas.replaceWith(Object.assign(document.createElement('p'), { textContent: '3D assembly preview is unavailable. Installed modules are labeled at their mounting points below.' }));
    return;
  }
  renderer.setSize(canvas.clientWidth || 360, 260, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, (canvas.clientWidth || 360) / 260, 0.1, 100);
  camera.position.set(3.2, 2.5, 4.8);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x445166, 3));
  const group = new THREE.Group();
  scene.add(group);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1, 0.6, 32), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4 }));
  group.add(body);
  const animated = [];
  const ids = slots.actuator.filter(Boolean);
  ids.forEach((id, index) => {
    const wheel = id.includes('WHEELS') || id.includes('ROTATION');
    const arm = /ARM|GRIP/.test(id);
    const geometry = wheel ? new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16) : new THREE.BoxGeometry(arm ? 0.18 : 0.32, arm ? 0.65 : 0.18, 0.32);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: id === activeId ? 0x38bdf8 : 0x64748b }));
    const angle = index * Math.PI * 2 / 10;
    mesh.position.set(Math.cos(angle) * 0.9, arm ? 0.5 : -0.15, Math.sin(angle) * 0.9);
    if (wheel) mesh.rotation.z = Math.PI / 2;
    group.add(mesh);
    animated.push({ mesh, id, y: mesh.position.y, wheel, arm });
  });
  const start = performance.now();
  const draw = now => {
    if (disposed || !container.isConnected) { previews.get(container)?.(); return; }
    const t = Math.min((now - start) / 1000, 1);
    for (const { mesh, id, y, wheel, arm } of animated) {
      if (id !== activeId) continue;
      const pulse = Math.sin(t * Math.PI);
      if (wheel) mesh.rotation.y = t * Math.PI * 4;
      else if (arm) mesh.scale.y = 1 + pulse * 0.8;
      else mesh.position.y = y - pulse * 0.3;
    }
    renderer.render(scene, camera);
    if (t < 1) frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
}
