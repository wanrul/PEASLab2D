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

test('nested authoring allows unmounted hardware but validates explicit sensor provenance',()=>{
  const s=new appState.constructor();const condition={id:'c',type:'condition',sensor:'SENSE_05',command:'COND_03'};
  const behavior={id:'b',type:'behavior',priority:1,taskId:'TASK_1',body:[{id:'i',type:'if',branches:[{condition,body:[{id:'a',type:'action',command:'ACT_09'}]}],otherwise:[]}]};
  assert.equal(s.setProgram([behavior]),true);assert.equal(s.installedSensors.size,0);assert.equal(s.installedActuators.size,0);
  condition.sensor='SENSE_01';assert.equal(s.setProgram([behavior]),false);assert.equal(s.program[0].body[0].branches[0].condition.sensor,'SENSE_05');
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

test('sensor editor exposes all fifteen cards and the active stage budget of empty points', () => {
  const old = appState.installedSensors;
  appState.installedSensors = new Set();
  const container = { innerHTML: '', querySelectorAll: () => [], querySelector: () => ({}) };
  try {
    renderSensorStep(container);
    assert.equal((container.innerHTML.match(/data-module-id=/g) || []).length, 15);
    assert.equal((container.innerHTML.match(/data-mount-index=/g) || []).length, appState.sensorBudget);
    assert.match(container.innerHTML, new RegExp(`0 / ${appState.sensorBudget} mounted`));
    assert.match(container.innerHTML, new RegExp(`Up to ${appState.sensorBudget} sensors. No minimum selection`));
    assert.doesNotMatch(container.innerHTML, /mounting-continue" disabled/);
  } finally { appState.installedSensors = old; }
});

test('body editor exposes fourteen cards, ten points, and capacity only', () => {
  const old = appState.installedActuators;
  appState.installedActuators = new Set(ACTUATORS_CATALOG.slice(0, 7).map(a => a.id));
  const container = { innerHTML: '', isConnected: false, querySelectorAll: () => [], querySelector: () => ({}) };
  try {
    renderActuatorStep(container);
    assert.equal((container.innerHTML.match(/data-module-id=/g) || []).length, 14);
    assert.equal((container.innerHTML.match(/data-mount-index=/g) || []).length, 10);
    assert.match(container.innerHTML, /7 \/ 10 mounted/);
    assert.match(container.innerHTML, /Up to 10 actuators. No minimum selection/);
    assert.ok(!container.innerHTML.includes('mounting-continue" disabled'));
  } finally { appState.installedActuators = old; }
});

test('Map card shows its local-detection limit in the concise module description',()=>{
  const map=SENSORS_CATALOG.find(sensor=>sensor.id==='SENSE_07');
  assert.match(moduleCard(map,'sensor'),/only after detection by mounted local sensors/);
});
