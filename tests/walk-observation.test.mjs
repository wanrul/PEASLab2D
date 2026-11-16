import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { StepsView } from '../js/view/steps-view.js';
import * as environment from '../js/data/environment.js';

function worldFixture() {
  let nextX = 2000;
  const point = id => ({ id, x: nextX += 200, y: 2000 });
  return {
    dirtCells: Array.from({ length: 17 }, (_, i) => point(`DIRT_${i}`)),
    wetCells: Array.from({ length: 3 }, (_, i) => point(`WET_${i + 1}`)),
    objects: ['TRASH_1', 'TRASH_2', 'CUP_1', 'FOOD_1'].map(point),
    dock: point('DOCK'), cat: point('CAT'), avatar: { x: 130, y: 645 },
    checkCollision() { throw new Error('Furniture collision must not decide eye-level visibility'); }
  };
}

function setup() {
  const state = new appState.constructor(), world = worldFixture();
  assert.equal(typeof state.configureEnvironment, 'function');
  state.configureEnvironment(world);
  state.setTaskPriority('TASK_1', 'thorough');
  state.setStep(2);
  return { state, world };
}

function walkEveryTarget(state, world, skippedId) {
  for (const target of environment.getEnvironmentTargets(world)) {
    if (target.id === skippedId || target.id === 'PERSON') continue;
    Object.assign(world.avatar, { x: target.entity.x, y: target.entity.y });
    state.observeEnvironment(world, 'fps');
  }
  state.observeEnvironment(world, 'thirdPerson');
}

test('registry contains all 27 actual targets and has no manual category-confirmation shortcut', () => {
  const { state } = setup();
  assert.deepEqual(state.getEnvironmentProgress(), { observed: 0, total: 27 });
  for (const [category, total] of [['dirt', 17], ['spills', 3], ['objects', 4], ['dock', 1], ['cat', 1], ['person', 1]]) {
    assert.deepEqual(state.getEnvironmentProgress(category), { observed: 0, total });
  }
  assert.equal(state.setEnvironmentObservation, undefined);
  assert.equal(state.canContinue(2), false);
});

test('one unobserved individual keeps Sensors locked even when the rest of its category has been seen', () => {
  const { state, world } = setup();
  walkEveryTarget(state, world, 'DIRT_16');
  assert.deepEqual(state.getEnvironmentProgress(), { observed: 26, total: 27 });
  assert.deepEqual(state.getEnvironmentProgress('dirt'), { observed: 16, total: 17 });
  assert.equal(state.observedEnvironment.has('dirt'), false);
  assert.equal(state.canEnterStep(3), false);
  Object.assign(world.avatar, world.dirtCells[16]);
  state.observeEnvironment(world, 'fps');
  assert.deepEqual(state.getEnvironmentProgress(), { observed: 27, total: 27 });
  assert.equal(state.observedEnvironment.size, 6);
  assert.equal(state.setStep(3), true);
});

test('observation requires Environment walking mode, no POV, and proximity within 80 world units', () => {
  const { state, world } = setup();
  Object.assign(world.dirtCells[0], { x: 130, y: 645 });
  Object.assign(world.avatar, { x: 130, y: 564 });
  state.observeEnvironment(world, 'fps');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), false);
  Object.assign(world.avatar, { x: 130, y: 565 });
  for (const mode of ['orbit', 'robot', 'topDown']) state.observeEnvironment(world, mode);
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), false);
  state.currentStep = 1;
  state.observeEnvironment(world, 'fps');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), false);
  state.currentStep = 2;
  state.isRobotPovActive = true;
  state.observeEnvironment(world, 'fps');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), false);
  state.isRobotPovActive = false;
  state.observeEnvironment(world, 'fps');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), true);
  Object.assign(world.avatar, { x: 130, y: 645 });
  state.observeEnvironment(world, 'fallback');
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), true);
});

test('a wall blocks observation through it while an open doorway allows the same nearby target', () => {
  assert.equal(typeof environment.hasEnvironmentLineOfSight, 'function');
  assert.equal(environment.hasEnvironmentLineOfSight({ x: 0, y: 0 }, { x: 40, y: 0 }, [[20, -20, 20, 20]]), false);
  assert.equal(environment.hasEnvironmentLineOfSight({ x: 0, y: 0 }, { x: 40, y: 0 }, [[20, -20, 20, -5], [20, 5, 20, 20]]), true);
  const { state, world } = setup();
  Object.assign(world.avatar, { x: 440, y: 380 });
  Object.assign(world.dirtCells[0], { x: 500, y: 380 });
  state.observeEnvironment(world, 'fps');
  assert.equal(state.observedEnvironmentTargets.has('DIRT_0'), false, 'actual apartment wall separates these nearby locations');
});

test('target observations log stable IDs once without selecting hardware or changing a program', () => {
  const { state, world } = setup(), events = [];
  state.on('sessionEvent', event => events.push(event));
  const before = structuredClone({ program: state.program, rules: state.rules, revision: state.rulesRevision });
  Object.assign(world.avatar, { x: world.dirtCells[0].x, y: world.dirtCells[0].y });
  state.observeEnvironment(world, 'fps');
  state.observeEnvironment(world, 'fps');
  const targetEvents = events.filter(event => event.event === 'ENVIRONMENT_TARGET_OBSERVED');
  assert.deepEqual(targetEvents.map(event => event.target), ['DIRT_0']);
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), false);
  state.observeEnvironment(world, 'thirdPerson');
  const personEvent = events.find(event => event.target === 'PERSON');
  assert.equal(personEvent.detail.reason, 'self-view');
  assert.equal(personEvent.detail.mode, 'thirdPerson');
  assert.ok(targetEvents.every(event => event.step === 2 && !('entity' in event.detail)));
  assert.equal(state.installedSensors.size, 0);
  assert.equal(state.installedActuators.size, 0);
  assert.deepEqual({ program: state.program, rules: state.rules, revision: state.rulesRevision }, before);
});

test('target IDs persist across tasks and configuration snapshots cannot mutate observation state', () => {
  const { state, world } = setup();
  walkEveryTarget(state, world);
  const configuration = state.getConfiguration();
  assert.equal(configuration.observedEnvironmentTargets.length, 27);
  assert.equal(configuration.observedEnvironment.length, 6);
  configuration.observedEnvironmentTargets.pop();
  assert.equal(state.observedEnvironmentTargets.size, 27);
  state.stageResults[1].passingRunId = 1;
  state.continueStage();
  assert.equal(state.observedEnvironmentTargets.size, 27);
  assert.equal(state.canContinue(2), true);
});

test('Environment UI has readonly category progress and FPS walking instructions instead of checkboxes', t => {
  const previous = { targets: appState.environmentTargets, world: appState.environmentWorld, observed: appState.observedEnvironmentTargets, walking: appState.environmentWalkingEnabled, window: globalThis.window, document: globalThis.document };
  assert.equal(typeof appState.configureEnvironment, 'function');
  appState.observedEnvironmentTargets = new Set();
  appState.configureEnvironment(worldFixture());
  const nodes = new Map();
  const view = Object.create(StepsView.prototype);
  view.panel = { innerHTML: '', querySelector(selector) { if (!nodes.has(selector)) nodes.set(selector, {}); return nodes.get(selector); }, querySelectorAll() { return []; } };
  let mode = null;
  let focused = null;
  let collapsed = false;
  globalThis.window = { map3d: {}, switchViewMode(value) { mode = value; }, closeStepModal() { collapsed = true; } };
  globalThis.document = { getElementById(id) { return { focus() { focused = id; } }; } };
  t.after(() => { appState.environmentTargets = previous.targets; appState.environmentWorld = previous.world; appState.observedEnvironmentTargets = previous.observed; appState.environmentWalkingEnabled = previous.walking; globalThis.window = previous.window; globalThis.document = previous.document; });
  view.renderStep2();
  assert.doesNotMatch(view.panel.innerHTML, /type="checkbox"|data-environment-observation=/);
  assert.equal((view.panel.innerHTML.match(/data-environment-category=/g) || []).length, 6);
  assert.match(view.panel.innerHTML, /Walk around in FPS 360°/);
  assert.equal(nodes.get('#environmentContinue').disabled, true);
  assert.equal(nodes.get('#environmentProgress').textContent, '0 / 27 observed');
  nodes.get('#walkEnvironment').onclick();
  assert.equal(mode, 'fps');
  assert.equal(focused, 'threeCanvas');
  assert.equal(appState.environmentWalkingEnabled, true);
  globalThis.window.map3d = null;
  nodes.get('#viewWholeApartment').onclick();
  assert.equal(mode, 'fallback');
  assert.equal(appState.environmentWalkingEnabled, false);
  assert.equal(collapsed, true);
});

test('view-only fallback cannot award observations until walking is enabled again', () => {
  const { state, world } = setup();
  state.environmentWalkingEnabled = false;
  state.observeEnvironment(world, 'fallback');
  assert.equal(state.observedEnvironmentTargets.size, 0);
  state.environmentWalkingEnabled = true;
  state.observeEnvironment(world, 'fallback');
  assert.equal(state.observedEnvironmentTargets.has('PERSON'), true);
});
