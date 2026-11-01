import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { sessionLogger } from '../js/logging/session-log.js';
import { StepsView } from '../js/view/steps-view.js';

function browserDocument(t, value) {
  const previous = globalThis.document;
  globalThis.document = value;
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
}

// Catch loss of learner attribution when the role switcher is removed.
test('observations belong to the same learner while editing PEAS components', () => {
  const state = new appState.constructor();
  state.toggleSensor('SENSE_01');
  state.toggleSensor('SENSE_01');
  state.toggleActuator('ACTUATOR_VACUUM');
  state.toggleActuator('ACTUATOR_VACUUM');
  state.setRuleSlot(0, 'sense', 'SENSE_02');
  const first = state.addObservationStamp('✓', 'Expected behavior');
  state.recordDebugMove('move1_swap');
  const second = state.addObservationStamp('?', 'Needs review');
  assert.equal(first.participantId, 'Learner');
  assert.equal(second.participantId, 'Learner');
  assert.deepEqual(state.observationLogs.map(e => e.stamp), ['✓', '?']);
  assert.equal(state.installedSensors.has('SENSE_01'), false);
  assert.equal(state.installedActuators.has('ACTUATOR_VACUUM'), false);
  assert.equal(state.rules[0].slots.sense, 'SENSE_02');
  assert.equal(state.debugMoves.move1_swap, 1);
});

test('session events and CSV retain one participant and quoted observation notes', t => {
  const before = sessionLogger.events.length;
  appState.addObservationStamp('✗', 'Expected "stop", observed motion');
  const event = sessionLogger.events.at(-1);
  assert.equal('participantId' in event, false);
  assert.equal(event.event, 'STAMP');
  assert.equal(sessionLogger.getSummaryStats().totalEvents, before + 1);

  // Only replace the browser download boundary; use the real CSV exporter.
  let attrs = {};
  const anchor = { setAttribute: (key, value) => { attrs[key] = value; }, click() {} };
  browserDocument(t, {
    createElement: () => anchor,
    body: { appendChild() {}, removeChild() {} }
  });
  sessionLogger.exportCsv();
  const csv = decodeURIComponent(attrs.href).split(',').slice(1).join(',');
  assert.match(csv, /^timestamp,step,event,target_id,detail/);
  assert.ok(!csv.includes("ParticipantID"));
  assert.ok(csv.includes("observed motion"));
  assert.match(attrs.download, /^PEASLab2D_Session_Log_/);
});

test('edit buttons end the run and navigate directly to the selected PEAS step',t=>{
  const oldWindow=globalThis.window;
  let target=null, ended=null;
  const controls=new Map();
  const edit={dataset:{editStep:'2'}};
  const view=Object.create(StepsView.prototype);
  view.panel={innerHTML:'',querySelector(selector){if(!controls.has(selector))controls.set(selector,{value:'',textContent:''});return controls.get(selector);},querySelectorAll(selector){return selector==='[data-edit-step]'?[edit]:[];}};
  globalThis.window={simEngine:{scores:{},endRun(reason){ended=reason;}},navigateStep(step){target=step;}};
  t.after(()=>{globalThis.window=oldWindow;});
  const previous=appState.sessionFinished;appState.sessionFinished=false;t.after(()=>{appState.sessionFinished=previous;});
  view.renderStep5();edit.onclick();
  assert.equal(ended,'revision');assert.equal(target,2);
});
