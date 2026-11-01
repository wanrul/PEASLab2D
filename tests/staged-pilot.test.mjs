import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appState } from '../js/state.js';
import { ApartmentWorld } from '../js/sim/world.js';
import { SimulationEngine } from '../js/sim/engine.js';
import { BlockCanvasView } from '../js/view/block-canvas.js';
import { StepsView } from '../js/view/steps-view.js';
import { SessionLogger } from '../js/logging/session-log.js';
import { TASKS_CATALOG } from '../js/data/tasks.js';
import { SENSORS_CATALOG } from '../js/data/sensors.js';
import { ACTUATORS_CATALOG } from '../js/data/actuators.js';
import { ALL_BLOCKS } from '../js/data/blocks.js';

function fixture(t, options) {
  const fresh = new appState.constructor(), saved = {};
  for (const key of Object.keys(fresh)) { saved[key] = appState[key]; appState[key] = fresh[key]; }
  t.after(() => Object.assign(appState, saved));
  const world = new ApartmentWorld(), engine = new SimulationEngine(world, options);
  t.after(() => engine.stop());
  return { world, engine };
}
const author = (rule, slots) => Object.entries(slots).forEach(([slot, block]) => appState.setRuleSlot(rule.id, slot, block));
function formal(engine) { engine.start(); engine.pause(); }
function viewFixture(t, engine) {
  const old = globalThis.window; globalThis.window = { simEngine:engine, navigateStep() {} }; t.after(() => globalThis.window = old);
  const nodes = new Map();
  const panel = { innerHTML:'', querySelector(s) { if (s === '#runTrace') return null; if (!nodes.has(s)) nodes.set(s, {}); return nodes.get(s); }, querySelectorAll() { return []; } };
  const view = Object.create(StepsView.prototype); view.panel = panel;
  return { view, panel, nodes };
}

test('stage one gates actual priorities, removes hardware minima, retains capacities and unlocked revisits', t => {
  fixture(t); assert.deepEqual(appState.selectedTasks,['TASK_1']);
  assert.equal(appState.canContinue(1),false); assert.equal(appState.setTaskPriority('TASK_1','thorough'),true);
  assert.equal(appState.setStep(2),true); assert.equal(appState.setStep(3),true); assert.equal(appState.setStep(4),true);
  assert.equal(appState.setStep(5),false); author(appState.rules[0],{sense:'SENSE_02',action:'ACT_18'});
  assert.equal(appState.setStep(5),true); assert.equal(appState.setStep(1),true);
  for(let i=1;i<=3;i++) assert.equal(appState.toggleSensor(`SENSE_${String(i).padStart(2,'0')}`).success,true);
  assert.equal(appState.toggleSensor('SENSE_04').success,false);
  for(let i=0;i<10;i++) assert.equal(appState.toggleActuator(`module${i}`).success,true);
  assert.equal(appState.toggleActuator('extra').success,false);
});

test('only a recorded passing formal run permits explicit stage transition and carries design and observations', t => {
  const { world, engine } = fixture(t);
  appState.setTaskPriority('TASK_1','thorough'); appState.toggleSensor('SENSE_05'); appState.toggleActuator('ACTUATOR_VACUUM');
  author(appState.rules[0],{sense:'SENSE_05',action:'ACT_09'}); const id=appState.rules[0].id; appState.addObservation('?', 'Keep this');
  engine.startPreview(); world.dirtCells.forEach(d=>d.cleaned=true); engine.updateOutcomes();
  assert.equal(appState.continueStage(),false); engine.reset(); assert.equal(appState.runHistory.length,0);
  formal(engine); world.dirtCells.forEach(d=>d.cleaned=true); const pass=engine.endRun('evaluate');
  assert.equal(pass.passed,true); assert.equal(appState.currentStage,1); assert.equal(appState.sessionFinished,undefined);
  formal(engine); assert.equal(engine.criteriaResults[0].status,'Not achieved'); engine.endRun('revision');
  assert.equal(appState.continueStage(),true); assert.equal(appState.currentStage,2); assert.equal(appState.currentStep,1); assert.equal(appState.unlockedStep,1);
  assert.deepEqual(appState.selectedTasks,['TASK_1','TASK_2']); assert.equal(appState.rules[0].id,id);
  assert.ok(appState.installedSensors.has('SENSE_05')); assert.ok(appState.installedActuators.has('ACTUATOR_VACUUM'));
  assert.equal(appState.observationLogs[0].comment,'Keep this'); assert.equal(appState.stagePurposes[1].TASK_1.priority,'thorough');
  assert.equal(appState.canContinue(1),false); assert.equal(appState.stageResults[1].passingRunId,pass.runId);
  engine.reset(); assert.equal(appState.runHistory.length,2); assert.equal(appState.stageResults[1].passingRunId,pass.runId);
});

test('locked rules never arbitrate, queue, count or route; priorities are separate from flow', t => {
  const { world, engine }=fixture(t); appState.installedSensors=new Set(['SENSE_02','SENSE_15','SENSE_07']); appState.installedActuators=new Set(['ACTUATOR_LED','ACTUATOR_WHEELS','ACTUATOR_ROTATION']);
  author(appState.rules[1],{sense:'SENSE_02',action:'ACT_18',priority:'CTRL_05'});
  assert.deepEqual(appState.getAttemptedTaskIds(),[]); assert.equal(engine.evaluateRules(engine.readSensors()),null);
  author(appState.rules[0],{sense:'SENSE_02',action:'ACT_20',control:'CTRL_04',secondaryAction:'ACT_19',priority:'CTRL_05'});
  assert.equal(appState.rules[0].slots.control,'CTRL_04'); assert.equal(appState.rules[0].slots.priority,'CTRL_05');
  assert.equal(appState.setRuleSlot(appState.rules[0].id,'control','CTRL_05'),false);
  assert.equal(appState.setRuleSlot(appState.rules[0].id,'priority','CTRL_03'),false);
  assert.equal(engine.evaluateRules(engine.readSensors()).taskId,'TASK_1');
  Object.assign(world.robot,{x:350,y:470,heading:0}); world.dirtCells=[];
  appState.installedSensors.delete('SENSE_07');engine.drive({mapWet:[{x:350,y:550}],visibleObject:{x:350,y:550},SENSE_03:{target:'BIN',x:350,y:550}});
  assert.equal(world.robot.heading,0); assert.equal(engine.taskOutcomes.length,1);
  const view=Object.create(BlockCanvasView.prototype); const control=view.renderPaletteBlocks('Control');
  assert.equal((control.match(/data-block-id=/g)||[]).length,4); assert.doesNotMatch(control,/CTRL_05|CTRL_06/);
  assert.match(view.renderRuleRow(appState.rules[0],0,1),/data-rule-priority/);
});

test('fresh formal runs reset world, counters, clock and controls; pause and speed preserve them', t => {
  const { world, engine }=fixture(t); world.reset(); const original=JSON.stringify(world);
  appState.installedSensors.add('SENSE_02'); appState.installedActuators.add('ACTUATOR_LED');
  author(appState.rules[0],{sense:'SENSE_02',action:'ACT_18',control:'CTRL_04',secondaryAction:'ACT_20'});
  formal(engine); engine.tick(); assert.equal(engine.pendingThen.length,1); const robotX=world.robot.x;
  engine.start(); engine.setSpeed(5); engine.pause(); assert.equal(world.robot.x,robotX); assert.equal(engine.pendingThen.length,1);
  engine.tick(); assert.equal(engine.activeRuleFired.action,'ACT_20'); world.dirtCells[0].cleaned=true; engine.pickups=8; engine.endRun('revision');
  formal(engine); assert.equal(JSON.stringify(world),original); assert.equal(engine.pickups,0); assert.equal(engine.tickCount,0); assert.equal(engine.elapsedSeconds,0); assert.equal(engine.pendingThen.length,0);
  engine.tick(); appState.toggleActuator('ACTUATOR_LED'); assert.equal(engine.evaluateRules(engine.readSensors()).action,'ACT_18'); assert.equal(engine.pendingThen.length,0);
});

test('functional criterion evidence and optional speed target determine pass without grades', t => {
  const { world, engine }=fixture(t); formal(engine);
  assert.equal(engine.criteriaResults[0].status,'Not achieved'); world.dirtCells[0].cleaned=true; engine.updateOutcomes();
  assert.equal(engine.criteriaResults[0].status,'Partially achieved'); world.dirtCells.forEach(d=>d.cleaned=true); engine.elapsedSeconds=450; engine.updateOutcomes();
  const result=engine.endRun('evaluate'); assert.equal(result.passed,true); assert.equal(result.criteria.find(c=>c.id==='speed'),undefined);
  assert.equal(result.elapsedSeconds,450); assert.doesNotMatch(JSON.stringify(result),/scores|weights|composite|baseline/);
  const targeted=new SimulationEngine(new ApartmentWorld(),{criteria:{1:{dirtFraction:1,speedLimitSeconds:2},2:{dirtFraction:1,sortedFraction:1,speedLimitSeconds:null}}});
  formal(targeted); targeted.world.dirtCells.forEach(d=>d.cleaned=true); targeted.elapsedSeconds=2.1; targeted.updateOutcomes();
  assert.equal(targeted.endRun().passed,false); assert.equal(targeted.criteriaResults.find(c=>c.id==='speed').status,'Not achieved'); targeted.stop();
});

test('reflection occurs once on a failed formal ending, never for unfinished ticks or preview', t => {
  const {engine}=fixture(t); let prompts=0; appState.on('reflectionNeeded',()=>prompts++);
  engine.startPreview(); for(let i=0;i<4;i++)engine.tick(); engine.endRun(); assert.equal(prompts,0);
  formal(engine); for(let i=0;i<5;i++)engine.tick(); assert.equal(prompts,0); engine.endRun('evaluate'); assert.equal(prompts,1);
  engine.endRun(); assert.equal(prompts,1); assert.equal(appState.reflectionPrompt.runId,1);
  formal(engine); engine.world.dirtCells.forEach(d=>d.cleaned=true); engine.endRun(); assert.equal(prompts,1);
});

test('stage-aware logs and summaries preserve previous stage outcomes and factual new snapshots', t => {
  const {engine}=fixture(t); const logger=new SessionLogger(appState); appState.setTaskPriority('TASK_1','speed'); appState.setTaskPurpose('TASK_1','Clean this floor');
  formal(engine); engine.world.dirtCells.forEach(d=>d.cleaned=true); engine.endRun('evaluate'); appState.setClosingText('First stage reflection'); appState.continueStage();
  appState.setTaskPriority('TASK_1','thorough'); appState.setTaskPriority('TASK_2','correct'); appState.addObservation('?', 'Sorting stage');
  formal(engine); engine.endRun('evaluate');
  for(const event of logger.events){const d=JSON.parse(event.detail);assert.ok([1,2].includes(d.stageId),event.event);assert.ok(Array.isArray(d.taskIds),event.event);}
  assert.ok(logger.events.some(e=>e.event==='STAGE_TRANSITION')); assert.ok(logger.events.some(e=>e.event==='PURPOSE_CHANGED')); assert.ok(logger.events.some(e=>e.event==='TASK_PRIORITY_CHANGED'));
  assert.doesNotMatch(logger.exportCSV(),/scores|weights|composite|Player A|Player B|PlayerID/);
  const {view,panel}=viewFixture(t,engine);view.showFinalSummaryModal();assert.match(panel.innerHTML,/Stage 1/);assert.match(panel.innerHTML,/Stage 2/);assert.match(panel.innerHTML,/First stage reflection/);assert.doesNotMatch(panel.innerHTML,/Weighted|First run|score-/);
});

test('rule-driven stage one cleaning then cumulative stage two sorting preserves cleaning capability', t => {
  const {world,engine}=fixture(t);
  const originalReset=world.reset.bind(world);
  world.reset=()=>{originalReset();Object.assign(world.robot,{x:350,y:470,heading:0});world.dirtCells=[{id:'d',x:350,y:470,radius:14,cleaned:false}];world.objects=[{id:'one',type:'TRASH',x:375,y:470,carried:false,disposed:false,sorted:false}];Object.assign(world.smartBin,{x:420,y:510});world.wetCells=[];world.cat.state='pause';world.cat.pauseTimer=10000;};
  appState.installedSensors=new Set(['SENSE_05','SENSE_15','SENSE_03']); appState.installedActuators=new Set(['ACTUATOR_VACUUM','ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']);
  author(appState.rules[0],{sense:'SENSE_05',condition:'COND_03',action:'ACT_09'});
  formal(engine);engine.tick();assert.equal(engine.endRun('evaluate').passed,true);assert.equal(appState.continueStage(),true);
  author(appState.rules[1],{sense:'SENSE_15',condition:'COND_16',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});
  author(appState.addRule('TASK_2'),{sense:'SENSE_15',condition:'COND_16',action:'ACT_24',priority:'CTRL_05'});
  const drop=appState.addRule('TASK_2');author(drop,{sense:'SENSE_03',condition:'COND_10',action:'ACT_15',priority:'CTRL_05'});
  formal(engine);let carried=false;for(let i=0;i<150;i++){engine.tick();carried ||= Boolean(world.robot.heldObject);}
  const result=engine.endRun('evaluate');assert.equal(carried,true);assert.equal(world.objects[0].sorted,true);assert.equal(world.dirtCells[0].cleaned,true);assert.equal(result.passed,true);assert.deepEqual(result.tasksCompleted,['TASK_1','TASK_2']);
});

test('learner screens offer criteria, four edit targets and no numeric score or normal 2D option; original catalog IDs and names preserved', t => {
  const {engine}=fixture(t);const {view,panel}=viewFixture(t,engine); view.renderStep1();assert.doesNotMatch(panel.innerHTML,/type="range"|weight|All six/); assert.match(panel.innerHTML,/Speed/);
  view.renderStep5();assert.match(panel.innerHTML,/Observed result/);assert.match(panel.innerHTML,/data-edit-step="1"/);assert.match(panel.innerHTML,/data-edit-step="4"/);assert.doesNotMatch(panel.innerHTML,/score-/);
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.doesNotMatch(html,/viewMode2DBtn|hudPeasScore|hudCoverageScore|hudSafetyScore|data-score-definition|2D Map/);
  const originals=JSON.parse(readFileSync(new URL('./fixtures/original-catalog-items.json',import.meta.url),'utf8'));
  for(const [name,catalog]of Object.entries({tasks:TASKS_CATALOG,sensors:SENSORS_CATALOG,actuators:ACTUATORS_CATALOG,blocks:ALL_BLOCKS}))
    for(const item of originals[name])assert.ok(catalog.some(current=>current.id===item.id&&current.name===item.name),`${name}: ${item.id} ${item.name}`);
});

test('default apartment completes cumulative cleaning and all four sorting targets with perception-driven rules', t => {
  const {world,engine}=fixture(t);
  appState.installedSensors=new Set(['SENSE_05','SENSE_07']);
  appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_VACUUM','ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']);
  author(appState.rules[0],{sense:'SENSE_05',condition:'COND_03',action:'ACT_09'});
  author(appState.addRule('TASK_1'),{sense:'SENSE_05',condition:'COND_06',action:'ACT_10'});
  formal(engine);for(let i=0;i<15000&&!world.dirtCells.every(d=>d.cleaned);i++)engine.tick();
  assert.equal(engine.endRun('evaluate').passed,true);assert.equal(appState.continueStage(),true);
  appState.installedSensors.add('SENSE_15');appState.installedSensors.add('SENSE_03');
  author(appState.rules.find(r=>r.taskId==='TASK_2'),{sense:'SENSE_15',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});
  author(appState.addRule('TASK_2'),{sense:'SENSE_03',condition:'COND_10',action:'ACT_15',priority:'CTRL_05'});
  author(appState.addRule('TASK_2'),{sense:'SENSE_15',condition:'COND_16',action:'ACT_24',priority:'CTRL_05'});
  author(appState.addRule('TASK_2'),{sense:'SENSE_15',condition:'COND_17',action:'ACT_25',priority:'CTRL_05'});
  formal(engine);
  // Use ordinary battery and physical movement: this proves the actual pilot is feasible.
  for(let i=0;i<15000&&(!world.objects.every(o=>o.sorted)||!world.dirtCells.every(d=>d.cleaned));i++){engine.tick();assert.equal(world.checkCollision(world.robot.x,world.robot.y,world.robot.radius),false);}
  assert.deepEqual(world.objects.map(o=>[o.id,o.sorted]),[['TRASH_1',true],['TRASH_2',true],['CUP_1',true],['FOOD_1',true]]);
  assert.equal(engine.pickups,4);assert.equal(engine.releases,4);assert.ok(world.robot.battery>0);assert.equal(engine.endRun('evaluate').passed,true);
  t.diagnostic(`Default Stage 2 completion: ${engine.tickCount} ticks, battery ${world.robot.battery.toFixed(1)}%.`);
});

test('rule firing records distinguish preview exploration from formal runs',t=>{
  const {engine}=fixture(t);const logger=new SessionLogger(appState);
  appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');author(appState.rules[0],{sense:'SENSE_02',action:'ACT_18'});
  engine.startPreview();engine.tick();engine.stopPreview();formal(engine);engine.tick();engine.endRun();
  const firings=logger.events.filter(event=>event.event==='RULE_FIRED').map(event=>JSON.parse(event.detail));
  assert.equal(firings[0].preview,true);assert.equal(firings[0].runId,null);assert.equal(firings[1].preview,false);assert.equal(firings[1].runId,1);
});

test('fresh Run immediately replaces previous criterion evidence before the first tick',t=>{
  const {engine}=fixture(t);const {panel}=viewFixture(t,engine);
  const previousDocument=globalThis.document;globalThis.document={getElementById(){return null;}};t.after(()=>globalThis.document=previousDocument);
  new StepsView(panel,null,null);formal(engine);engine.world.dirtCells.forEach(d=>d.cleaned=true);engine.endRun('evaluate');
  assert.match(panel.querySelector('#criterionResults').innerHTML,/17 \/ 17/);
  formal(engine);assert.match(panel.querySelector('#criterionResults').innerHTML,/0 \/ 17/);assert.doesNotMatch(panel.querySelector('#criterionResults').innerHTML,/>Achieved</);
});

test('navigation events record the actual destination with current stage and task context',t=>{
  fixture(t);const logger=new SessionLogger(appState);appState.setTaskPriority('TASK_1','speed');appState.setStep(2);appState.setStep(3);appState.setStep(1);
  const entered=logger.events.filter(event=>event.event==='STEP_ENTERED').map(event=>JSON.parse(event.detail));
  assert.deepEqual(entered.map(event=>[event.from,event.to]),[[1,2],[2,3],[3,1]]);
  assert.ok(entered.every(event=>event.stageId===1&&event.taskIds.join(',')==='TASK_1'));
});

test('fractional cleaning criteria agree with live task status and exported completed tasks',t=>{
  const {world,engine}=fixture(t,{criteria:{1:{dirtFraction:0.5,speedLimitSeconds:null},2:{dirtFraction:0.5,sortedFraction:0.5,speedLimitSeconds:null}}});
  const logger=new SessionLogger(appState);formal(engine);world.dirtCells.slice(0,9).forEach(cell=>cell.cleaned=true);engine.vacuumTicks=1;engine.updateOutcomes();
  assert.equal(engine.criteriaResults[0].status,'Achieved');assert.equal(engine.taskOutcomes[0].status,'done');
  const result=engine.endRun('evaluate');assert.equal(result.passed,true);assert.deepEqual(result.tasksCompleted,['TASK_1']);assert.equal(result.outcomes[0].summary,'Cleaned 9 of 17 dirty cells.');
  const exported=JSON.parse(logger.events.findLast(event=>event.event==='RUN_ENDED').detail);assert.equal(exported.outcomes[0].status,'done');assert.deepEqual(exported.tasksCompleted,['TASK_1']);
});

test('cumulative fractional functional tasks succeed independently of an unmet Speed criterion',t=>{
  const {world,engine}=fixture(t,{criteria:{1:{dirtFraction:0.5,speedLimitSeconds:null},2:{dirtFraction:0.5,sortedFraction:0.5,speedLimitSeconds:1}}});
  formal(engine);world.dirtCells.slice(0,9).forEach(cell=>cell.cleaned=true);engine.endRun('evaluate');assert.equal(appState.continueStage(),true);
  for(const elapsed of [0.8,1.2]){
    formal(engine);world.dirtCells.slice(0,9).forEach(cell=>cell.cleaned=true);world.objects.slice(0,2).forEach(object=>object.sorted=true);engine.vacuumTicks=1;engine.pickups=2;engine.releases=2;engine.elapsedSeconds=elapsed;engine.updateOutcomes();
    assert.deepEqual(engine.taskOutcomes.map(outcome=>[outcome.taskId,outcome.status]),[['TASK_1','done'],['TASK_2','done']]);
    const result=engine.endRun('evaluate');assert.equal(result.passed,elapsed===0.8);assert.deepEqual(result.tasksCompleted,['TASK_1','TASK_2']);
    assert.deepEqual(result.criteria.map(criterion=>[criterion.id,criterion.status]),[['cleaning','Achieved'],['sorting','Achieved'],['speed',elapsed===0.8?'Achieved':'Not achieved']]);
    assert.equal(result.outcomes[0].summary,'Cleaned 9 of 17 dirty cells.');assert.equal(result.outcomes[1].summary,'Sorted 2 of 4 objects.');
  }
});

function sortingMemoryFixture(t){
  const result=fixture(t);appState.currentStage=2;appState.selectedTasks=['TASK_1','TASK_2'];appState.stagePurposes[2]=appState.createStagePurposes(2);appState.stageResults[2]={passingRunId:null,closingText:''};
  appState.installedSensors=new Set(['SENSE_15']);appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION']);
  return result;
}

test('Vision memory contains only an object actually reported by the mounted camera',t=>{
  const {world,engine}=sortingMemoryFixture(t);Object.assign(world.robot,{x:350,y:470,heading:0});
  world.objects=[{id:'seen',type:'TRASH',x:400,y:470},{id:'behind',type:'CUP',x:300,y:470},{id:'far',type:'FOOD',x:600,y:470}];
  const percepts=engine.readSensors();assert.equal(percepts.visibleObject.id,'seen');assert.deepEqual(percepts.rememberedObjects,[{id:'seen',type:'TRASH',x:400,y:470}]);
  assert.deepEqual([...engine.perceivedObjects.keys()],['seen']);
  Object.assign(world.robot,{heading:Math.PI/2});assert.equal(engine.readSensors().visibleObject,undefined);assert.deepEqual([...engine.perceivedObjects.keys()],['seen']);
});

test('unmounted Vision cannot expose or route a remembered object position',t=>{
  const {world,engine}=sortingMemoryFixture(t);Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'seen',type:'CUP',x:400,y:520}];
  const seen=engine.readSensors();assert.equal(seen.visibleObject.id,'seen');assert.equal(engine.perceivedObjects.size,1);
  appState.toggleSensor('SENSE_15');const unmounted=engine.readSensors();assert.equal(unmounted.SENSE_15,'NOT_INSTALLED');assert.equal(unmounted.rememberedObjects,undefined);
  // Even a retained pre-unmount percept cannot bypass the installed-module gate.
  engine.drive({rememberedObjects:seen.rememberedObjects});assert.equal(world.robot.heading,0);assert.equal(world.robot.y,470);
});

test('Reset and each fresh formal Run clear Vision memory',t=>{
  const {world,engine}=sortingMemoryFixture(t);Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'seen',type:'CUP',x:400,y:470}];engine.readSensors();assert.equal(engine.perceivedObjects.size,1);
  engine.reset();assert.equal(engine.perceivedObjects.size,0);Object.assign(world.robot,{x:350,y:470,heading:0});Object.assign(world.objects[0],{x:400,y:470});engine.readSensors();assert.equal(engine.perceivedObjects.size,1);
  formal(engine);assert.equal(engine.perceivedObjects.size,0);Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'during-run',type:'TRASH',x:400,y:470}];engine.readSensors();engine.endRun('revision');assert.equal(engine.perceivedObjects.size,1);
  formal(engine);assert.equal(engine.perceivedObjects.size,0);
});

test('preview restores prior Vision memory and removes observations made only in preview',t=>{
  const {world,engine}=sortingMemoryFixture(t);Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'before',type:'CUP',x:400,y:470},{id:'preview-only',type:'TRASH',x:300,y:470}];
  engine.readSensors();const prior=[...engine.perceivedObjects.entries()];engine.startPreview();Object.assign(world.robot,{heading:Math.PI});engine.readSensors();assert.deepEqual([...engine.perceivedObjects.keys()],['before','preview-only']);
  engine.stopPreview();assert.deepEqual([...engine.perceivedObjects.entries()],prior);assert.equal(appState.runHistory.length,0);assert.equal(appState.canContinueStage(),false);
});
