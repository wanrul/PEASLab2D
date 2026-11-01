import test from 'node:test';
import assert from 'node:assert/strict';
import { BlockCanvasView, acceptsBlock } from '../js/view/block-canvas.js';
import { moduleCard, renderSensorStep, renderActuatorStep } from '../js/view/mounting-view.js';
import { SENSE_BLOCKS, CONDITION_BLOCKS, ACTION_BLOCKS, CONTROL_BLOCKS } from '../js/data/blocks.js';
import { SENSORS_CATALOG } from '../js/data/sensors.js';
import { ACTUATORS_CATALOG } from '../js/data/actuators.js';
import { appState } from '../js/state.js';

test('only block kind determines whether a slot accepts it', () => {
  for (const [kind, blocks] of Object.entries({ sense: SENSE_BLOCKS, condition: CONDITION_BLOCKS, action: ACTION_BLOCKS, control: CONTROL_BLOCKS })) {
    for (const block of blocks) {
      assert.equal(acceptsBlock(kind, block), true);
      assert.equal(acceptsBlock(kind === 'sense' ? 'action' : 'sense', block), false);
    }
  }
});

test('rule placement allows unmounted senses and actions and mismatched conditions', () => {
  const calls = [];
  const original = appState.setRuleSlot;
  const previousWindow = globalThis.window;
  globalThis.window = {};
  appState.setRuleSlot = (...args) => calls.push(args);
  try {
    const view = Object.create(BlockCanvasView.prototype);
    assert.equal(view.place(0, 'sense', SENSE_BLOCKS[0]), true);
    assert.equal(view.place(0, 'condition', CONDITION_BLOCKS.at(-1)), true);
    assert.equal(view.place(0, 'action', ACTION_BLOCKS.at(-1)), true);
    assert.equal(view.place(0, 'action', SENSE_BLOCKS[0]), false);
    assert.equal(calls.length, 3);
  } finally {
    appState.setRuleSlot = original;
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  }
});

test('every module card renders the same neutral fields', () => {
  for (const [kind, catalog] of [['sensor', SENSORS_CATALOG], ['actuator', ACTUATORS_CATALOG]]) {
    for (const item of catalog) {
      const html = moduleCard(item, kind);
      assert.ok(html.includes(item.name));
      assert.ok(html.includes(item.icon));
      assert.ok(!/recommended|distractor|redundant|Misses:|Cannot:|required module|category/i.test(html));
      if (item.misses) assert.ok(!html.includes(item.misses));
      if (item.cannot) assert.ok(!html.includes(item.cannot));
    }
  }
});

test('sensor editor exposes all fifteen cards and eleven empty physical points', () => {
  const old = appState.installedSensors;
  appState.installedSensors = new Set();
  const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => ({}) };
  try {
    renderSensorStep(container);
    assert.equal((container.innerHTML.match(/data-module-id=/g) || []).length, 15);
    assert.equal((container.innerHTML.match(/data-mount-index=/g) || []).length, 11);
    assert.match(container.innerHTML, /0 \/ 11 mounted/);
    assert.match(container.innerHTML, /Mount 8–11 sensors/);
    assert.match(container.innerHTML, /mounting-continue" disabled/);
  } finally { appState.installedSensors = old; }
});

test('body editor exposes fourteen cards, ten points, and the numeric gate', () => {
  const old = appState.installedActuators;
  appState.installedActuators = new Set(ACTUATORS_CATALOG.slice(0, 7).map(a => a.id));
  const container = { innerHTML: '', isConnected: false, querySelectorAll: () => [], querySelector: () => ({}) };
  try {
    renderActuatorStep(container);
    assert.equal((container.innerHTML.match(/data-module-id=/g) || []).length, 14);
    assert.equal((container.innerHTML.match(/data-mount-index=/g) || []).length, 10);
    assert.match(container.innerHTML, /7 \/ 10 mounted/);
    assert.match(container.innerHTML, /Mount 7–10 actuators/);
    assert.ok(!container.innerHTML.includes('mounting-continue" disabled'));
  } finally { appState.installedActuators = old; }
});
