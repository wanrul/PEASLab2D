import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { ACTION_BLOCKS } from '../js/data/blocks.js';
import { SimulationEngine } from '../js/sim/engine.js';
import { ApartmentWorld } from '../js/sim/world.js';
import { BlockCanvasView, acceptsBlock } from '../js/view/block-canvas.js';

function fixture(options) {
  appState.installedSensors = new Set(); appState.installedActuators = new Set();
  appState.rules.forEach(r => r.slots = {sense:null,condition:null,action:null,control:null,secondaryAction:null});
  appState.currentStage=1;appState.selectedTasks=['TASK_1'];appState.stageResults={1:{passingRunId:null,closingText:''}};
  appState.sessionFinished=false; appState.weights={Coverage:40,Safety:20,Time:20,Hazard:20};
  const world=new ApartmentWorld(),engine=new SimulationEngine(world,options);
  world.cat.state='pause';world.cat.pauseTimer=10000;
  return {world,engine,robot:world.robot};
}
function rule(index,slots){Object.assign(appState.rules[index].slots,slots);}
const body=()=>appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION']);
const action=(engine,id)=>engine.executeAction({action:id,ruleIndex:0,trace:{action:id}});

test('body explores without task rules and needs both locomotion modules even for MOVE',()=>{
  for(const modules of [[],['ACTUATOR_WHEELS'],['ACTUATOR_ROTATION'],['ACTUATOR_WHEELS','ACTUATOR_ROTATION']]){
    const {world,engine,robot}=fixture();appState.installedActuators=new Set(modules);
    const before={x:robot.x,y:robot.y};engine.tick();
    assert.equal(Math.hypot(robot.x-before.x,robot.y-before.y)>0,modules.length===2);
    if(modules.length===1){action(engine,'ACT_01');assert.deepEqual({x:robot.x,y:robot.y},before);}
  }
});
test('navigation targets only mounted perception and vision selects nearest visible object',()=>{
  const {world,engine,robot}=fixture();body();Object.assign(robot,{x:350,y:400,heading:0});
  world.dirtCells=[{x:robot.x,y:robot.y+100,radius:12,cleaned:false}];world.objects=[];
  engine.tick();assert.equal(robot.heading,0);
  appState.installedSensors.add('SENSE_07');engine.tick();assert.ok(robot.heading>1);
  robot.heading=0;world.objects=[{id:'far',x:robot.x+100,y:robot.y,type:'TRASH'},{id:'near',x:robot.x+40,y:robot.y,type:'CUP'}];
  appState.installedSensors=new Set(['SENSE_15']);assert.equal(engine.readSensors().visibleObject.id,'near');
});
test('all catalog actions are gated and missing modules have an observable trace',()=>{
  for(const block of ACTION_BLOCKS){const {world,engine}=fixture();const before=JSON.stringify(world);assert.equal(action(engine,block.id),false,block.id);assert.equal(JSON.stringify({...world,robot:{...world.robot,traceState:JSON.parse(before).robot.traceState}}),before,block.id);assert.match(engine.lastTrace.act,/no actuator/i);}
});
test('unmounted senses and built-in collision reflex never impersonate learner rules',()=>{
  const {world,engine,robot}=fixture();rule(0,{sense:'SENSE_05',condition:'COND_03',action:'ACT_09'});
  engine.tick();assert.match(engine.lastTrace.sense,/Floor Dirt Sensor.*not mounted/);
  body();robot.heading=0;world.resolveMove=()=>({x:robot.x,y:robot.y,moved:false});engine.tick();assert.match(engine.lastTrace.act,/built-in reflex/);assert.equal(engine.activeRuleFired,null);
});
test('WAIT matures after20 ticks without re-starting; WHILE and UNTIL repeat only while condition holds',()=>{
  for(const control of ['CTRL_03','CTRL_01','CTRL_02']){
    const {engine}=fixture();appState.installedSensors.add('SENSE_02');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control});
    if(control==='CTRL_03'){for(let i=0;i<20;i++){engine.tickCount=i;assert.equal(engine.evaluateRules(engine.readSensors()),null);}engine.tickCount=20;}
    assert.equal(engine.evaluateRules(engine.readSensors()).action,'ACT_18');engine.tickCount++;assert.equal(engine.evaluateRules(engine.readSensors()).action,'ACT_18');engine.world.robot.battery=20;assert.equal(engine.evaluateRules(engine.readSensors()),null);
  }
});
test('THEN second action runs on the next tick ahead of a continually firing primary; HIGH can preempt',()=>{
  const {engine}=fixture();appState.selectedTasks=['TASK_1','TASK_2'];appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control:'CTRL_04',secondaryAction:'ACT_20'});
  engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_18');engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_20');
  rule(1,{sense:'SENSE_02',condition:'COND_09',action:'ACT_19',priority:'CTRL_05'});engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_19');
});
test('THEN editor exposes a typed second action and permits an unmounted action',()=>{
  const state=new appState.constructor();state.setRuleSlot(0,'control','CTRL_04');assert.equal(state.setRuleSlot(0,'secondaryAction','ACT_15'),true);assert.equal(state.setRuleSlot(0,'secondaryAction','SENSE_01'),false);
  assert.equal(acceptsBlock('secondaryAction',ACTION_BLOCKS[0]),true);
  const view=Object.create(BlockCanvasView.prototype);assert.match(view.renderTaskZone(state.rules[0],0),/data-slot="secondaryAction"/);
  state.setRuleSlot(0,'control',null);assert.doesNotMatch(view.renderTaskZone(state.rules[0],0),/data-slot="secondaryAction"/);
});
test('destination sensor follows held object and dock request, connector never teleports',()=>{
  const {world,engine,robot}=fixture();appState.selectedTasks=['TASK_1','TASK_2','TASK_6'];appState.installedSensors.add('SENSE_03');robot.heldObject=world.objects[0];
  assert.equal(engine.readSensors().SENSE_03.target,'BIN');robot.heldObject={type:'CUP'};assert.equal(engine.readSensors().SENSE_03.target,'SINK');robot.heldObject=null;
  appState.installedActuators.add('ACTUATOR_DOCK_PIN');const before={x:robot.x,y:robot.y};action(engine,'ACT_17');assert.equal(engine.readSensors().SENSE_03.target,'DOCK');assert.equal(robot.isDocked,false);assert.deepEqual({x:robot.x,y:robot.y},before);
  Object.assign(robot,world.dock);action(engine,'ACT_17');assert.equal(robot.isCharging,true);
});
test('released objects remain at drop point and only correct destinations count as sorted',()=>{
  const {world,engine,robot}=fixture();appState.installedActuators.add('ACTUATOR_GRIP_OPEN');const obj=world.objects[0];robot.heldObject=obj;obj.carried=true;
  Object.assign(robot,{x:world.depositTable.x,y:world.depositTable.y});action(engine,'ACT_15');assert.equal(obj.disposed,false);assert.equal(obj.x,robot.x);assert.equal(engine.wrongReleases,1);
  robot.heldObject=obj;obj.carried=true;Object.assign(robot,{x:world.smartBin.x,y:world.smartBin.y});action(engine,'ACT_15');assert.equal(obj.sorted,true);assert.equal(world.smartBin.isOpen,true);engine.computeScores();assert.equal(engine.scores.coverage,8);
});
test('safety penalties count moving encounters, not stationary ticks or continuous passes',()=>{
  const {world,engine,robot}=fixture();Object.assign(world.cat,{x:robot.x,y:robot.y});Object.assign(world.avatar,{x:robot.x,y:robot.y});
  for(let i=0;i<5;i++)engine.tick();assert.equal(engine.catSafetyViolations,0);assert.equal(engine.humanSafetyViolations,0);
  body();for(let i=0;i<3;i++)engine.tick();assert.equal(engine.catSafetyViolations,1);assert.equal(engine.humanSafetyViolations,1);assert.equal(engine.scores.safety,87);
});
test('vacuum-on-spill is an encounter and continuous installed tools affect the world',()=>{
  const {world,engine,robot}=fixture();world.wetCells=[{id:'wet',x:robot.x,y:robot.y,radius:24,cleaned:false}];appState.installedActuators.add('ACTUATOR_VACUUM');action(engine,'ACT_09');
  for(let i=0;i<5;i++)engine.tick();assert.equal(engine.vacuumLiquidMistakes,1);
  robot.x+=100;engine.tick();robot.x-=100;engine.tick();assert.equal(engine.vacuumLiquidMistakes,2);
});
test('only unlocked outcomes are live, non-vacuous, and included in end snapshot and CSV event',()=>{
  const {engine}=fixture();assert.deepEqual(engine.taskOutcomes.map(t=>t.status),['not_started']);
  engine.start();engine.stop();engine.tick();const snapshot=engine.endRun();assert.equal(snapshot.outcomes.length,1);assert.deepEqual(snapshot.tasksCompleted,[]);assert.equal(snapshot.outcomes[0].summary,'Never vacuumed.');assert.equal(snapshot.durationMs,100);
});
test('Time measures simulation ticks, ignores battery/speed/pause and decreases only overtime',()=>{
  const {engine,robot}=fixture({runLimitSeconds:2});engine.start();engine.stop();robot.battery=10;engine.setSpeed(5);for(let i=0;i<20;i++)engine.tick();assert.equal(engine.scores.time,100);engine.tick();assert.equal(engine.scores.time,95);assert.equal(engine.runActive,true);const end=engine.endRun();assert.equal(end.elapsedSeconds,2.1);
});
test('reset restores task objects, tool flags, outcome counters, controls and preview state',()=>{
  const {world,engine,robot}=fixture();const original=JSON.stringify(world);engine.startPreview();engine.tick();engine.stopPreview();assert.equal(JSON.stringify(world),original);assert.equal(engine.elapsedSeconds,0);
  robot.isDocked=true;robot.isCharging=true;robot.isStopped=true;world.objects[0].x=robot.x+100;world.objects[0].sorted=true;engine.wrongReleases=4;engine.reset();assert.equal(robot.isDocked,false);assert.equal(robot.isCharging,false);assert.equal(robot.isStopped,false);assert.equal(engine.wrongReleases,0);assert.equal(world.objects[0].sorted,false);assert.deepEqual(engine.taskOutcomes.map(t=>t.status),['not_started']);
});
test('all cleaning targets and stations have collision-free robot centers',()=>{
  const {world}=fixture();for(const target of [...world.dirtCells,...world.wetCells,...world.objects,world.smartBin,world.depositTable])assert.equal(world.checkCollision(target.x,target.y,20),false,JSON.stringify(target));
});

test('Safety success reports actual stop/slow responses, not merely moving within sensing range',()=>{
  const {engine,robot,world}=fixture();body();Object.assign(world.cat,{x:robot.x+70,y:robot.y});Object.assign(world.avatar,{x:robot.x+100,y:robot.y});engine.tick();
  assert.notEqual(engine.updateOutcomes(true)?.[3]?.status,'done');assert.equal(engine.catResponses,0);assert.equal(engine.humanResponses,0);assert.deepEqual(engine.taskOutcomes.map(o=>o.taskId),['TASK_1']);
});
test('a late safety failure revokes an earlier within-limit completion for Time',()=>{
  const {engine,robot}=fixture({runLimitSeconds:1});rule(0,{sense:'SENSE_05',action:'ACT_09'});engine.runActive=true;engine.elapsedSeconds=0.5;engine.world.dirtCells.forEach(d=>d.cleaned=true);engine.updateOutcomes();engine.computeScores();assert.equal(engine.scores.time,100);
  engine.world.dirtCells[0].cleaned=false;engine.elapsedSeconds=2;engine.updateOutcomes();engine.computeScores();assert.equal(engine.scores.time,0);
});
test('a rule-driven two-chain sorting design collects, carries, releases and completes sorting',()=>{
  const {world,engine,robot}=fixture();appState.selectedTasks=['TASK_1','TASK_2'];body();appState.installedSensors=new Set(['SENSE_15','SENSE_03']);for(const id of ['ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN'])appState.installedActuators.add(id);
  Object.assign(robot,{x:350,y:470,heading:0});world.objects=[{id:'one',type:'TRASH',x:375,y:470,carried:false,disposed:false}];Object.assign(world.smartBin,{x:420,y:510});
  rule(0,{sense:'SENSE_15',condition:'COND_16',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});rule(1,{sense:'SENSE_03',condition:'COND_10',action:'ACT_15',priority:'CTRL_05'});
  let carried=false;for(let i=0;i<100;i++){engine.tick();if(robot.heldObject){carried=true;assert.ok(Math.hypot(robot.heldObject.x-robot.x,robot.heldObject.y-robot.y)<26);}}
  assert.equal(carried,true);assert.equal(world.objects[0].sorted,true);assert.equal(engine.pickups,1);assert.equal(engine.releases,1);assert.equal(engine.taskOutcomes[1].status,'done');
});
test('end-of-run incomplete attempts fail, and the next run begins with a fresh Time baseline',()=>{
  const {engine}=fixture({runLimitSeconds:0.1});appState.installedActuators.add('ACTUATOR_VACUUM');appState.installedSensors.add('SENSE_02');rule(0,{sense:'SENSE_02',action:'ACT_09'});
  engine.start();engine.stop();engine.tick();engine.tick();const ended=engine.endRun();assert.equal(ended.outcomes[0].status,'failed');assert.equal(ended.passed,false);assert.ok(!('scores' in ended));engine.start();engine.stop();assert.equal(engine.runBaseline.time,100);engine.endRun();
});
test('missing Body Rotation is explicit when an otherwise mounted MOVE action cannot move',()=>{
  const {engine}=fixture();appState.installedActuators.add('ACTUATOR_WHEELS');assert.equal(action(engine,'ACT_01'),false);assert.match(engine.lastTrace.act,/no actuator/);
});
test('all task targets lie in the robot-accessible apartment component',()=>{
  const {world}=fixture(),size=8,valid=new Set();for(let x=0;x<1250;x+=size)for(let y=0;y<1200;y+=size)if(!world.checkCollision(x,y,20))valid.add(`${x},${y}`);
  const distance=(key,p)=>{const [x,y]=key.split(',').map(Number);return Math.hypot(x-p.x,y-p.y);};const seed=[...valid].sort((a,b)=>distance(a,world.robot)-distance(b,world.robot))[0],queue=[seed],reachable=new Set([seed]);
  for(let i=0;i<queue.length;i++){const [x,y]=queue[i].split(',').map(Number);for(const [dx,dy]of[[8,0],[-8,0],[0,8],[0,-8]]){const key=`${x+dx},${y+dy}`;if(!valid.has(key)||reachable.has(key))continue;const move=world.resolveMove(x,y,dx,dy,20);if(Math.hypot(move.x-x-dx,move.y-y-dy)>0.001)continue;reachable.add(key);queue.push(key);}}
  for(const target of [...world.dirtCells,...world.wetCells,...world.objects,world.smartBin,world.depositTable,world.dock])assert.ok([...reachable].some(key=>distance(key,target)<12),target.id||'station');
});
test('mounted map navigation cleans every real-apartment dirt cell through normal doors',()=>{
  const {world,engine,robot}=fixture();body();appState.installedActuators.add('ACTUATOR_VACUUM');appState.installedSensors=new Set(['SENSE_07','SENSE_05']);rule(0,{sense:'SENSE_05',condition:'COND_03',action:'ACT_09'});
  for(let tick=0;tick<12000&&!world.dirtCells.every(d=>d.cleaned);tick++){robot.battery=100;engine.tick();assert.equal(world.checkCollision(robot.x,robot.y,robot.radius),false);}
  assert.equal(world.dirtCells.filter(d=>d.cleaned).length,17);
});
test('THEN still attempts its next action after the primary lacks an actuator',()=>{
  const {engine,robot}=fixture();appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_09',control:'CTRL_04',secondaryAction:'ACT_18'});
  engine.tick();assert.match(engine.lastTrace.act,/no actuator/);engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_18');assert.match(robot.ledColor,/239, 68, 68/);
});
test('reset restores NPC motion, battery, and initial simulation tool state',()=>{
  const {world,engine,robot}=fixture();const originalCat={x:world.cat.x,y:world.cat.y};world.cat.x+=100;world.cat.targetIndex=3;robot.battery=0;engine.reset();assert.deepEqual({x:world.cat.x,y:world.cat.y},originalCat);assert.equal(robot.battery,100);assert.equal(world.cat.targetIndex,0);
});
test('a built-in collision reflex preserves the missing-actuator failure in the same tick',()=>{
  const {world,engine,robot}=fixture();body();appState.installedSensors.add('SENSE_02');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_09'});world.resolveMove=()=>({x:robot.x,y:robot.y,moved:false});engine.tick();assert.match(engine.lastTrace.act,/VACUUM ON.*no actuator/);assert.match(engine.lastTrace.act,/built-in reflex/);
});
test('timer condition uses an explicit researcher speed target rather than the old scoring limit',()=>{
  const {engine}=fixture({criteria:{1:{dirtFraction:1,speedLimitSeconds:2},2:{dirtFraction:1,sortedFraction:1,speedLimitSeconds:null}}});appState.installedSensors.add('SENSE_12');rule(0,{sense:'SENSE_12',condition:'COND_18',action:'ACT_18'});engine.tickCount=21;assert.equal(engine.evaluateRules(engine.readSensors()).action,'ACT_18');
});

test('mounted map navigation cleans current dirt while locked spill rules remain inactive',()=>{
  const {world,engine,robot}=fixture();body();for(const id of ['ACTUATOR_VACUUM','ACTUATOR_MOP'])appState.installedActuators.add(id);appState.installedSensors=new Set(['SENSE_07','SENSE_05','SENSE_06']);
  rule(0,{sense:'SENSE_05',condition:'COND_03',action:'ACT_09'});rule(2,{sense:'SENSE_06',condition:'COND_04',action:'ACT_11'});
  for(let tick=0;tick<12000&&(!world.dirtCells.every(d=>d.cleaned));tick++){robot.battery=100;engine.tick();assert.equal(world.checkCollision(robot.x,robot.y,robot.radius),false);}
  assert.equal(world.dirtCells.filter(d=>d.cleaned).length,17);assert.equal(world.wetCells.filter(w=>w.cleaned).length,0);assert.equal(engine.mopTicks,0);assert.ok(engine.taskOutcomes.every(o=>o.taskId==='TASK_1'));
  // The full action library still has physical effects when authored in an unlocked task.
  rule(0,{sense:'SENSE_06',condition:'COND_04',action:'ACT_11'});Object.assign(robot,{x:world.wetCells[0].x,y:world.wetCells[0].y});engine.tick();assert.ok(engine.mopTicks>0);assert.equal(world.wetCells[0].cleaned,true);
});
test('fresh formal runs discard a previous run THEN queue after a sensor revision',()=>{
  const {engine,robot}=fixture();appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control:'CTRL_04',secondaryAction:'ACT_20'});
  engine.start();engine.pause();engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_18');engine.endRun('revision');appState.installedSensors.delete('SENSE_02');engine.start();engine.pause();engine.tick();assert.equal(engine.activeRuleFired,null);assert.match(engine.lastTrace.sense,/not mounted/);assert.match(robot.ledColor,/59, 130, 246/);engine.endRun();
});
test('queued THEN cannot execute after its sensing module is removed within the same run',()=>{
  const {engine}=fixture();appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control:'CTRL_04',secondaryAction:'ACT_20'});
  engine.start();engine.pause();engine.tick();appState.installedSensors.delete('SENSE_02');engine.tick();assert.equal(engine.activeRuleFired,null);assert.match(engine.lastTrace.sense,/not mounted/);appState.installedSensors.add('SENSE_02');engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_18','removed sensor invalidates the old continuation rather than postponing it');engine.endRun();
});
test('fresh formal runs restart WAIT while pause/resume retains elapsed WAIT ticks',()=>{
  const {engine}=fixture();appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control:'CTRL_03'});
  engine.start();engine.pause();for(let i=0;i<10;i++){engine.tick();assert.equal(engine.activeRuleFired,null);}engine.endRun('revision');engine.start();engine.pause();
  for(let i=0;i<10;i++){engine.tick();assert.equal(engine.activeRuleFired,null);}engine.start();engine.pause();for(let i=0;i<10;i++){engine.tick();assert.equal(engine.activeRuleFired,null);}engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_18');engine.endRun();
});
test('pause/resume and speed changes preserve a legitimate pending THEN continuation',()=>{
  const {engine}=fixture();appState.installedSensors.add('SENSE_02');appState.installedActuators.add('ACTUATOR_LED');rule(0,{sense:'SENSE_02',condition:'COND_09',action:'ACT_18',control:'CTRL_04',secondaryAction:'ACT_20'});
  engine.start();engine.pause();engine.tick();engine.start();engine.setSpeed(5);engine.pause();engine.tick();assert.equal(engine.activeRuleFired.action,'ACT_20');engine.endRun();
});
