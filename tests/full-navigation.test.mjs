import test from 'node:test';
import assert from 'node:assert/strict';
import {appState} from '../js/state.js';
import {ApartmentWorld} from '../js/sim/world.js';
import {SimulationEngine} from '../js/sim/engine.js';
import {StepsView} from '../js/view/steps-view.js';

test('Task 1 requires 100 percent patrol in both Thorough and Speed modes',t=>{
 const saved={...appState};Object.assign(appState,new appState.constructor());t.after(()=>Object.assign(appState,saved));
 const engine=new SimulationEngine(new ApartmentWorld());t.after(()=>engine.stop());engine.movingTicks=1;
 for(const choice of ['speed','thorough']){
  appState.setTaskPriority('TASK_1',choice);engine.navigationCoveragePercent=()=>60;engine.updateOutcomes();
  assert.notEqual(engine.criteriaResults.find(c=>c.id==='navigation').status,'Achieved',choice);
  assert.equal(engine.learnerSetting('coverageTarget'),100);
  engine.navigationCoveragePercent=()=>100;engine.updateOutcomes();assert.equal(engine.criteriaResults.find(c=>c.id==='navigation').status,'Achieved');
 }
});
test('route-only results omit unstarted cleaning metrics',t=>{
 const before=globalThis.window;t.after(()=>globalThis.window=before);
 globalThis.window={simEngine:{navigationCoveragePercent:()=>100,getCleaningMetrics:()=>({floorCoveragePercent:0,dirtCleaned:0,dirtTotal:11})}};
 const html=Object.create(StepsView.prototype).renderCriteria([{id:'navigation',label:'Visit all reachable floor area',observed:'100% visited',status:'Achieved'}],300);
 assert.match(html,/Patrol coverage/);assert.match(html,/100\.0%/);
 assert.doesNotMatch(html,/data-cleaning-metric="floor"|data-cleaning-metric="dirt"|Vacuum on clean floor/);
});
test('stage-two Speed keeps its 60 percent actual cleaning target',t=>{
 const saved={...appState};Object.assign(appState,new appState.constructor());t.after(()=>Object.assign(appState,saved));
 appState.setTaskPriority('TASK_1','speed');appState.stageResults[1].passingRunId=1;appState.continueStage();
 const engine=new SimulationEngine(new ApartmentWorld());t.after(()=>engine.stop());assert.equal(engine.learnerSetting('coverageTarget'),60);
 engine.getCleaningMetrics=()=>({floorCleanedCells:60,floorTotalCells:100,floorCoveragePercent:60,dirtCleaned:0,dirtTotal:11});engine.updateOutcomes();assert.equal(engine.criteriaResults.find(c=>c.id==='cleaning').status,'Achieved');
});
