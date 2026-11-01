import test from 'node:test';
import assert from 'node:assert/strict';
import { TASK_PURPOSES, PILOT_STAGES, criterionDescriptions } from '../js/pilot-config.js';
import { SENSORS_CATALOG } from '../js/data/sensors.js';
import { ACTUATORS_CATALOG } from '../js/data/actuators.js';
import { ALL_BLOCKS } from '../js/data/blocks.js';
import { TASKS_CATALOG } from '../js/data/tasks.js';
const i18n = await import('../js/i18n.js').catch(() => ({}));
const zh = text => i18n.translate(text, 'zh-CN');

test('Chinese presentation covers all stages, criteria and factory purposes without changing catalogs', () => {
  assert.equal(typeof i18n.translate, 'function', 'presentation translation module exists');
  const snapshot = JSON.stringify([TASK_PURPOSES, PILOT_STAGES]);
  for (const stage of PILOT_STAGES) {
    assert.match(zh(stage.name), /[\u3400-\u9fff]/);
    for (const c of criterionDescriptions(stage.id)) assert.match(zh(c.label), /[\u3400-\u9fff]/, c.label);
  }
  for (const { purpose, priorities } of Object.values(TASK_PURPOSES)) {
    assert.match(zh(purpose), /[\u3400-\u9fff]/);
    for (const [, label] of priorities) assert.match(zh(label), /[\u3400-\u9fff]/);
  }
  assert.equal(JSON.stringify([TASK_PURPOSES, PILOT_STAGES]), snapshot);
});

test('descriptions translate while hardware, blocks, commands and unknown strings pass through', () => {
  assert.equal(typeof i18n.translate, 'function');
  for (const item of SENSORS_CATALOG) {
    assert.equal(zh(item.name), item.name);
    assert.match(zh(item.measures), /[\u3400-\u9fff]/, item.measures);
    assert.match(zh(item.measures.split(/(?<=[.!?])\s/)[0]), /[\u3400-\u9fff]/);
  }
  for (const item of ACTUATORS_CATALOG) {
    assert.equal(zh(item.name), item.name);
    assert.match(zh(item.does), /[\u3400-\u9fff]/, item.does);
    assert.match(zh(item.does.split(/(?<=[.!?])\s/)[0]), /[\u3400-\u9fff]/);
  }
  for (const block of ALL_BLOCKS) {
    assert.equal(zh(block.name), block.name);
    assert.match(zh(block.desc), /[\u3400-\u9fff]/, block.desc);
  }
  for (const task of TASKS_CATALOG) for (const key of ['name','shortName','description','evaluationCriteria']) assert.match(zh(task[key]), /[\u3400-\u9fff]/, task[key]);
  for (const term of ['Purpose','Sensors','Actuators','Decision Logic','Test & Debug','PEAS','SENSE','CONDITION','ACTION','FLOW CONTROL','DIRTY','CLEAN','BIN','TABLE','DOCK','SENSE_05','user writes anything unusual']) assert.equal(zh(term), term);
  assert.equal(i18n.translate('Continue', 'en'), 'Continue');
});

test('dynamic live feedback translates numeric evidence and retains IDs', () => {
  assert.equal(typeof i18n.translate, 'function');
  for (const text of ['3 / 17 dirt cells cleaned','2 / 4 objects correctly sorted','1 / 3 spills mopped; 2 vacuum-on-liquid events','4 moving encounters; 3 stops; 1 unsafe crossings','4 moving encounters; 3 slow responses; 2 resumes; 1 fast passes','Low battery not observed; 0 travel ticks toward selected DOCK; not connected','Connected at 12.3% battery; 24 low-battery travel ticks','Inspection without cleaning tools: 3.1 seconds · Vacuum on clean floor: 4.2 seconds. These observations have no pass threshold.','Stage 4 of 6 · Add stopping for the cat','Rules configured for 2 current tasks.','Stage 3 has a recorded passing run (run 12). You may continue, or revise and test again.']) assert.match(zh(text), /[\u3400-\u9fff]/, text);
  assert.match(zh('Low battery not observed; 0 travel ticks toward selected DOCK; not connected'), /DOCK/);
});

test('text nodes reverse exactly, accept later canonical updates and do not write repeated translations', () => {
  assert.equal(typeof i18n.createTextLocalizer, 'function');
  const localize = i18n.createTextLocalizer();
  let value = '\n  Continue  ', writes = 0;
  const node = { get data() { return value; }, set data(v) { writes++; value=v; } };
  localize(node, 'zh-CN'); assert.equal(value, '\n  继续  ');
  localize(node, 'zh-CN'); assert.equal(writes, 1);
  localize(node, 'en'); assert.equal(value, '\n  Continue  ');
  value='Pause'; localize(node, 'zh-CN'); assert.equal(value, '暂停');
  localize(node, 'en'); assert.equal(value, 'Pause');
});

test('preference storage failure safely falls back to English', () => {
  assert.equal(typeof i18n.readLanguage, 'function');
  assert.equal(i18n.readLanguage({ getItem() { throw new Error('blocked'); } }), 'en');
  assert.equal(i18n.readLanguage({ getItem() { return 'zh-CN'; } }), 'zh-CN');
  assert.equal(i18n.readLanguage({ getItem() { return 'invalid'; } }), 'en');
});

 test('HUD evidence and live trace explanations are fully localized', () => {
  const evidence=zh('3 / 17 dirt cells cleaned: Partially achieved · 3.1 seconds elapsed');
  assert.doesNotMatch(evidence,/dirt cells cleaned|Partially achieved|seconds elapsed/);
  assert.match(zh('DECIDING Exploring'),/探索/);
  assert.doesNotMatch(zh('Floor Dirt Sensor — not mounted'),/not mounted/);
  assert.doesNotMatch(zh('VACUUM ON — no actuator'),/no actuator/);
});

test('factory purpose display maps to canonical text while edited factory phrases stay literal after remount', () => {
  assert.equal(typeof i18n.bindPurposeField, 'function');
  assert.equal(typeof i18n.isFactoryPurpose, 'function');
  const handlers={};
  const factory=TASK_PURPOSES.TASK_1.purpose;
  const input={value:factory,isConnected:true,ownerDocument:{activeElement:null},addEventListener(name,fn){handlers[name]=fn;}};
  const read=i18n.bindPurposeField(input,factory,factory,'test-stage-task');
  assert.equal(read(),factory);
  handlers.input(); // Explicitly editing to the same exact English phrase makes it user text.
  const remounted={...input,addEventListener(){}};
  const readAgain=i18n.bindPurposeField(remounted,factory,factory,'test-stage-task');
  assert.equal(readAgain(),factory);
  assert.equal(remounted.value,factory);
  assert.equal(i18n.isFactoryPurpose(factory,factory,'test-stage-task'),false);
});

test('clear-slot accessibility label translates the removal action before matching generic slot labels', () => {
  const source='Remove Floor Dirt Sensor from Vacuum Floor, Rule 1: sense';
  assert.equal(zh(source),'从清扫地板，规则 1的 sense 移除 Floor Dirt Sensor');
  assert.equal(i18n.translate(source,'en'),source);
});
