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
function editor() {
  const container={zone:{scrollTop:420},list:{scrollTop:170,dataset:{shelf:'Action'}},html:'',
    get innerHTML(){return this.html;},set innerHTML(html){this.html=html;this.zone={scrollTop:0};this.list={scrollTop:0,dataset:{shelf:'Action'}};},
    querySelector(selector){return selector==='.task-zones-column'?this.zone:selector==='.palette-list'?this.list:{};},
    querySelectorAll(){return [];}};
  const view=Object.create(BlockCanvasView.prototype);view.container=container;view.activeShelf='Action';view.selectedBlockForPlacement={id:'ACT_22'};
  return {view,container};
}

test('adding empty rules keeps unlocked task groups; removing one preserves neighbors and never removes a sole row',t=>{
  fixture(t);const state=appState;
  assert.equal(typeof state.addRule,'function');
  const original=state.rules[1];author(original,{sense:'SENSE_15',action:'ACT_13'});
  const added=state.addRule('TASK_2');assert.equal(added.taskId,'TASK_2');assert.notEqual(added.id,original.id);
  assert.deepEqual(Object.values(added.slots),[null,null,null,null,null,null]);
  const {view,container}=editor();view.render();
  assert.equal((container.html.match(/class="task-zone-card"/g)||[]).length,2);
  assert.equal((container.html.match(/class="rule-row"/g)||[]).length,3);
  assert.match(container.html,/Rule 2/);assert.match(container.html,/aria-label="Add rule for Pick up and sort scattered objects/);
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

test('two authored TASK_2 rules pick up, carry and correctly release without using another task zone',t=>{
  const {world}=fixture(t);assert.equal(typeof appState.addRule,'function');
  appState.installedSensors=new Set(['SENSE_15','SENSE_03']);appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']);
  Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'one',type:'TRASH',x:375,y:470,carried:false,disposed:false}];Object.assign(world.smartBin,{x:420,y:510});world.cat.state='pause';world.cat.pauseTimer=10000;
  const pickup=appState.rules[1],drop=appState.addRule('TASK_2');author(pickup,{sense:'SENSE_15',condition:'COND_16',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});author(drop,{sense:'SENSE_03',condition:'COND_10',action:'ACT_15',priority:'CTRL_05'});
  const logger=new SessionLogger(appState),engine=new SimulationEngine(world);let carried=false;const fired=new Set();
  for(let i=0;i<100;i++){engine.tick();if(world.robot.heldObject){carried=true;assert.ok(Math.hypot(world.robot.heldObject.x-world.robot.x,world.robot.heldObject.y-world.robot.y)<26);}if(engine.activeRuleFired)fired.add(engine.activeRuleFired.ruleId);}
  assert.equal(carried,true);assert.equal(engine.pickups,1);assert.equal(engine.releases,1);assert.equal(world.objects[0].sorted,true);assert.equal(engine.taskOutcomes[1].status,'done');assert.deepEqual(fired,new Set([pickup.id,drop.id]));
  assert.ok(appState.rules.filter(r=>r.taskId!=='TASK_2').every(r=>Object.values(r.slots).every(v=>v===null)));
  for(const e of logger.events.filter(e=>e.event==='RULE_FIRED')){const d=JSON.parse(e.detail);assert.equal(e.target_id,d.ruleId);assert.equal(d.taskId,'TASK_2');assert.ok(fired.has(d.ruleId));}
});

test('attempt counts remain distinct unlocked tasks in editor and Step5; stage completion includes cleaning',t=>{
  const {world}=fixture(t);assert.equal(typeof appState.addRule,'function');const first=appState.rules[1];author(first,{sense:'SENSE_15',action:'ACT_13'});
  for(let i=0;i<8;i++)author(appState.addRule('TASK_2'),{sense:'SENSE_03',action:'ACT_15'});
  assert.deepEqual(appState.getAttemptedTaskIds(),['TASK_2']);
  const {view,container}=editor();view.render();const priorWindow=globalThis.window;globalThis.window={navigateStep(){}};t.after(()=>globalThis.window=priorWindow);
  // Retain one node per selector for handler output.
  const nodes={};container.querySelector=selector=>selector==='.task-zones-column'?container.zone:selector==='.palette-list'?container.list:(nodes[selector] ||= {});view.attachEvents();nodes['.rule-continue'].onclick();assert.equal(nodes['.rule-attempt-count'].textContent,'Rules configured for 1 current task.');
  const engine=new SimulationEngine(world);window.simEngine=engine;
  const steps=Object.create(StepsView.prototype);steps.panel={innerHTML:'',querySelector:selector=>selector==='#runTrace'?null:{},querySelectorAll:()=>[]};steps.renderStep5();assert.match(steps.panel.innerHTML,/Rules configured for 1 current task/);
  world.objects.forEach(o=>o.sorted=true);world.dirtCells.forEach(d=>d.cleaned=true);engine.runActive=true;engine.elapsedSeconds=0.5;engine.updateOutcomes();assert.equal(engine.completionSeconds,0.5);
  for(const r of appState.rules)author(r,{sense:'SENSE_02',action:'ACT_18'});assert.equal(appState.getAttemptedTaskIds().length,2);
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

test('editing, adding and removing retain selected library category, block and both scroll positions',t=>{
  fixture(t);assert.equal(typeof appState.addRule,'function');const {view,container}=editor();const off=appState.on('rulesChanged',()=>view.render());t.after(off);
  view.render();const added=appState.addRule('TASK_6');author(added,{action:'ACT_22'});appState.removeRule(added.id);
  assert.equal(view.activeShelf,'Action');assert.equal(view.selectedBlockForPlacement.id,'ACT_22');assert.equal(container.zone.scrollTop,420);assert.equal(container.list.scrollTop,170);assert.equal((container.html.match(/role="tab"/g)||[]).length,4);
});

test('trace highlights only the stable fired row even when two rows share an action and THEN fires',t=>{
  fixture(t);const first=appState.rules[0],second=appState.rules[1];author(first,{sense:'SENSE_02',action:'ACT_18'});author(second,{sense:'SENSE_02',action:'ACT_18'});
  const rows=[first,second].map(rule=>({dataset:{ruleId:rule.id,taskIndex:String(appState.rules.indexOf(rule))},classList:{toggle(_class,active){this.active=active;}}}));
  const view=Object.create(BlockCanvasView.prototype);view.container={querySelector:()=>null,querySelectorAll:()=>rows};const prior=globalThis.window;globalThis.window={};t.after(()=>globalThis.window=prior);
  view.updateTracePulse({ruleId:second.id,action:'ACT_18'});assert.deepEqual(rows.map(r=>r.classList.active),[false,true]);
  view.updateTracePulse({ruleId:first.id,action:'ACT_20'});assert.deepEqual(rows.map(r=>r.classList.active),[true,false]);
});

test('Add, Remove and placement handlers update only their named task and stable row after indices shift',t=>{
  fixture(t);
  const original=appState.rules[1],last=appState.rules[5];
  const add={dataset:{taskId:'TASK_2'}},remove={dataset:{ruleId:original.id}};
  const slot={dataset:{ruleId:last.id,slot:'action'},querySelector:()=>null};
  const view=Object.create(BlockCanvasView.prototype);view.selectedBlockForPlacement={id:'ACT_22',kind:'Action'};
  view.container={querySelector:()=>({}),querySelectorAll:selector=>({'.add-rule':[add],'.remove-rule':[remove],'.slot-container':[slot]}[selector]||[])};
  view.attachEvents();add.onclick();
  assert.equal(appState.rules.filter(r=>r.taskId==='TASK_2').length,2);
  assert.equal(appState.rules.filter(r=>r.taskId!=='TASK_2').length,5);
  const added=appState.rules.find(r=>r.taskId==='TASK_2'&&r.id!==original.id);
  assert.ok(Object.values(added.slots).every(v=>v===null));
  slot.onclick({target:{closest:()=>null}});assert.equal(last.slots.action,'ACT_22');assert.equal(added.slots.action,null);
  remove.onclick();assert.equal(appState.rules.some(r=>r.id===original.id),false);assert.equal(appState.rules.some(r=>r.id===added.id),true);assert.equal(last.slots.action,'ACT_22');
  remove.dataset.ruleId=added.id;remove.onclick();assert.equal(appState.rules.filter(r=>r.taskId==='TASK_2').length,1);
});
