import test from 'node:test';
import assert from 'node:assert/strict';
import {appState} from '../js/state.js';
import {PILOT_STAGES,STAGE_CRITERIA} from '../js/pilot-config.js';
import {ApartmentWorld} from '../js/sim/world.js';
import {SimulationEngine} from '../js/sim/engine.js';
// Fully authored primitive-motion program in a small physical world. No production autopilot or answer injection.
let serial=0;const n=(type,fields={})=>({id:`feasible-${++serial}`,type,...fields});
const lit=value=>n('literal',{value}),v=name=>n('variable',{name});
const set=(name,value)=>n('setVariable',{name,value});
const read=(sensor,field)=>n('reading',{sensor,field});
const op=(left,operator,right)=>n(['=','<','>='].includes(operator)?'compare':'arithmetic',{left,op:operator,right});
const iff=(condition,body,otherwise=[])=>n('if',{branches:[{condition,body}],otherwise});
const cmd=(command,args={})=>n('command',{command,args});
const b=(taskId,body,priority=1)=>n('behavior',{model:'learner',taskId,body,priority});
const goTo=point=>[cmd('heading',{angle:n('direction',{left:read('SENSE_07','position'),right:point()})}),cmd('move',{direction:'forward',distance:n('distance',{left:read('SENSE_07','position'),right:point()})})];
const coord=(x,y)=>n('coordinate',{x:lit(x/60),y:lit(y/60)});
function worldFixture(){
 const world=new ApartmentWorld();const initialize=()=>{world.width=80;world.height=80;Object.assign(world.robot,{x:16,y:8,heading:0,radius:3,speed:1.6,battery:35,isDocked:false,isCharging:false,heldObject:null,armExtended:false,gripperClosed:false,vacuumActive:false,mopDeployed:false});world.robotSpawn={x:16,y:8};Object.assign(world.dock,{x:8,y:8});Object.assign(world.smartBin,{x:60,y:60});Object.assign(world.depositTable,{x:60,y:60});Object.assign(world.cat,{x:1000,y:1000,state:'pause',pauseTimer:99999});Object.assign(world.avatar,{x:1200,y:1200});world.dirtCells=[{id:'dirt',x:36,y:36,radius:2,cleaned:false}];world.wetCells=[{id:'spill',x:28,y:28,radius:2,cleaned:false}];world.objects=[{id:'paper',type:'TRASH',x:20,y:20,carried:false,disposed:false,sorted:false}];};
 world.checkCollision=(x,y,r=0)=>x-r<0||y-r<0||x+r>80||y+r>80;world.reset=initialize;initialize();return world;
}
function author(stage){
 const charged=()=>v('charged');
 const charging=b('TASK_6',[
   iff(n('not',{value:n('available',{value:charged()})}),[set('charged',lit(false))]),
   iff(n('or',{left:read('STATE','docked'),right:n('and',{left:n('not',{value:charged()}),right:op(read('SENSE_02','level'),'<',lit(40))})}),[
     iff(read('STATE','docked'),[
       iff(op(read('SENSE_02','level'),'>=',lit(80)),[cmd('dock',{state:'release'}),set('charged',lit(true))],[cmd('stop')])
     ],[
       cmd('goal',{target:'DOCK'}),
       iff(op(read('SENSE_03','distance'),'<',lit(.02)),[cmd('stop'),cmd('dock',{state:'engage'})],[
         cmd('heading',{angle:op(read('SENSE_07','heading'),'+',read('SENSE_03','direction'))}),cmd('move',{direction:'forward',distance:lit(.01)})
       ])
     ])
   ])
 ],80);
 const x=()=>op(lit(4),'+',op(v('col'),'*',lit(8))),y=()=>op(lit(4),'+',op(v('row'),'*',lit(8)));
 const rows=[set('points',n('list',{op:'create'})),set('row',lit(0)),n('repeatCount',{count:lit(10),body:[set('col',lit(0)),n('repeatCount',{count:lit(10),body:[set('points',n('list',{op:'append',list:v('points'),item:n('coordinate',{x:op(x(),'/',lit(60)),y:op(y(),'/',lit(60))})})),set('col',op(v('col'),'+',lit(1)))]}),set('row',op(v('row'),'+',lit(1)))]}),n('forEach',{name:'point',list:v('points'),body:goTo(()=>v('point'))})];
 if(stage===3)rows.push(...goTo(()=>coord(20,20)),cmd('arm',{state:'extend',distance:lit(.6)}),cmd('gripper',{state:'close'}),cmd('goal',{target:'BIN'}),...goTo(()=>coord(60,60)),cmd('gripper',{state:'open'}),cmd('arm',{state:'retract',distance:lit(.6)}));
 const program=[charging,b('TASK_1',[iff(charged(),rows)],20)];
 if(stage>=2)program.push(b('TASK_2',[iff(charged(),[iff(op(read('SENSE_06','state'),'=',lit('WET')),[cmd('vacuum',{state:'off'}),cmd('mop',{state:'deploy'})],[cmd('mop',{state:'retract'}),cmd('vacuum',{state:'on'})])],[cmd('vacuum',{state:'off'}),cmd('mop',{state:'retract'})])],10));
 // Sorting commands are authored above in the navigation sequence so delivery physically follows pickup.
 assert.equal(appState.setProgram(program,{testAuthored:true}),true);return program;
}
test('three cumulative tasks physically pass with explicit student commands, charge/resume and one-pass mop',t=>{
 const saved={...appState};t.after(()=>Object.assign(appState,saved));
 for(let stage=1;stage<=3;stage++){
  Object.assign(appState,new appState.constructor());appState.currentStage=stage;appState.selectedTasks=[...PILOT_STAGES[stage-1].taskIds];appState.stagePurposes[stage]=appState.createStagePurposes(stage);appState.stageResults[stage]={passingRunId:null,closingText:''};if(stage>=2)appState.setTaskPriority('TASK_2','thorough');
  appState.installedSensors=new Set(['SENSE_07','SENSE_04','SENSE_02','SENSE_03',...(stage>=2?['SENSE_05','SENSE_06']:[]),...(stage===3?['SENSE_15','SENSE_08']:[])]);
  appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_ESTOP','ACTUATOR_DOCK_PIN',...(stage>=2?['ACTUATOR_VACUUM','ACTUATOR_MOP']:[]),...(stage===3?['ACTUATOR_ARM_EXT','ACTUATOR_ARM_RET','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']:[])]);
  const world=worldFixture(),criteria={...STAGE_CRITERIA,[stage]:{...STAGE_CRITERIA[stage],minCatEncounters:0,minHumanEncounters:0,minHumanResumes:0}},engine=new SimulationEngine(world,{criteria});author(stage);engine.start();engine.pause();engine.updateCat=()=>{};
  for(let i=0;i<10000&&!engine.criteriaResults.every(c=>c.status==='Achieved');i++){engine.tick();assert.equal(world.checkCollision(world.robot.x,world.robot.y,world.robot.radius),false);}
  const result=engine.endRun('evaluate');t.diagnostic(`Task ${stage}: ticks=${engine.tickCount}, visited=${engine.navigationCoveragePercent().toFixed(1)}, floor=${engine.getCleaningMetrics().floorCoveragePercent}, charged/resumed=${engine.chargeResumed}, ${JSON.stringify(result.criteria)}`);assert.equal(result.passed,true);assert.ok(engine.chargeResumed);if(stage>=2){assert.equal(world.wetCells[0].cleaned,true);assert.equal(engine.vacuumLiquidMistakes,0);}if(stage===3)assert.equal(world.objects[0].sorted,true);
 }
});
