import {appState} from '../state.js';
import {recordCleanedFloor,buildFloorCoverageGrid} from './floor-coverage.js';
import {sound} from '../view/audio.js';
const meter=60;
const relative={front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2};
const key=(x,y)=>`${Math.round(x/24)*24},${Math.round(y/24)*24}`;
const position=r=>({x:r.x/meter,y:r.y/meter});
const angleTo=(r,e)=>(Math.atan2(e.y-r.y,e.x-r.x)-r.heading)*180/Math.PI;
const unavailable=v=>v===undefined||v===null||['UNKNOWN','NOT_INSTALLED','NOT_MODELLED'].includes(v);
export const learnerEngineMethods={
  resetLearnerRuntime(){this.learnerVariables=Object.create(null);this.learnerMotion={};this.learnerMemory={cells:new Map(),path:[],parents:new Map(),current:null};this.visitedFloorCells=new Set();this.learnerEvents=[];this.wallCollisions=0;this.authoredLowThreshold=null;this.currentLearnerTask=null;this.chargeResumed=false;this.wasDocked=false;this.dockCycleReleased=false;},
  directionalDistance(direction){
    const r=this.world.robot,a=r.heading+(relative[direction]??0);let distance=this.raycastObstacle(r.x,r.y,a);
    for(const entity of [this.world.cat,this.world.avatar]){const dx=entity.x-r.x,dy=entity.y-r.y,along=dx*Math.cos(a)+dy*Math.sin(a),across=Math.abs(-dx*Math.sin(a)+dy*Math.cos(a)),radius=entity.radius||12;if(along>0&&across<radius+r.radius)distance=Math.min(distance,Math.max(0,along-radius));}
    return distance/meter;
  },
  learnerRead(n,p){
    const r=this.world.robot;if(n.sensor==='STATE'){const fields={stopped:r.isStopped,vacuum:r.vacuumActive,mop:r.mopDeployed,arm:r.armExtended,gripping:Boolean(r.heldObject),charging:r.isCharging,docked:r.isDocked,movementBlocked:this.lastMovementBlocked===true,goal:this.selectedGoal||'NONE',stage:appState.currentStage,width:r.radius*2/meter,speed:r.speed*this.tickRateHz/meter,goalPosition:this.destination()?position(this.destination()):null};return fields[n.field]??null;}
    if(!appState.installedSensors.has(n.sensor))return null;
    if(n.sensor==='SENSE_04')return n.field==='distance'?this.directionalDistance(n.direction||'front'):p.SENSE_04;
    if(n.sensor==='SENSE_05')return this.world.dirtCells.some(d=>!d.cleaned&&Math.hypot(r.x-d.x,r.y-d.y)<d.radius+10)?'DIRTY':'CLEAN';
    if(n.sensor==='SENSE_06')return this.world.wetCells.some(w=>!w.cleaned&&Math.hypot(r.x-w.x,r.y-w.y)<w.radius+10)?'WET':'DRY';
    if(n.sensor==='SENSE_08')return r.heldObject?'GRIPPING':'EMPTY';
    if(n.sensor==='SENSE_02')return n.field==='level'?r.battery:p.SENSE_02;
    if(n.sensor==='SENSE_07'){if(n.field==='position')return position(r);if(n.field==='heading')return r.heading*180/Math.PI;if(n.field==='cells')return [...this.learnerMemory.cells.values()].map(c=>({...c}));return p.SENSE_07??null;}
    if(n.sensor==='SENSE_01'||n.sensor==='SENSE_09'){const e=n.sensor==='SENSE_01'?this.world.cat:this.world.avatar;if(n.field==='distance')return Math.hypot(r.x-e.x,r.y-e.y)/meter;if(n.field==='direction')return angleTo(r,e);return p[n.sensor]??null;}
    if(n.sensor==='SENSE_03'){const d=this.destination();if(!d)return null;if(n.field==='distance')return Math.hypot(r.x-d.x,r.y-d.y)/meter;if(n.field==='direction')return angleTo(r,d);if(n.field==='position')return position(d);return p.SENSE_03?.reached??null;}
    if(n.sensor==='SENSE_15'){const e=r.heldObject||p.visibleObject;if(n.field==='type')return p.SENSE_15??null;if(!e)return null;if(n.field==='position')return position(e);if(n.field==='distance')return Math.hypot(r.x-e.x,r.y-e.y)/meter;if(n.field==='direction')return angleTo(r,e);}
    const x=p[n.sensor];if(unavailable(x))return null;return n.sensor==='SENSE_12'?Number(x):x;
  },
  learnerSetting(field){
    const choice=appState.stagePurposes[appState.currentStage]?.TASK_1?.priority ?? appState.stagePurposes[appState.currentStage]?.TASK_2?.priority;
    return ({mode:choice||'NOT_SELECTED',coverageTarget:appState.currentStage===1?100:choice==='speed'?60:choice==='thorough'?100:null,timeEstimate:choice==='speed'?20:choice==='thorough'?40:null,task:appState.currentStage})[field]??null;
  },
  learnerRecord(source,field,direction='current',index,at){
    if(!appState.installedSensors.has('SENSE_07'))return null;
    const m=this.learnerMemory,r=this.world.robot;
    if(source==='progress'){const metrics=this.getCleaningMetrics();return ({visited:this.visitedFloorCells.size,patrolCoverage:this.navigationCoveragePercent(),floorCoverage:metrics.floorCoveragePercent,dirtRemoved:appState.installedSensors.has('SENSE_05')?metrics.dirtCleaned:null,spillsMopped:appState.installedSensors.has('SENSE_06')?this.world.wetCells.filter(w=>w.cleaned).length:null,objectsSorted:appState.installedSensors.has('SENSE_15')?this.world.objects.filter(o=>o.sorted).length:null})[field]??null;}
    if(source==='path'){if(field==='all')return m.path.map(x=>({...x}));if(field==='parent')return m.parents.get(m.current)||null;return m.path[Number.isInteger(index)?index:m.path.length-2]||null;}
    if(source==='objects')return appState.installedSensors.has('SENSE_15')?[...this.perceivedObjects.values()].map(o=>({...o,x:o.x/meter,y:o.y/meter})):null;
    if(source==='dirt'||source==='wet'){const sensor=source==='dirt'?'SENSE_05':'SENSE_06';return appState.installedSensors.has(sensor)?[...(source==='dirt'?this.perceivedDirt:this.perceivedWet).values()].map(o=>({...o,x:o.x/meter,y:o.y/meter})):null;}
    if(source==='cells')return [...m.cells.values()].map(c=>({...c}));
    const a=r.heading+(relative[direction]??0),point=direction==='current'?r:{x:r.x+Math.cos(a)*24,y:r.y+Math.sin(a)*24};const cell=m.cells.get(at?key(at.x*meter,at.y*meter):key(point.x,point.y));
    if(!cell)return null;
    return field==='position'?{x:cell.x,y:cell.y}:cell[field]??null;
  },
  updateLearnerMemory(p){
    if(!appState.installedSensors.has('SENSE_07'))return;
    const r=this.world.robot,m=this.learnerMemory,current=key(r.x,r.y);
    const touch=(x,y,occupancy)=>{const k=key(x,y);let c=m.cells.get(k);if(!c){const [px,py]=k.split(',').map(Number);c={x:px/meter,y:py/meter,visited:false,cleaned:false,occupancy:'UNKNOWN'};m.cells.set(k,c);}Object.assign(c,{occupancy,lastObserved:this.tickCount/this.tickRateHz});return c;};
    const cell=touch(r.x,r.y,'FREE');cell.visited=true;
    if(m.current!==current){if(!m.parents.has(current)&&m.current)m.parents.set(current,m.cells.get(m.current)?{x:m.cells.get(m.current).x,y:m.cells.get(m.current).y}:null);m.path.push(position(r));if(m.path.length>12000)m.path.shift();m.current=current;}
    if(appState.installedSensors.has('SENSE_04'))for(const d of Object.keys(relative)){const a=r.heading+relative[d],distance=this.directionalDistance(d)*meter;for(let s=24;s<distance;s+=24)touch(r.x+Math.cos(a)*s,r.y+Math.sin(a)*s,'FREE');if(distance<245)touch(r.x+Math.cos(a)*distance,r.y+Math.sin(a)*distance,'OBSTACLE');}
    if(appState.installedSensors.has('SENSE_05'))cell.dirt=p.SENSE_05==='DIRTY';
    if(appState.installedSensors.has('SENSE_06'))cell.wet=p.SENSE_06==='WET';
    const sampleX=Math.round((r.x-4)/8)*8+4,sampleY=Math.round((r.y-4)/8)*8+4;
    if(this.cleanedFloorCells.has(`${sampleX},${sampleY}`))cell.cleaned=true;
    if(!this.floorCoverageGrid)this.floorCoverageGrid=buildFloorCoverageGrid(this.world);
    recordCleanedFloor(this.floorCoverageGrid,this.visitedFloorCells,this.tickStart||r,r,r.radius);
  },
  navigationCoveragePercent(){if(!this.visitedFloorCells.size)return 0;if(!this.floorCoverageGrid)this.floorCoverageGrid=buildFloorCoverageGrid(this.world);return this.floorCoverageGrid.size?Math.min(100,this.visitedFloorCells.size/this.floorCoverageGrid.size*100):0;},
  performLearnerCommand(command,args,nodeId){
    const r=this.world.robot,required={move:['ACTUATOR_WHEELS','ACTUATOR_ROTATION'],turn:['ACTUATOR_ROTATION'],heading:['ACTUATOR_ROTATION'],stop:['ACTUATOR_ESTOP'],speed:['ACTUATOR_WHEELS'],vacuum:['ACTUATOR_VACUUM'],mop:['ACTUATOR_MOP'],arm:[args.state==='retract'?'ACTUATOR_ARM_RET':'ACTUATOR_ARM_EXT'],gripper:[args.state==='open'?'ACTUATOR_GRIP_OPEN':'ACTUATOR_GRIP_CLOSE'],dock:['ACTUATOR_DOCK_PIN'],bin:['ACTUATOR_BIN_OPEN'],led:['ACTUATOR_LED'],sound:['ACTUATOR_SPEAKER'],goal:[],goalPosition:[]}[command];
    if(!required||required.some(id=>!appState.installedActuators.has(id))){this.programDiagnostic={nodeId,decide:`Missing actuator: ${required?.filter(id=>!appState.installedActuators.has(id)).join(', ')||command}`};return 'blocked';}
    if(command==='move'){
      if(!Number.isFinite(args.distance)||args.distance<=0||args.distance>20)return 'blocked';
      if(!this.canDrive()||r.isStopped)return 'waiting';
      const state=this.learnerMotion[nodeId]||={remaining:args.distance*meter};
      if(r.speed<=0)return 'waiting';
      const step=Math.min(state.remaining,r.speed),direction=args.direction==='backward'?-1:1;
      const move=this.world.resolveMove(r.x,r.y,Math.cos(r.heading)*step*direction,Math.sin(r.heading)*step*direction,r.radius);
      this.lastMovementBlocked=!move.moved;
      if(!move.moved){this.wallCollisions++;this.programDiagnostic={nodeId,decide:'Movement blocked; write a turn, wait or alternative direction'};return 'blocked';}
      const travelled=Math.hypot(move.x-r.x,move.y-r.y);r.x=move.x;r.y=move.y;state.remaining-=travelled;
      if(state.remaining<=.01){delete this.learnerMotion[nodeId];return 'done';}return 'waiting';
    }
    if(command==='turn'){if(!Number.isFinite(args.angle)||args.angle<0||args.angle>360)return 'blocked';r.heading+=(args.direction==='left'?-1:1)*args.angle*Math.PI/180;return 'done';}
    if(command==='heading'){if(!Number.isFinite(args.angle))return 'blocked';r.heading=args.angle*Math.PI/180;return 'done';}
    if(command==='speed'){if(!Number.isFinite(args.value)||args.value<0||args.value>1)return 'blocked';r.isSlow=args.value<=.4;r.speed=args.value*meter/this.tickRateHz;return 'done';}
    if(command==='goalPosition'){const p=args.position;if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return 'blocked';this.selectedGoal={x:p.x*meter,y:p.y*meter,target:'CUSTOM'};return 'done';}
    if(command==='goal'&&args.target==='NONE'){this.selectedGoal=null;return 'done';}
    if(command==='goal'&&args.target==='DOCK'&&appState.installedSensors.has('SENSE_02')&&r.battery<this.lowBatteryPercent)this.lowBatteryEncounter=true;
    if(command==='arm'){if(!Number.isFinite(args.distance)||args.distance<0||args.distance>.6)return 'blocked';const extension=args.state==='extend'?args.distance:Math.max(0,(r.armExtensionMeters||0)-args.distance);r.armExtensionMeters=extension;r.armReachPx=extension*meter;r.armExtended=extension>0;return 'done';}
    const legacy=({stop:'ACT_06',vacuum:args.state==='on'?'ACT_09':'ACT_10',mop:args.state==='deploy'?'ACT_11':'ACT_12',arm:args.state==='extend'?'ACT_13':'ACT_16',gripper:args.state==='close'?'ACT_14':'ACT_15',dock:args.state==='engage'?'ACT_17':'ACT_27',goal:{DOCK:'ACT_26',BIN:'ACT_24',TABLE:'ACT_25'}[args.target],bin:'ACT_21',led:{red:'ACT_18',amber:'ACT_19',blue:'ACT_20'}[args.color],sound:args.sound==='chime'?'ACT_23':'ACT_22'})[command];
    if(legacy)return this.executeAction({action:legacy,nodeId,trace:{sense:'Learner readings',decide:'Learner program',act:command}})===false?'blocked':'done';
    return 'blocked';
  }
};
