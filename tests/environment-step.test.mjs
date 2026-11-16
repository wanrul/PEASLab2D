import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { StepsView } from '../js/view/steps-view.js';
import { ApartmentWorld } from '../js/sim/world.js';
import { getEnvironmentTargets } from '../js/data/environment.js';
import { observeAllEnvironmentForTest } from './fixtures/structured-solution.mjs';

const ids = ['dirt', 'spills', 'objects', 'dock', 'cat', 'person'];

test('Environment is a real gated step before hardware and all six canonical steps are navigable', () => {
  const state = new appState.constructor();
  state.configureEnvironment(new ApartmentWorld());
  state.setTaskPriority('TASK_1', 'thorough');
  assert.equal(state.setStep(2), true);
  assert.equal(state.canContinue(2), false);
  assert.equal(state.setStep(3), false);
  const observedWorld = observeAllEnvironmentForTest(state);
  assert.equal(state.getEnvironmentProgress().observed, getEnvironmentTargets(observedWorld).length);
  assert.equal(state.setStep(3), true);
  assert.equal(state.setStep(4), true);
  assert.equal(state.setStep(5), true);
  assert.equal(state.setStep(6), false);
  state.setRuleSlot(0, 'sense', 'SENSE_05');
  state.setRuleSlot(0, 'action', 'ACT_09');
  assert.equal(state.setStep(6), true);
  assert.equal(state.canEnterStep(7), false);
});

test('observed locations log canonical step two and do not choose a hardware or program design', () => {
  const state = new appState.constructor(), events = [];
  state.on('sessionEvent', event => events.push(event));
  const program = structuredClone(state.program), rules = structuredClone(state.rules), revision = state.rulesRevision;
  assert.equal(state.setEnvironmentObservation, undefined, 'manual category confirmation has been removed');
  const world = observeAllEnvironmentForTest(state);
  const targets = getEnvironmentTargets(world).map(target => target.id);
  const observations = events.filter(event => event.event === 'ENVIRONMENT_TARGET_OBSERVED');
  assert.equal(observations.length, targets.length);
  assert.deepEqual(new Set(observations.map(event => event.target)), new Set(targets));
  for (const event of observations) {
    assert.equal(event.step, 2);
    assert.ok(event.detail.distance <= 80);
    assert.ok(ids.includes(event.detail.category));
  }
  assert.equal(state.installedSensors.size, 0);
  assert.equal(state.installedActuators.size, 0);
  assert.deepEqual(state.program, program);
  assert.deepEqual(state.rules, rules);
  assert.equal(state.rulesRevision, revision);
});

test('configuration snapshots include individual observations and cumulative tasks retain them', () => {
  const state = new appState.constructor();
  const world = observeAllEnvironmentForTest(state);
  const targets = getEnvironmentTargets(world).map(target => target.id);
  const snapshot = state.getConfiguration();
  assert.deepEqual(snapshot.observedEnvironment, ids);
  assert.deepEqual(new Set(snapshot.observedEnvironmentTargets), new Set(targets));
  snapshot.observedEnvironmentTargets.pop();
  assert.equal(state.observedEnvironmentTargets.size, targets.length);
  state.toggleSensor('SENSE_05');
  state.toggleActuator('ACTUATOR_VACUUM');
  state.stageResults[1].passingRunId = 1;
  assert.equal(state.continueStage(), true);
  assert.deepEqual([...state.observedEnvironment], ids);
  assert.deepEqual(new Set(state.observedEnvironmentTargets), new Set(targets));
  assert.equal(state.canContinue(2), true);
  assert.equal(state.currentStep, 1);
  assert.equal(state.installedSensors.has('SENSE_05'), true);
  assert.equal(state.installedActuators.has('ACTUATOR_VACUUM'), true);
});

test('one missing individual location closes hardware access while observations remain revisitable', () => {
  const state = new appState.constructor();
  const world = observeAllEnvironmentForTest(state);
  state.unlockedStep = 6;
  // Set up an incomplete observation history without restoring a removed UI shortcut.
  state.observedEnvironmentTargets.delete(world.dirtCells[0].id);
  assert.deepEqual(state.getEnvironmentProgress('dirt'), { observed: world.dirtCells.length - 1, total: world.dirtCells.length });
  assert.equal(state.canEnterStep(1), true);
  assert.equal(state.canEnterStep(2), true);
  for (const step of [3, 4, 5, 6]) assert.equal(state.canEnterStep(step), false);
});

test('Environment page reports six category cards without manual checkboxes and gates Sensors on all locations', t => {
  const fresh = new appState.constructor(), saved = {};
  for (const key of Object.keys(fresh)) { saved[key] = appState[key]; appState[key] = fresh[key]; }
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  t.after(() => { Object.assign(appState, saved); globalThis.window = previousWindow; globalThis.document = previousDocument; });
  const world = new ApartmentWorld(), total = getEnvironmentTargets(world).length;appState.configureEnvironment(world);
  const rows = ids.map(id => ({ dataset: { environmentCategory: id }, querySelector() { return this.count; }, count: {}, classList: { toggle() {} } }));
  const progress = {}, next = {}, overview = {}, walk = {}, self = {};
  const nodes = { '#environmentProgress': progress, '#environmentContinue': next, '#viewWholeApartment': overview, '#walkEnvironment': walk, '#viewYourself': self };
  const view = Object.create(StepsView.prototype);
  view.panel = { innerHTML: '', querySelector(selector) { return nodes[selector]; }, querySelectorAll(selector) { return selector === '[data-environment-category]' ? rows : []; } };
  let entered = null, mode = null, framed = false, focused = false;
  globalThis.document = { getElementById() { return { focus() { focused = true; } }; } };
  globalThis.window = { navigateStep(step) { entered = step; }, switchViewMode(viewMode) { mode = viewMode; }, map3d: { viewWholeApartment() { framed = true; } } };
  view.renderStep2();
  assert.match(view.panel.innerHTML, /Observe the environment/);
  assert.equal((view.panel.innerHTML.match(/data-environment-category=/g) || []).length, 6);
  assert.doesNotMatch(view.panel.innerHTML, /type="checkbox"|data-environment-observation=/);
  assert.equal(progress.textContent, `0 / ${total} observed`);
  assert.equal(next.disabled, true);next.onclick();assert.equal(entered, null);
  overview.onclick();assert.equal(mode, '3d');assert.equal(framed, true);assert.equal(appState.environmentWalkingEnabled, true);
  walk.onclick();assert.equal(mode, 'fps');assert.equal(appState.environmentWalkingEnabled, true);assert.equal(focused, true);
  self.onclick();assert.equal(mode, 'thirdPerson');
  observeAllEnvironmentForTest(appState, world);view.updateEnvironmentGate();
  assert.equal(next.disabled, false);assert.equal(progress.textContent, `${total} / ${total} observed`);
  assert.equal(rows[0].count.textContent, `${world.dirtCells.length} / ${world.dirtCells.length}`);
  next.onclick();assert.equal(entered, 3);
  delete window.map3d;overview.onclick();assert.equal(mode, 'fallback');assert.equal(appState.environmentWalkingEnabled, false);
});
