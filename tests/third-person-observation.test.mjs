import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { ENVIRONMENT_ITEMS, getEnvironmentTargets } from '../js/data/environment.js';
import { StepsView } from '../js/view/steps-view.js';

function fixture() {
  let x = 2000;
  const point = id => ({ id, x: x += 200, y: 2000 });
  const world = {
    dirtCells: Array.from({ length: 17 }, (_, i) => point(`DIRT_${i}`)),
    wetCells: Array.from({ length: 3 }, (_, i) => point(`WET_${i + 1}`)),
    objects: ['TRASH_1', 'TRASH_2', 'CUP_1', 'FOOD_1'].map(point),
    dock: point('DOCK'), cat: point('CAT'), avatar: { x: 130, y: 645 }
  };
  const state = new appState.constructor();
  state.configureEnvironment(world);
  state.setTaskPriority('TASK_1', 'thorough');
  state.setStep(2);
  return { state, world };
}

function walkOtherTargets(state, world) {
  for (const target of getEnvironmentTargets(world)) {
    if (target.id === 'PERSON') continue;
    Object.assign(world.avatar, { x: target.entity.x, y: target.entity.y });
    state.observeEnvironment(world, 'fps');
  }
}

test('Person is the original controlled avatar and its instruction asks for Third person', () => {
  const { world } = fixture();
  const targets = getEnvironmentTargets(world);
  assert.equal(targets.length, 27);
  assert.equal(targets.find(target => target.id === 'PERSON').entity, world.avatar);
  assert.equal(targets.filter(target => target.category === 'person').length, 1);
  assert.equal(ENVIRONMENT_ITEMS.find(item => item.id === 'person').description, 'Use Third person to see the person you control.');
});

test('FPS cannot award Person even at zero distance while nearby dirt can still be observed', () => {
  const { state, world } = fixture();
  Object.assign(world.avatar, { x: world.dirtCells[0].x, y: world.dirtCells[0].y });
  state.observeEnvironment(world, 'fps');
  state.observeEnvironment(world, 'fps');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), true);
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), false);
  assert.deepEqual(state.getEnvironmentProgress('person'), { observed: 0, total: 1 });
});

test('after all 26 other targets in FPS, Person keeps Sensors locked until Third person is used', () => {
  const { state, world } = fixture();
  walkOtherTargets(state, world);
  assert.deepEqual(state.getEnvironmentProgress(), { observed: 26, total: 27 });
  assert.equal(state.canEnterStep(3), false);
  assert.deepEqual(state.observeEnvironment(world, 'thirdPerson'), ['PERSON']);
  assert.deepEqual(state.getEnvironmentProgress(), { observed: 27, total: 27 });
  assert.equal(state.setStep(3), true);
});

test('visible fallback can observe Person, while unknown modes, POV and view-only Third person cannot', () => {
  for (const mode of ['orbit', 'robot']) {
    const { state, world } = fixture();
    state.observeEnvironment(world, mode);
    assert.equal(state.observedEnvironmentTargets.has('PERSON'), false);
  }
  const { state, world } = fixture();
  state.isRobotPovActive = true;
  state.observeEnvironment(world, 'thirdPerson');
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), false);
  state.isRobotPovActive = false;
  state.environmentWalkingEnabled = false;
  state.observeEnvironment(world, 'thirdPerson');
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), false);
  state.environmentWalkingEnabled = true;
  state.observeEnvironment(world, 'fallback');
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), true);
});

test('Third person observes the other targets with the same proximity and wall limits', () => {
  const { state, world } = fixture();
  Object.assign(world.dirtCells[0], { x: 130, y: 645 });
  Object.assign(world.avatar, { x: 130, y: 564 });
  state.observeEnvironment(world, 'thirdPerson');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), false);
  Object.assign(world.avatar, { x: 130, y: 565 });
  state.observeEnvironment(world, 'thirdPerson');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), true);
  Object.assign(world.dirtCells[1], { x: 500, y: 380 });
  Object.assign(world.avatar, { x: 440, y: 380 });
  state.observeEnvironment(world, 'thirdPerson');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_1'), false);
});

test('Person observation logs the viewing mode once and creates no entity, hardware or program changes', () => {
  const { state, world } = fixture(), events = [];
  state.on('sessionEvent', event => events.push(event));
  const before = JSON.stringify(world), configuration = state.getConfiguration(), revision = state.rulesRevision;
  state.observeEnvironment(world, 'thirdPerson');
  state.observeEnvironment(world, 'fps');
  state.observeEnvironment(world, 'thirdPerson');
  const personEvents = events.filter(event => event.target === 'PERSON');
  assert.equal(personEvents.length, 1);
  assert.equal(personEvents[0].step, 2);
  assert.equal(personEvents[0].detail.reason, 'self-view');
  assert.equal(personEvents[0].detail.mode, 'thirdPerson');
  assert.equal(JSON.stringify(world), before);
  assert.deepEqual(state.getConfiguration().program, configuration.program);
  assert.deepEqual(state.getConfiguration().sensors, configuration.sensors);
  assert.deepEqual(state.getConfiguration().actuators, configuration.actuators);
  assert.equal(state.rulesRevision, revision);
});

test('the Environment self-view button enables Third person and focuses the existing room canvas', t => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document, previousWalking = appState.environmentWalkingEnabled;
  const nodes = new Map(), view = Object.create(StepsView.prototype);
  view.panel = { innerHTML: '', querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, {}); return nodes.get(selector); }, querySelectorAll() { return []; } };
  let mode = null, focused = null;
  globalThis.window = { map3d: {}, switchViewMode(value) { mode = value; } };
  globalThis.document = { getElementById(id) { return { focus() { focused = id; } }; } };
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; appState.environmentWalkingEnabled = previousWalking; });
  view.renderStep2();
  assert.match(view.panel.innerHTML, /Walk around in FPS 360°, 3D 360° or Third person and approach every labelled location/);
  assert.equal((view.panel.innerHTML.match(/data-environment-category=/g) || []).length, 6);
  assert.match(view.panel.innerHTML, /id="walkEnvironment"/);
  assert.match(view.panel.innerHTML, /id="viewYourself"/);
  assert.match(view.panel.innerHTML, /id="viewWholeApartment"/);
  appState.environmentWalkingEnabled = false;
  nodes.get('#viewYourself').onclick();
  assert.equal(mode, 'thirdPerson');
  assert.equal(focused, 'threeCanvas');
  assert.equal(appState.environmentWalkingEnabled, true);
});

test('self-view observation persists across view changes, saved configuration and cumulative tasks', () => {
  const { state, world } = fixture();
  walkOtherTargets(state, world);
  state.observeEnvironment(world, 'thirdPerson');
  state.observeEnvironment(world, 'fps');
  assert.equal(state.getConfiguration().observedEnvironmentTargets.includes('PERSON'), true);
  state.stageResults[1].passingRunId = 1;
  state.continueStage();
  assert.equal(state.getEnvironmentProgress('person').observed, 1);
  assert.equal(state.canContinue(2), true);
});
