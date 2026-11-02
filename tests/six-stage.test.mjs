import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { PILOT_STAGES } from '../js/pilot-config.js';
import { ApartmentWorld } from '../js/sim/world.js';
import { SimulationEngine } from '../js/sim/engine.js';
import { authorSolution } from './fixtures/authored-solution.mjs';

function fixture(stage=1) {
  Object.assign(appState,new appState.constructor());
  appState.currentStage=stage;appState.selectedTasks=PILOT_STAGES[stage-1]?.taskIds || Array.from({length:stage},(_,i)=>`TASK_${i+1}`);
  appState.stagePurposes[stage]=stage<=PILOT_STAGES.length?appState.createStagePurposes(stage):{};
  appState.stageResults[stage]={passingRunId:null,closingText:''};
  const world=new ApartmentWorld(),engine=new SimulationEngine(world);return {world,engine};
}
function rule(task,slots) {const row=appState.addRule(`TASK_${task}`);Object.assign(row.slots,slots);return row;}
function execute(engine,action) {return engine.executeAction({action,ruleIndex:0,trace:{action}});}
function formal(engine){engine.start();engine.pause();}

test('three cumulative stages enforce sensor budgets, allow replacement/removal, and preserve carried design',()=>{
  fixture();assert.equal(PILOT_STAGES.length,3);
  for(const [i,budget]of [7,8,11].entries()){
    assert.equal(appState.sensorBudget,budget);assert.equal(appState.currentStage,i+1);
    for(let n=1;n<=budget;n++)if(!appState.installedSensors.has(`SENSE_${String(n).padStart(2,'0')}`))assert.equal(appState.toggleSensor(`SENSE_${String(n).padStart(2,'0')}`).success,true);
    const before=[...appState.installedSensors];assert.equal(appState.toggleSensor('SENSE_15').success,false);assert.deepEqual([...appState.installedSensors],before);
    assert.equal(appState.toggleSensor(before[0]).success,true);assert.equal(appState.toggleSensor('SENSE_15').success,true);assert.equal(appState.toggleSensor('SENSE_15').success,true);assert.equal(appState.toggleSensor(before[0]).success,true);
    assert.equal(appState.continueStage(),false);
    appState.retainRun({stageId:i+1,runId:i+1,passed:true});
    if(i<2){assert.equal(appState.continueStage(),true);assert.equal(appState.currentStep,1);assert.deepEqual(new Set(appState.installedSensors),new Set(before));}
    else assert.equal(appState.continueStage(),false);
  }
});

test('Map contains only local mounted channel observations, and removing modules withholds channels',()=>{
  const {world,engine}=fixture(3);appState.installedSensors=new Set(['SENSE_07']);
  let p=engine.readSensors();assert.equal(p.mapDirt,undefined);assert.equal(p.mapWet,undefined);assert.equal(p.SENSE_07,'LAYOUT_AND_OBSERVATIONS');
  Object.assign(world.robot,{x:world.dirtCells[0].x,y:world.dirtCells[0].y});engine.readSensors();assert.equal(engine.readSensors().mapDirt,undefined);
  appState.installedSensors.add('SENSE_05');p=engine.readSensors();assert.ok(p.mapDirt.length>0);assert.ok(p.mapDirt.length<world.dirtCells.length);
  appState.installedSensors.delete('SENSE_05');assert.equal(engine.readSensors().mapDirt,undefined);
  appState.installedSensors.add('SENSE_06');Object.assign(world.robot,{x:world.wetCells[0].x,y:world.wetCells[0].y});assert.ok(engine.readSensors().mapWet.length>0);
  appState.installedSensors.delete('SENSE_07');p=engine.readSensors();assert.equal(p.mapDirt,undefined);assert.equal(p.mapWet,undefined);assert.equal(p.mapCoverage,undefined);
});

test('destinations are learner choices, connector never selects a goal and wrong choice does not sort',()=>{
  const {world,engine}=fixture(3);appState.installedSensors.add('SENSE_03');const r=world.robot,o=world.objects[0];r.heldObject=o;o.carried=true;
  assert.equal(engine.readSensors().SENSE_03.target,null);assert.equal(execute(engine,'ACT_24'),true);assert.equal(engine.readSensors().SENSE_03.target,'BIN');
  execute(engine,'ACT_25');assert.equal(engine.readSensors().SENSE_03.target,'TABLE');appState.installedActuators.add('ACTUATOR_GRIP_OPEN');Object.assign(r,{x:world.depositTable.x,y:world.depositTable.y});execute(engine,'ACT_15');assert.equal(o.sorted,false);assert.equal(engine.wrongReleases,1);
  appState.installedActuators.add('ACTUATOR_DOCK_PIN');execute(engine,'ACT_17');assert.equal(engine.readSensors().SENSE_03.target,null);assert.equal(r.isDocked,false);
  execute(engine,'ACT_26');assert.equal(engine.readSensors().SENSE_03.target,'DOCK');
});

test('idempotent destination choice yields to pickup THEN while HIGH safety can preempt',()=>{
  const {world,engine}=fixture(3);appState.installedSensors=new Set(['SENSE_15']);appState.installedActuators=new Set(['ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE']);
  Object.assign(world.robot,{x:350,y:470,heading:0});world.objects=[{id:'one',type:'TRASH',x:375,y:470}];
  rule(2,{sense:'SENSE_15',condition:'COND_16',action:'ACT_24'});
  rule(2,{sense:'SENSE_15',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});
  for(let i=0;i<4;i++)engine.tick();assert.equal(world.robot.heldObject?.id,'one');assert.equal(engine.selectedGoal,'BIN');assert.equal(engine.readSensors().SENSE_08,'NOT_INSTALLED');assert.equal(engine.readSensors().SENSE_15,'TRASH');
});

test('final combined formal gates require actual encounters, resume and low-battery selected-goal physical docking',()=>{
  const {world,engine}=fixture(3);formal(engine);world.dirtCells.forEach(d=>d.cleaned=true);world.objects.forEach(o=>o.sorted=true);world.wetCells.forEach(w=>w.cleaned=true);engine.updateOutcomes();
  assert.deepEqual(engine.criteriaResults.map(c=>c.id),['cleaning','sorting','spills','cat','human','docking']);assert.equal(engine.criteriaResults.find(c=>c.id==='cat').status,'Not achieved');assert.equal(engine.criteriaResults.find(c=>c.id==='human').status,'Not achieved');
  appState.installedActuators.add('ACTUATOR_DOCK_PIN');Object.assign(world.robot,{x:world.dock.x,y:world.dock.y});execute(engine,'ACT_17');engine.updateOutcomes();assert.equal(engine.criteriaResults.find(c=>c.id==='docking').status,'Not achieved');assert.equal(engine.endRun().passed,false);
});

test('preview restores new mapping, selected goal and encounter evidence; fresh run clears it',()=>{
  const {world,engine}=fixture(3);appState.installedSensors=new Set(['SENSE_05','SENSE_07']);execute(engine,'ACT_24');engine.readSensors();const prior=structuredClone(engine.perceivedDirt);
  engine.startPreview();engine.pause();execute(engine,'ACT_26');Object.assign(world.robot,{x:world.dirtCells[0].x,y:world.dirtCells[0].y});engine.readSensors();engine.tick();engine.stopPreview();assert.equal(engine.selectedGoal,'BIN');assert.deepEqual(engine.perceivedDirt,prior);assert.equal(engine.movingTicks,0);assert.equal(appState.runHistory.length,0);
  formal(engine);assert.equal(engine.selectedGoal,null);assert.equal(engine.perceivedDirt.size,0);assert.equal(engine.lowBatteryEncounter,false);engine.endRun();
});

// The replacement three-stage structured feasibility regression is in structured-feasibility.test.mjs.

test('geometry coverage route does not oscillate on a wall-tangent doorway waypoint',()=>{
  const {world,engine}=fixture();appState.installedSensors.add('SENSE_07');appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION']);
  Object.assign(world.robot,{x:731.4483045761879,y:576.1809068159483,heading:0});const target={x:984,y:576};
  for(let i=0;i<600&&Math.hypot(world.robot.x-target.x,world.robot.y-target.y)>5;i++){
    const point=engine.routeTo(target);assert.ok(point);world.robot.heading=Math.atan2(point.y-world.robot.y,point.x-world.robot.x);engine.moveRobot();
  }
  assert.ok(Math.hypot(world.robot.x-target.x,world.robot.y-target.y)<5);
});

test('unknown Map is never CLEAN; persistent coverage is not the truncated path trail',()=>{
  const {world,engine}=fixture();appState.installedSensors.add('SENSE_07');const p=engine.readSensors();
  assert.equal(engine.conditionPassed('SENSE_07','COND_06',p),false);
  const position={x:world.robot.x,y:world.robot.y};world.robot.pathTrail=[];
  engine.enteredCells.add(`${Math.round(position.x/24)*24},${Math.round(position.y/24)*24}`);
  assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),false);
});

test('animal/human conditions cannot use withheld channels; stationary robot cannot earn encounter success',()=>{
  const {world,engine}=fixture(3);Object.assign(world.cat,{x:world.robot.x+50,y:world.robot.y,state:'pause',pauseTimer:1000});Object.assign(world.avatar,{x:world.robot.x+70,y:world.robot.y});
  let p=engine.readSensors();assert.equal(p.SENSE_01,'NOT_INSTALLED');assert.equal(p.SENSE_09,'NOT_INSTALLED');assert.equal(p.catDistancePx,undefined);assert.equal(p.avatarDistancePx,undefined);
  assert.equal(engine.conditionPassed('SENSE_01','COND_07',p),false);assert.equal(engine.conditionPassed('SENSE_01','COND_22',p),false);
  appState.installedSensors=new Set(['SENSE_01','SENSE_09']);appState.installedActuators=new Set(['ACTUATOR_ESTOP','ACTUATOR_WHEELS']);
  rule(4,{sense:'SENSE_01',condition:'COND_07',action:'ACT_06',priority:'CTRL_05'});
  for(let i=0;i<10;i++)engine.tick();assert.equal(engine.catOpportunities,0);assert.equal(engine.humanOpportunities,0);
  assert.equal(engine.criteriaResults.find(c=>c.id==='cat').status,'Not achieved');assert.equal(engine.criteriaResults.find(c=>c.id==='human').status,'Not achieved');
});

test('clean-floor vacuum duration is factual feedback and never an invented pass gate',async()=>{
  const {world,engine}=fixture();appState.installedActuators.add('ACTUATOR_VACUUM');Object.assign(world.robot,{x:350,y:580});execute(engine,'ACT_09');engine.tick();assert.equal(engine.cleanVacuumTicks,1);
  const {StepsView}=await import('../js/view/steps-view.js');const view=Object.create(StepsView.prototype);const oldWindow=globalThis.window;globalThis.window={simEngine:engine};
  try{assert.match(view.renderCriteria(),/Vacuum on clean floor: 0.1 seconds/);assert.doesNotMatch(view.renderCriteria(),/cleanVacuum.*Not achieved/);}finally{globalThis.window=oldWindow;}
  assert.equal(engine.criteriaResults.some(c=>c.id==='cleanVacuum'),false);
});

test('stale or injected Map and Destination percepts cannot route without their mounted sensors',()=>{
  const {world,engine}=fixture(3);appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION']);Object.assign(world.robot,{x:350,y:470,heading:0});
  engine.drive({mapDirt:[{x:350,y:550}],mapWet:[{x:350,y:550}],SENSE_03:{target:'TABLE',x:350,y:550},rememberedObjects:[{x:350,y:550}]});assert.equal(world.robot.heading,0);
});

test('person criterion rejects a fast tick anywhere inside its sensed two-meter range',()=>{
  const {world,engine}=fixture(3);appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION']);Object.assign(world.robot,{x:350,y:470,heading:0});Object.assign(world.avatar,{x:450,y:470});engine.tick();assert.equal(engine.humanSafetyViolations,1);
});

test('Map CLEAN accepts a mounted local clean observation, while unknown alone stays false',()=>{
  const {world,engine}=fixture();appState.installedSensors=new Set(['SENSE_07','SENSE_05']);Object.assign(world.robot,{x:350,y:580});const p=engine.readSensors();assert.equal(p.SENSE_05,'CLEAN');assert.equal(engine.conditionPassed('SENSE_07','COND_06',p),true);
});

test('GRIPPER OPEN remains actionable after an empty missed grab closes the fingers',()=>{
  const {world,engine}=fixture(3);appState.installedSensors.add('SENSE_02');appState.installedActuators=new Set(['ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']);
  execute(engine,'ACT_14');assert.equal(world.robot.heldObject,null);assert.equal(world.robot.gripperClosed,true);
  rule(2,{sense:'SENSE_02',action:'ACT_15'});const decision=engine.evaluateRules(engine.readSensors());assert.equal(decision?.action,'ACT_15');engine.executeAction(decision);assert.equal(world.robot.gripperClosed,false);
});

test('UNVISITED survives repeated sensor/POV reads until tick evaluation, then remembers revisits and preview/reset',()=>{
  const {world,engine}=fixture();appState.installedSensors.add('SENSE_07');appState.installedActuators.add('ACTUATOR_LED');
  Object.assign(world.robot,{x:360,y:480});rule(1,{sense:'SENSE_07',condition:'COND_05',action:'ACT_18'});
  for(let i=0;i<4;i++)assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),true);
  assert.equal(engine.enteredCells.has('360,480'),false);engine.tick();assert.equal(engine.activeRuleFired?.action,'ACT_18');
  assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),false);engine.tick();assert.equal(engine.activeRuleFired,null);
  engine.startPreview();engine.pause();Object.assign(world.robot,{x:384,y:480});engine.tick();assert.equal(engine.enteredCells.has('384,480'),true);engine.stopPreview();assert.equal(engine.enteredCells.has('384,480'),false);assert.equal(engine.enteredCells.has('360,480'),true);
  engine.reset();Object.assign(world.robot,{x:360,y:480});assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),true);
});

test('UNVISITED uses a consistent physical cell even when its rounded center is excluded by planning clearance',()=>{
  const {world,engine}=fixture();appState.installedSensors.add('SENSE_07');Object.assign(world.robot,{x:732,y:576.1809068159483});
  assert.equal(engine.coveragePoints().some(p=>p.key===engine.currentCoverageCell()),false);
  assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),true);engine.tick();assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),false);
});

test('researcher LOW threshold governs sensor, LOW condition and low-battery docking evidence together',()=>{
  const {world,engine}=fixture(3);engine.criteria={...engine.criteria,3:{...engine.criteria[3],lowBatteryPercent:20}};appState.installedSensors.add('SENSE_02');world.robot.battery=25;
  let p=engine.readSensors();assert.equal(p.SENSE_02,'MED');assert.equal(engine.conditionPassed('SENSE_02','COND_08',p),false);engine.tick();assert.equal(engine.lowBatteryEncounter,false);
  world.robot.battery=19;p=engine.readSensors();assert.equal(p.SENSE_02,'LOW');assert.equal(engine.conditionPassed('SENSE_02','COND_08',p),true);engine.tick();assert.equal(engine.lowBatteryEncounter,true);assert.match(engine.criteriaResults.find(c=>c.id==='docking').label,/Below 20%/);
  engine.criteria[3]={...engine.criteria[3],lowBatteryPercent:70};world.robot.battery=65;assert.equal(engine.readSensors().SENSE_02,'LOW');
});

test('explicit MOVE into the next physical cell preserves that cells first-visit decision on the next tick',()=>{
  const {world,engine}=fixture();appState.installedSensors.add('SENSE_07');appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_LED']);Object.assign(world.robot,{x:370.5,y:480,heading:0});
  const move=rule(1,{sense:'SENSE_07',action:'ACT_01'});assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),true);engine.tick();assert.equal(engine.currentCoverageCell(),'384,480');
  for(let i=0;i<3;i++)assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),true);
  move.slots.action=null;rule(1,{sense:'SENSE_07',condition:'COND_05',action:'ACT_18'});engine.tick();assert.equal(engine.activeRuleFired?.action,'ACT_18');assert.equal(engine.conditionPassed('SENSE_07','COND_05',engine.readSensors()),false);
});
