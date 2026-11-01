import { appState } from '../state.js';
import { SENSE_BLOCKS, CONDITION_BLOCKS, ACTION_BLOCKS, CONTROL_BLOCKS, DEFAULT_RULE_TEMPLATES, getBlockById } from '../data/blocks.js';
import { sound } from './audio.js';

const shelves = { Sense: SENSE_BLOCKS, Condition: CONDITION_BLOCKS, Action: ACTION_BLOCKS, Control: CONTROL_BLOCKS };
export function acceptsBlock(slot, block) {
  return Boolean(block && (slot === 'secondaryAction' ? 'action' : slot.toLowerCase()) === block.kind.toLowerCase());
}
export class BlockCanvasView {
  constructor(containerElement) {
    this.container = containerElement;
    this.selectedBlockForPlacement = null;
    this.activeShelf = 'Sense';
    this.paletteScroll = {};
    appState.on('rulesChanged', () => {
      this.render();
      if (appState.currentStep === 4 && appState.rules.some(r => r.slots.sense && r.slots.action)) window.startRulePreview?.();
    });
    appState.on('tick', ({ robot }) => this.updateTracePulse(robot?.traceState));
  }
  render() {
    if (!this.container) return;
    this.activeShelf ||= 'Sense';
    this.paletteScroll ||= {};
    const zones = this.container.querySelector('.task-zones-column');
    const list = this.container.querySelector('.palette-list');
    const zoneScroll = zones?.scrollTop || 0;
    if (list?.dataset?.shelf) this.paletteScroll[list.dataset.shelf] = list.scrollTop;
    this.container.innerHTML = `<div class="block-canvas-container">
      <header class="canvas-header"><div><h3>Program your robot</h3><p>For each task, build rules: what it senses, when, what it does.</p></div></header>
      <div class="canvas-workspace"><div class="task-zones-column">${DEFAULT_RULE_TEMPLATES.map((task, i) => this.renderTaskZone(task, i, appState.rules.filter(rule => rule.taskId === task.taskId))).join('')}
      <canvas id="ruleApartmentPreview" width="480" height="360" aria-label="Live rule preview"></canvas><div class="rule-trace" aria-live="polite"><div data-trace="sense">SENSING —</div><div data-trace="decide">DECIDING —</div><div data-trace="act">ACTING —</div></div>
      <p class="rule-attempt-count" hidden></p><button class="btn btn-primary rule-continue" ${appState.rules.some(r => r.slots.sense && r.slots.action) ? '' : 'disabled'}>Continue</button></div>
      <aside class="block-palette-column"><div class="palette-tabs" role="tablist" aria-label="Block library">${Object.keys(shelves).map(kind => `<button role="tab" id="shelf-${kind}" data-shelf="${kind}" aria-selected="${kind===this.activeShelf}" aria-controls="activeBlockShelf">${kind.toUpperCase()}</button>`).join('')}</div><div class="palette-list" id="activeBlockShelf" role="tabpanel" aria-labelledby="shelf-${this.activeShelf}" data-shelf="${this.activeShelf}">${this.renderPaletteBlocks(this.activeShelf)}</div></aside></div></div>`;
    this.attachEvents();
    this.container.querySelector('.task-zones-column').scrollTop=zoneScroll;
    this.container.querySelector('.palette-list').scrollTop=this.paletteScroll[this.activeShelf] || 0;
  }
  renderTaskZone(task, index, rules = [task]) {
    return `<section class="task-zone-card" data-task-id="${task.taskId}"><div class="zone-title-bar"><span class="task-number">${index + 1}</span><span class="task-name">${task.taskName}</span></div>${rules.map((rule, row) => this.renderRuleRow(rule, row, rules.length)).join('')}<button class="btn btn-outline add-rule" data-task-id="${task.taskId}" aria-label="Add rule for ${task.taskName}">Add rule</button></section>`;
  }
  renderRuleRow(rule, row, count) {
    const label = row === 0 ? rule.taskName : `${rule.taskName}, Rule ${row + 1}`;
    return `<div class="rule-row" data-rule-id="${rule.id}"><div class="rule-row-header"><span>Rule ${row + 1}</span><button class="btn btn-outline remove-rule" data-rule-id="${rule.id}" aria-label="Remove Rule ${row + 1} for ${rule.taskName}" ${count === 1 ? 'disabled' : ''}>Remove rule</button></div><div class="four-slot-chain">${['sense', 'condition', 'action', 'control', ...(rule.slots.control === 'CTRL_04' ? ['secondaryAction'] : [])].map(slot => {
      const block = getBlockById(rule.slots[slot]);
      return `<div class="slot-container slot-${slot} ${block ? 'filled' : 'empty'}" tabindex="0" role="button" aria-label="${label}: ${slot}" data-rule-id="${rule.id}" data-slot="${slot}"><span class="slot-label">${slot === 'secondaryAction' ? 'THEN ACTION' : slot.toUpperCase()}${slot === 'control' ? ' (optional)' : ''}</span>${block ? `<div class="block-card kind-${slot}"><span class="block-name">${block.name}</span><button class="clear-slot-btn" aria-label="Remove ${block.name} from ${label}: ${slot}">×</button></div>` : '<span class="empty-placeholder">＋</span>'}</div>`;
    }).join('<span class="slot-arrow">→</span>')}</div></div>`;
  }
  renderPaletteBlocks(kind) {
    return shelves[kind].map(b => `<button draggable="true" class="palette-block-card kind-${b.kind.toLowerCase()} ${this.selectedBlockForPlacement?.id === b.id ? 'selected' : ''}" data-block-id="${b.id}"><span class="card-name">${b.name}</span><span class="card-desc">${b.desc}</span></button>`).join('');
  }
  place(taskIndex, slot, block) {
    if (!acceptsBlock(slot, block)) return false;
    appState.setRuleSlot(taskIndex, slot, block.id);
    sound.playSnap();
    return true;
  }
  attachEvents() {
    this.container.querySelectorAll('[data-shelf][role="tab"]').forEach(tab=>{tab.onclick=()=>{this.activeShelf=tab.dataset.shelf;this.render();};});
    this.container.querySelectorAll('.add-rule').forEach(button => { button.onclick = () => appState.addRule(button.dataset.taskId); });
    this.container.querySelectorAll('.remove-rule').forEach(button => { button.onclick = () => appState.removeRule(button.dataset.ruleId); });
    this.container.querySelectorAll('.palette-block-card').forEach(card => {
      card.onclick = () => {
        this.selectedBlockForPlacement = getBlockById(card.dataset.blockId);
        this.container.querySelectorAll('.palette-block-card').forEach(c => c.classList.toggle('selected', c === card));
      };
      card.ondragstart = event => event.dataTransfer.setData('text/plain', card.dataset.blockId);
    });
    this.container.querySelectorAll('.slot-container').forEach(slot => {
      const place = block => this.place(slot.dataset.ruleId || Number(slot.dataset.taskIndex), slot.dataset.slot, block);
      slot.onclick = event => { if (!event.target.closest('.clear-slot-btn')) place(this.selectedBlockForPlacement); };
      slot.onkeydown = event => { if (event.target === slot && ['Enter', ' '].includes(event.key)) { event.preventDefault(); place(this.selectedBlockForPlacement); } };
      slot.ondragover = event => event.preventDefault();
      slot.ondrop = event => { event.preventDefault(); place(getBlockById(event.dataTransfer.getData('text/plain'))); };
      const clear = slot.querySelector('.clear-slot-btn');
      if (clear) clear.onclick = event => { event.stopPropagation(); appState.clearRuleSlot(slot.dataset.ruleId || Number(slot.dataset.taskIndex), slot.dataset.slot); sound.playClick(); };
    });
    this.container.querySelector('.rule-continue').onclick = () => {
      const count = appState.getAttemptedTaskIds().length;
      if (!count) return;
      const line = this.container.querySelector('.rule-attempt-count');
      line.hidden = false;
      line.textContent = `Your robot will attempt ${count} of 6 tasks.`;
      if (window.navigateStep) window.navigateStep(5); else appState.setStep(5);
    };
  }
  updateTracePulse(traceState) {
    if (!this.container) return;
    const trace = window.simEngine?.lastTrace || traceState || {};
    for (const [key, label] of [['sense', 'SENSING'], ['decide', 'DECIDING'], ['act', 'ACTING']]) {
      const value = trace[key] ?? trace[{ sense: 'sense', decide: 'condition', act: 'action' }[key]];
      const line = this.container.querySelector(`[data-trace="${key}"]`);
      if (line) line.textContent = `${label} ${getBlockById(value)?.name || (typeof value === 'object' && value !== null ? JSON.stringify(value) : value || '—')}`;
    }
    this.container.querySelectorAll('.rule-row').forEach(row => row.classList.toggle('pulse-active', Boolean(trace.ruleId && row.dataset.ruleId === trace.ruleId)));
  }
}
export { BlockCanvasView as BlockCanvasRenderer };
