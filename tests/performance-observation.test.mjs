import test from 'node:test';
import assert from 'node:assert/strict';
import {appState} from '../js/state.js';
import {TASK_PURPOSES} from '../js/pilot-config.js';
import {ApartmentWorld} from '../js/sim/world.js';
import {SimulationEngine} from '../js/sim/engine.js';

test('Performance measurement keeps Thorough cleaning and Speed from Task 1 onward',()=>{
 assert.deepEqual(TASK_PURPOSES.TASK_1.priorities,[['thorough','Thorough cleaning'],['speed','Speed']]);
 const state=new appState.constructor();assert.equal(state.canContinue(1),false);
 assert.equal(state.setTaskPriority('TASK_1','speed'),true);assert.equal(state.canContinue(1),true);
 state.stageResults[1].passingRunId=1;state.continueStage();
 assert.equal(state.stagePurposes[2].TASK_1.priority,'speed');assert.equal(state.stagePurposes[2].TASK_2.priority,'speed');assert.equal(state.canContinue(1),true);
 state.setTaskPriority('TASK_1','thorough');assert.equal(state.stagePurposes[2].TASK_2.priority,'thorough');
});
test('selected measurement is readable by learner rules during Navigation',t=>{
 const saved={...appState};Object.assign(appState,new appState.constructor());t.after(()=>Object.assign(appState,saved));
 const engine=new SimulationEngine(new ApartmentWorld());t.after(()=>engine.stop());
 appState.setTaskPriority('TASK_1','speed');assert.equal(engine.learnerSetting('mode'),'speed');assert.equal(engine.learnerSetting('coverageTarget'),100);
 appState.setTaskPriority('TASK_1','thorough');assert.equal(engine.learnerSetting('coverageTarget'),100);
});
test('3D 360 observation credits only nearby, visible points and never all points from the camera',()=>{
 const state=new appState.constructor(),world={avatar:{x:130,y:645},dirtCells:[{id:'NEAR',x:130,y:645},{id:'FAR',x:900,y:100}],wetCells:[],objects:[],dock:{x:900,y:100},cat:{x:900,y:100}};
 state.configureEnvironment(world);state.setTaskPriority('TASK_1','thorough');state.setStep(2);
 state.observeEnvironment(world,'3d');assert.equal(state.observedEnvironmentTargets.has('NEAR'),true);assert.equal(state.observedEnvironmentTargets.has('FAR'),false);
 assert.equal(state.observedEnvironmentTargets.has('PERSON'),true);
 const count=state.observedEnvironmentTargets.size;state.observeEnvironment(world,'3d');assert.equal(state.observedEnvironmentTargets.size,count);
 world.dirtCells.push({id:'WALL',x:500,y:380});state.configureEnvironment(world);Object.assign(world.avatar,{x:440,y:380});state.observeEnvironment(world,'3d');assert.equal(state.observedEnvironmentTargets.has('WALL'),false);
 state.isRobotPovActive=true;Object.assign(world.avatar,{x:900,y:100});state.observeEnvironment(world,'3d');assert.equal(state.observedEnvironmentTargets.has('FAR'),false);
});
