import test from 'node:test';
import assert from 'node:assert/strict';
import {appState} from '../js/state.js';
import {PILOT_STAGES} from '../js/pilot-config.js';
import {ApartmentWorld} from '../js/sim/world.js';
import {SimulationEngine} from '../js/sim/engine.js';
import {authorStructuredSolution} from './fixtures/structured-solution.mjs';
test('three cumulative structured designs physically complete all active missions, safety, docking, charging and release',t=>{
 for(let stage=1;stage<=3;stage++){
  Object.assign(appState,new appState.constructor());appState.currentStage=stage;appState.selectedTasks=[...PILOT_STAGES[stage-1].taskIds];appState.stagePurposes[stage]=appState.createStagePurposes(stage);appState.stageResults[stage]={passingRunId:null,closingText:''};
  const world=new ApartmentWorld(),engine=new SimulationEngine(world);authorStructuredSolution(stage);assert.ok(appState.installedSensors.size<=appState.sensorBudget);assert.ok(appState.installedActuators.size<=10);engine.start();engine.pause();assert.equal(world.robot.battery,35);
  Object.assign(world.avatar,world.teleportMarkers.find(m=>m.id==='TP_LIVING'));
  let docked=false,released=false,charging=false;let lastBattery=35;
  for(let i=0;i<25000&&!engine.criteriaResults.every(c=>c.status==='Achieved')&&world.robot.battery>0;i++){
   engine.tick();assert.equal(world.checkCollision(world.robot.x,world.robot.y,world.robot.radius),false);if(world.robot.isDocked)docked=true;if(docked&&world.robot.battery>lastBattery)charging=true;if(docked&&!world.robot.isDocked)released=true;lastBattery=world.robot.battery;
  }
  const result=engine.endRun('evaluate');t.diagnostic(`Stage ${stage}: ticks=${engine.tickCount}, battery=${world.robot.battery.toFixed(2)}, docked=${docked}, charged=${charging}, released=${released}; ${JSON.stringify(result.criteria)}`);assert.equal(result.passed,true,`Stage ${stage}`);assert.ok(docked&&charging&&released);assert.deepEqual(result.tasksCompleted,appState.selectedTasks);assert.ok(result.configuration.program.length);
 }
});
