import test from 'node:test';
import assert from 'node:assert/strict';
import {appState} from '../js/state.js';
import {ApartmentWorld} from '../js/sim/world.js';
import {SimulationEngine} from '../js/sim/engine.js';
import {SessionLogger} from '../js/logging/session-log.js';

function fixture(t){
 const fresh=new appState.constructor(),saved={};
 for(const key of Object.keys(fresh)){saved[key]=appState[key];appState[key]=fresh[key];}
 t.after(()=>Object.assign(appState,saved));
 const world=new ApartmentWorld();
 Object.assign(world,{width:80,height:80,objects:[],wetCells:[],robotSpawn:{x:20,y:20}});
 world.checkCollision=(x,y,r=16)=>x<r||y<r||x>80-r||y>80-r;
 Object.assign(world.robot,{x:20,y:20,radius:8});
 world.dirtCells=[{id:'A',x:20,y:20,radius:2,cleaned:false},{id:'B',x:68,y:68,radius:2,cleaned:false}];
 const engine=new SimulationEngine(world,{criteria:{1:{dirtFraction:1}}});
 t.after(()=>engine.stop());
 return {world,engine};
}
function vacuum(world){appState.installedActuators.add('ACTUATOR_VACUUM');world.robot.vacuumActive=true;}

test('floor area and dirt removal are independent measurements',t=>{
 const {world,engine}=fixture(t);
 assert.deepEqual(engine.getCleaningMetrics(),{floorCleanedCells:0,floorTotalCells:96,floorCoveragePercent:0,dirtCleaned:0,dirtTotal:2,dirtCleanedPercent:0});
 vacuum(world);engine.updateRobotPhysics();
 assert.deepEqual(engine.getCleaningMetrics(),{floorCleanedCells:5,floorTotalCells:96,floorCoveragePercent:5.2,dirtCleaned:1,dirtTotal:2,dirtCleanedPercent:50});
 world.dirtCells[1].cleaned=true;
 assert.equal(engine.getCleaningMetrics().dirtCleanedPercent,100);
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,5);
});

test('moving or mapping without an installed active tool does not clean floor area',t=>{
 const {world,engine}=fixture(t);
 appState.installedSensors.add('SENSE_07');engine.observeCoverage();
 engine.tickStart={x:12,y:20};engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
 world.robot.vacuumActive=true;engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
 appState.installedActuators.add('ACTUATOR_VACUUM');world.robot.vacuumActive=false;engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
});

test('a cleaning sweep covers intermediate floor and repeated passes do not add area',t=>{
 const {world,engine}=fixture(t);vacuum(world);
 engine.updateRobotPhysics();assert.equal(engine.getCleaningMetrics().floorCleanedCells,5);
 engine.tickStart={x:20,y:20};world.robot.x=28;engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,8);
 for(let i=0;i<10;i++)engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,8);
});

test('a depleted robot cannot add cleaned area from lingering tool flags',t=>{
 const {world,engine}=fixture(t);vacuum(world);world.robot.battery=0;
 engine.updateRobotPhysics();assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
 world.robot.vacuumActive=false;world.robot.mopDeployed=true;appState.installedActuators.add('ACTUATOR_MOP');
 engine.updateRobotPhysics();assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
});

test('invalid vacuum on a spill does not increase coverage; a mounted mop can clean it',t=>{
 const {world,engine}=fixture(t);vacuum(world);
 world.wetCells=[{id:'W',x:20,y:20,radius:12,cleaned:false}];
 engine.updateRobotPhysics();assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
 assert.equal(engine.getCleaningMetrics().dirtCleaned,0);
 world.robot.vacuumActive=false;world.robot.mopDeployed=true;engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);
 appState.installedActuators.add('ACTUATOR_MOP');engine.updateRobotPhysics();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,5);
 assert.equal(engine.getCleaningMetrics().dirtCleaned,0);
 assert.equal(world.wetCells[0].cleaned,true);
});

test('pause and playback speed preserve measurements; reset and a fresh run clear them',t=>{
 const {world,engine}=fixture(t);engine.start();engine.pause();vacuum(world);engine.updateRobotPhysics();
 const before=engine.getCleaningMetrics();engine.pause();engine.setSpeed(5);
 assert.deepEqual(engine.getCleaningMetrics(),before);
 engine.reset();assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);assert.equal(engine.getCleaningMetrics().dirtCleaned,0);
 assert.equal(engine.getCleaningMetrics().floorTotalCells,96);
 vacuum(world);engine.updateRobotPhysics();engine.start();engine.pause();
 assert.equal(engine.getCleaningMetrics().floorCleanedCells,0);assert.equal(engine.getCleaningMetrics().dirtCleaned,0);
});

test('live preview restores the earlier measurements and static denominator',t=>{
 const {world,engine}=fixture(t);vacuum(world);engine.updateRobotPhysics();
 const before=engine.getCleaningMetrics();engine.startPreview();world.robot.x=52;engine.tick();
 assert.ok(engine.getCleaningMetrics().floorCleanedCells>before.floorCleanedCells);
 engine.stopPreview();assert.deepEqual(engine.getCleaningMetrics(),before);
 assert.equal(world.robot.x,20);
});

test('final run and exported event retain both numeric metrics after reset',t=>{
 const {world,engine}=fixture(t),logger=new SessionLogger(appState);
 engine.start();engine.pause();vacuum(world);engine.updateRobotPhysics();
 const result=engine.endRun('evaluate');
 assert.equal(result.counters.floorCleanedCells,5);assert.equal(result.counters.floorTotalCells,96);
 assert.equal(result.counters.floorCoveragePercent,5.2);assert.equal(result.counters.dirtCleanedPercent,50);
 const detail=JSON.parse(logger.events.find(e=>e.event==='RUN_ENDED').detail);
 assert.equal(detail.counters.floorCoveragePercent,5.2);assert.equal(detail.counters.dirtCleanedPercent,50);
 engine.reset();assert.equal(result.counters.floorCleanedCells,5);assert.equal(appState.runHistory[0].counters.dirtCleaned,1);
});
