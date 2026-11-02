import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { BlockCanvasView } from '../js/view/block-canvas.js';
import { StepsView } from '../js/view/steps-view.js';
import { SimulationEngine } from '../js/sim/engine.js';
import { ApartmentWorld } from '../js/sim/world.js';
import { SessionLogger } from '../js/logging/session-log.js';

function fixture(t) {
  const saved = { currentStage:appState.currentStage, selectedTasks:appState.selectedTasks, stagePurposes:appState.stagePurposes, stageResults:appState.stageResults, rules:appState.rules, nextRuleId:appState.nextRuleId, rulesRevision:appState.rulesRevision, installedSensors:appState.installedSensors, installedActuators:appState.installedActuators };
  const fresh = new appState.constructor(); Object.keys(saved).forEach(key=>appState[key]=fresh[key]);
  appState.currentStage=2;appState.selectedTasks=['TASK_1','TASK_2'];appState.stagePurposes[2]=appState.createStagePurposes(2);appState.stageResults[2]={passingRunId:null,closingText:''};
  t.after(()=>Object.assign(appState,saved));
  return {world:new ApartmentWorld()};
}
function author(rule, slots) { for (const [slot,block] of Object.entries(slots)) appState.setRuleSlot(rule.id,slot,block); }
test('adding empty rules keeps unlocked task groups; removing one preserves neighbors and never removes a sole row',t=>{
  fixture(t);const state=appState;
  assert.equal(typeof state.addRule,'function');
  const original=state.rules[1];author(original,{sense:'SENSE_15',action:'ACT_13'});
  const added=state.addRule('TASK_2');assert.equal(added.taskId,'TASK_2');assert.notEqual(added.id,original.id);
  assert.deepEqual(Object.values(added.slots),[null,null,null,null,null,null]);
  assert.equal(state.removeRule(added.id),true);assert.equal(original.slots.action,'ACT_13');
  assert.equal(state.removeRule(original.id),false);assert.equal(state.rules.length,6);
  const replacement=state.addRule('TASK_2');assert.notEqual(replacement.id,added.id);
  assert.equal(state.addRule('TASK_99'),false);
});

test('rule configuration logs retain stable task/rule identity, removed slots and the five-column CSV',t=>{
  fixture(t);assert.equal(typeof appState.addRule,'function');const logger=new SessionLogger(appState);
  const row=appState.addRule('TASK_2');author(row,{sense:'SENSE_15',action:'ACT_13'});appState.clearRuleSlot(row.id,'sense');appState.removeRule(row.id);
  const events=logger.events.map(e=>({...e,detail:JSON.parse(e.detail)}));
  assert.deepEqual(events.filter(e=>e.event==='RULE_ADDED').map(e=>[e.target_id,e.detail.taskId]),[[row.id,'TASK_2']]);
  for(const e of events.filter(e=>e.event.startsWith('BLOCK_'))){assert.equal(e.detail.ruleId,row.id);assert.equal(e.detail.taskId,'TASK_2');}
  const removed=events.find(e=>e.event==='RULE_REMOVED');assert.equal(removed.target_id,row.id);assert.equal(removed.detail.slots.action,'ACT_13');
  assert.equal(logger.exportCSV().split('\r\n')[0],'timestamp,step,event,target_id,detail');
});

test('authored TASK_2 rules choose a goal, pick up, carry and correctly release without using another task zone',t=>{
  const {world}=fixture(t);assert.equal(typeof appState.addRule,'function');
  appState.installedSensors=new Set(['SENSE_15','SENSE_03']);appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']);
  Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'one',type:'TRASH',x:375,y:470,carried:false,disposed:false}];Object.assign(world.smartBin,{x:420,y:510});world.cat.state='pause';world.cat.pauseTimer=10000;
  const pickup=appState.rules[1],drop=appState.addRule('TASK_2');author(pickup,{sense:'SENSE_15',condition:'COND_16',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});author(drop,{sense:'SENSE_03',condition:'COND_10',action:'ACT_15',priority:'CTRL_05'});
  const choose=appState.addRule('TASK_2');author(choose,{sense:'SENSE_15',condition:'COND_16',action:'ACT_24',priority:'CTRL_05'});
  const logger=new SessionLogger(appState),engine=new SimulationEngine(world);let carried=false;const fired=new Set();
  for(let i=0;i<100;i++){engine.tick();if(world.robot.heldObject){carried=true;assert.ok(Math.hypot(world.robot.heldObject.x-world.robot.x,world.robot.heldObject.y-world.robot.y)<26);}if(engine.activeRuleFired)fired.add(engine.activeRuleFired.ruleId);}
  assert.equal(carried,true);assert.equal(engine.pickups,1);assert.equal(engine.releases,1);assert.equal(world.objects[0].sorted,true);assert.equal(engine.taskOutcomes[1].status,'done');assert.deepEqual(fired,new Set([pickup.id,drop.id,choose.id]));
  assert.ok(appState.rules.filter(r=>r.taskId!=='TASK_2').every(r=>Object.values(r.slots).every(v=>v===null)));
  for(const e of logger.events.filter(e=>e.event==='RULE_FIRED')){const d=JSON.parse(e.detail);assert.equal(e.target_id,d.ruleId);assert.equal(d.taskId,'TASK_2');assert.ok(fired.has(d.ruleId));}
});

test('attempt counts distinguish active authored mission and common programs; duplicate behaviors count once',t=>{
  const {world}=fixture(t);appState.selectedTasks=['TASK_1','TASK_3','TASK_4','TASK_5','TASK_6'];
  const b=(id,taskId)=>({id,type:'behavior',taskId,priority:1,body:[{id:id+'a',type:'action',command:'ACT_18'}]});
  appState.setProgram([b('one','TASK_1'),b('two','TASK_1'),b('cat','TASK_4'),b('locked','TASK_2')]);
  assert.deepEqual(appState.getAttemptedTaskIds(),['TASK_1','TASK_4']);appState.program=[];
});

test('removed or shifted identical THEN rows cannot inherit another row continuation, including preview restore',t=>{
  const {world}=fixture(t);assert.equal(typeof appState.addRule,'function');appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');
  const first=appState.rules[1],next=appState.addRule('TASK_2');const slots={sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control:'CTRL_04',secondaryAction:'ACT_20'};author(first,slots);author(next,slots);
  const engine=new SimulationEngine(world);engine.tick();assert.equal(engine.activeRuleFired.ruleId,first.id);appState.removeRule(first.id);engine.tick();assert.equal(engine.activeRuleFired.ruleId,next.id);assert.equal(engine.activeRuleFired.action,'ACT_18');
  engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_20');
  appState.addRule('TASK_2');engine.startPreview();engine.tick();appState.removeRule(next.id);engine.stopPreview();engine.tick();assert.equal(engine.activeRuleFired,null);
});

test('WAIT starts fresh for an identical neighboring row after the original row is removed',t=>{
  const {world}=fixture(t);assert.equal(typeof appState.addRule,'function');appState.installedSensors.add('SENSE_02');
  const first=appState.rules[1],next=appState.addRule('TASK_2');const slots={sense:'SENSE_02',action:'ACT_18',control:'CTRL_03'};author(first,slots);author(next,slots);const engine=new SimulationEngine(world);
  for(let i=0;i<20;i++)engine.tick();appState.removeRule(first.id);engine.tick();assert.equal(engine.activeRuleFired,null);
  for(let i=0;i<19;i++)engine.tick();assert.equal(engine.activeRuleFired,null);engine.tick();assert.equal(engine.activeRuleFired.ruleId,next.id);
});

test('live execution highlights the stable AST node, not every occurrence of its action',t=>{
  fixture(t);const highlighted=[];const view=Object.create(BlockCanvasView.prototype);view.workspace={highlightBlock:id=>highlighted.push(id)};view.container={querySelector:()=>null};const prior=globalThis.window;globalThis.window={};t.after(()=>globalThis.window=prior);
  view.updateTracePulse({nodeId:'first',action:'ACT_18'});view.updateTracePulse({nodeId:'second',action:'ACT_18'});view.updateTracePulse({});assert.deepEqual(highlighted,['first','second',null]);
});
