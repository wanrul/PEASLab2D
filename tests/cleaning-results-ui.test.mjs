import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { StepsView } from '../js/view/steps-view.js';
import { translate } from '../js/i18n.js';

function withEngine(t, engine) {
  const previous = globalThis.window;
  globalThis.window = { simEngine: engine };
  t.after(() => { globalThis.window = previous; });
  return Object.create(StepsView.prototype);
}

function card(html, metric) {
  return html.match(new RegExp(`<article[^>]*data-cleaning-metric="${metric}"[^>]*>([\\s\\S]*?)</article>`))?.[1] || '';
}

test('live results report independent area coverage and dirt count with percentage', t => {
  const view = withEngine(t, { getCleaningMetrics: () => ({
    floorCleanedCells: 25, floorTotalCells: 200, floorCoveragePercent: 12.5,
    dirtCleaned: 4, dirtTotal: 5, dirtCleanedPercent: 80
  }) });
  const html = view.renderCriteria([], 12);
  assert.match(card(html, 'floor'), /Floor cleaning coverage[\s\S]*12\.5%/);
  assert.match(card(html, 'dirt'), /Dirt spots removed[\s\S]*4 \/ 5[\s\S]*80\.0%/);
  assert.ok(html.indexOf('data-cleaning-metric="floor"') < html.indexOf('criteria-table'));
});

test('saved result counters always win over a different live engine', t => {
  const view = withEngine(t, { getCleaningMetrics() { throw new Error('historical results must not read the live engine'); } });
  const html = view.renderCriteria([], 19, {
    floorCleanedCells: 150, floorTotalCells: 200, floorCoveragePercent: 75,
    dirtCleaned: 1, dirtTotal: 5, dirtCleanedPercent: 20,
    inspectionSeconds: 3, cleanVacuumSeconds: 2
  });
  assert.match(card(html, 'floor'), /75\.0%/);
  assert.match(card(html, 'dirt'), /1 \/ 5[\s\S]*20\.0%/);
});

test('old saved dirt counts still report removal while unmeasured area stays unavailable', t => {
  const view = withEngine(t, { getCleaningMetrics() { throw new Error('old runs must not borrow live metrics'); } });
  const html = view.renderCriteria([], 8, { dirtCleaned: 3, dirtTotal: 4 });
  assert.match(card(html, 'floor'), /—/);
  assert.doesNotMatch(card(html, 'floor'), /0\.0%/);
  assert.match(card(html, 'dirt'), /3 \/ 4[\s\S]*75\.0%/);
});

test('a saved run with no counters cannot display the current live result in its final summary', t => {
  const view = withEngine(t, { getCleaningMetrics() { throw new Error('missing history is not a live run'); } });
  const priorHistory = appState.runHistory;
  appState.runHistory = [{ stageId: 1, passed: false, criteria: [], elapsedSeconds: 4, outcomes: [] }];
  t.after(() => { appState.runHistory = priorHistory; });
  view.panel = { innerHTML: '', querySelector() { return {}; } };
  view.showFinalSummaryModal();
  assert.match(card(view.panel.innerHTML, 'floor'), /—/);
  assert.match(card(view.panel.innerHTML, 'dirt'), /—/);
});

test('fresh zero values are displayed as measurements rather than missing data', t => {
  const view = withEngine(t, { getCleaningMetrics: () => ({
    floorCleanedCells: 0, floorTotalCells: 200, floorCoveragePercent: 0,
    dirtCleaned: 0, dirtTotal: 17, dirtCleanedPercent: 0
  }) });
  const html = view.renderCriteria([], 0);
  assert.match(card(html, 'floor'), /0\.0%/);
  assert.match(card(html, 'dirt'), /0 \/ 17[\s\S]*0\.0%/);
});

test('cleaning Purpose shows coverage goals and estimates only in the combined cleaning task', () => {
  const saved={...appState};Object.assign(appState,new appState.constructor());appState.currentStage=2;appState.selectedTasks=['TASK_1','TASK_2'];appState.stagePurposes[2]=appState.createStagePurposes(2);
  const view = Object.create(StepsView.prototype);
  view.panel = { innerHTML: '', querySelectorAll() { return []; }, querySelector() { return {}; } };
  view.renderStep1();
  const html = view.panel.innerHTML;
  assert.match(html, /Set performance measurement/);
  assert.match(html,/Common behaviors in every task/);
  assert.match(html, /100% of cleanable floor area/);
  assert.match(html, /At least 60% of cleanable floor area/);
  assert.match(html, /About 40 simulation minutes/);
  assert.match(html, /About 20 simulation minutes/);
  assert.match(html,/Each spill is clean after actual mop contact/);
  assert.doesNotMatch(html, /Final combined-run budget|At 5× playback|Coverage counts floor actually vacuumed|Current Test feedback still reports|The time budgets apply/);
  Object.assign(appState,saved);
});

test('both result labels and the short Purpose result note have Chinese translations', () => {
  for (const text of ['Floor cleaning coverage', 'Dirt spots removed', 'Of cleanable floor area', 'Test results show floor cleaning coverage and dirt spots removed separately.']) {
    assert.match(translate(text, 'zh-CN'), /[\u3400-\u9fff]/, text);
    assert.equal(translate(text, 'en'), text);
  }
});
