import {appState} from '../state.js';
export const LEARNER_SCAFFOLDS=[
  {taskId:'TASK_1',name:'Driving route'}, {taskId:'TASK_4',name:'Animal response'},
  {taskId:'TASK_5',name:'Human response'}, {taskId:'TASK_6',name:'Charging and resume'},
  {taskId:'TASK_2',name:'Vacuum and mop'}, {taskId:'TASK_3',name:'Pick up and sort'}
];
const directions=[['front','front'],['left','left'],['right','right'],['back','back']];
const drop=(name,options)=>({type:'field_dropdown',name,options});
const val=name=>({type:'input_value',name});
const text=(name,value)=>({type:'field_input',name,text:value});
const output=(type,message0,args0,colour=205,tooltip='')=>({type,message0,args0,output:null,colour,tooltip,inputsInline:true});
const statement=(type,message0,args0,tooltip='')=>({type,message0,args0,previousStatement:null,nextStatement:null,colour:155,tooltip,inputsInline:true});
export function learnerDefinitions(){return [
  {type:'LEARNER_BEHAVIOR',message0:'BEHAVIOR %1 priority %2',args0:[text('NAME','My behavior'),{type:'field_number',name:'PRIORITY',value:1,min:0,max:100}],message1:'For %1 DO %2',args1:[drop('TASK',()=>[['Navigation','TASK_1'],['Vacuum and mop','TASK_2'],['Pick up and sort','TASK_3'],['Animal response','TASK_4'],['Human response','TASK_5'],['Charging and resume','TASK_6']]),{type:'input_statement',name:'BODY'}],colour:265,tooltip:'You set the conditions, actions and execution priority. Empty behaviors do not run.'},
  output('READ_DISTANCE','Distance Sensor: %1 distance (m)',[drop('DIRECTION',directions)]),
  ...[['READ_ANIMAL','Animal Detection Sensor','SENSE_01'],['READ_PERSON','Human Proximity Sensor','SENSE_09']].map(([type,label])=>output(type,`${label}: %1`,[drop('FIELD',[['distance (m)','distance'],['direction (degrees)','direction'],[type==='READ_PERSON'?'near / clear':'detected / clear','state']])])),
  ...[['READ_DIRT','Floor Dirt Sensor'],['READ_WET','Floor Wet Sensor'],['READ_GRIP','Grip Sensor'],['READ_WEIGHT','Object Weight Sensor'],['READ_TIMER','Session Timer Sensor'],['READ_LIGHT','Light Level Sensor'],['READ_SOUND','Sound Level Sensor'],['READ_EDGE','Stair Edge Detector']].map(([type,label])=>output(type,label,[])),
  output('READ_BATTERY','Battery Sensor: level (%)',[]),
  output('READ_VISION','Vision Sensor: %1',[drop('FIELD',[['object type','type'],['object position','position'],['distance (m)','distance'],['direction (degrees)','direction']])]),
  output('READ_POSITION','Floor Map / localization: %1',[drop('FIELD',[['position','position'],['heading (degrees)','heading']])]),
  output('READ_DESTINATION','Destination Sensor: %1',[drop('FIELD',[['distance (m)','distance'],['direction (degrees)','direction'],['position','position'],['reached','reached']])]),
  output('READ_STATE','Robot state: %1',[drop('FIELD',[['movement blocked','movementBlocked'],['stopped','stopped'],['vacuum on','vacuum'],['mop down','mop'],['arm extended','arm'],['holding an object','gripping'],['charging','charging'],['docked','docked'],['destination','goal'],['width (m)','width'],['speed (m/s)','speed']])],205,'Internal status, not an additional hardware sensor.'),
  output('STATUS_VALUE','status %1',[drop('VALUE',['FREE','OBSTACLE','UNKNOWN','DIRTY','CLEAN','WET','DRY','GRIPPING','EMPTY','TRASH','CUP','FOOD','NONE','DETECTED','NEAR','CLEAR','DOCK','BIN','TABLE'].map(v=>[v,v]))],265),
  output('VALUE_COMPARE','%1 %2 %3',[val('A'),drop('OP',[['=','='],['≠','!='],['<','<'],['≤','<='],['>','>'],['≥','>=']]),val('B')],45),
  output('READING_AVAILABLE','reading %1 is available',[val('VALUE')],45,'UNKNOWN is not false. Test availability explicitly.'),
  output('LIST_CONTAINS','list %1 contains %2',[val('LIST'),val('ITEM')],45),
  output('LIST_EMPTY','list %1 is empty',[val('LIST')],45),
  statement('ROBOT_MOVE','MOVE %1 by %2 m',[drop('DIRECTION',[['forward','forward'],['backward','backward']]),val('DISTANCE')],'Moves only the specified distance; never selects a detour.'),
  statement('ROBOT_TURN','TURN %1 by %2 degrees',[drop('DIRECTION',[['left','left'],['right','right']]),val('ANGLE')]),
  statement('ROBOT_HEADING','SET HEADING to %1 degrees',[val('ANGLE')]),
  statement('ROBOT_SPEED','SET SPEED to %1 m/s',[val('VALUE')]),
  statement('ROBOT_STOP','STOP MOVEMENT this cycle',[]),
  ...[['ROBOT_VACUUM','VACUUM',[['on','on'],['off','off']]],['ROBOT_MOP','MOP',[['deploy','deploy'],['retract','retract']]],['ROBOT_GRIPPER','GRIPPER',[['close','close'],['open','open']]],['ROBOT_DOCK','DOCK CONNECTOR',[['engage','engage'],['release','release']]]].map(([type,label,options])=>statement(type,`${label} %1`,[drop('STATE',options)])),
  statement('ROBOT_ARM','ARM %1 distance %2 m',[drop('STATE',[['extend','extend'],['retract','retract']]),val('DISTANCE')]),
  statement('ROBOT_GOAL','SET DESTINATION %1',[drop('TARGET',[['DOCK','DOCK'],['BIN','BIN'],['TABLE','TABLE'],['NONE','NONE']])],'Selects a target only. You must write the movement rules.'),
  statement('ROBOT_GOAL_POSITION','SET DESTINATION to position %1',[val('POSITION')],'Stores your chosen position; does not plan or follow a path.'),
  statement('ROBOT_BIN','OPEN BIN LID',[]),
  statement('ROBOT_LED','SET LED %1',[drop('COLOR',[['red','red'],['amber','amber'],['blue','blue']])]),
  statement('ROBOT_SOUND','PLAY SOUND %1',[drop('SOUND',[['beep','beep'],['chime','chime']])]),
  {...statement('SET_LEARNER_VARIABLE','SET %1 to %2',[text('NAME','value'),val('VALUE')]),colour:265},
  output('GET_LEARNER_VARIABLE','variable %1',[text('NAME','value')],265),
  output('TASK_SETTING','Task setting: %1',[drop('FIELD',[['cleaning mode','mode'],['coverage target (%)','coverageTarget'],['estimated minutes','timeEstimate'],['current task','task']])],265),
  output('MAP_VALUE','recorded %1 at %2',[drop('FIELD',[['occupancy','occupancy'],['visited','visited'],['cleaned','cleaned'],['dirt','dirt'],['wet','wet'],['position','position']]),drop('DIRECTION',[['current cell','current'],...directions])],265,'Automatic local observations only. An unobserved cell is UNKNOWN.'),
  output('MAP_AT','recorded %1 at position %2',[drop('FIELD',[['occupancy','occupancy'],['visited','visited'],['cleaned','cleaned'],['dirt','dirt'],['wet','wet']]),val('POSITION')],265),
  output('RECORDED_LIST','automatic record: %1',[drop('SOURCE',[['observed map cells','cells'],['traveled path','path'],['seen objects','objects'],['seen dirt','dirt'],['seen spills','wet']])],265),
  output('RECORDED_PARENT','recorded return position',[],265,'Reads the first-arrival return position. Does not move or choose a path.'),
  output('PROGRESS_VALUE','progress: %1',[drop('FIELD',[['patrol coverage (%)','patrolCoverage'],['floor cleaned (%)','floorCoverage'],['dirt spots removed','dirtRemoved'],['spills mopped','spillsMopped'],['objects sorted','objectsSorted']])],265),
  output('POSITION_VALUE','position x %1 y %2 (m)',[val('X'),val('Y')],265),
  output('OFFSET_POSITION','position %1 offset %2 by %3 m',[val('POSITION'),drop('DIRECTION',directions),val('DISTANCE')],265),
  output('POSITION_DISTANCE','%1 between %2 and %3',[drop('OP',[['distance (m)','distance'],['direction (degrees)','direction']]),val('A'),val('B')],265),
  output('RECORD_FIELD','field %1 of record %2',[text('FIELD','x'),val('RECORD')],265),
  output('LIST_VALUE','list operation %1 list %2 index %3 item %4',[drop('OP',[['new list','create'],['length','length'],['read item','item'],['append item','append'],['insert item','insert'],['remove item','remove']]),val('LIST'),val('INDEX'),val('ITEM')],265,'Indices start at 0. Use only the inputs required by the selected operation.'),
  {...statement('WAIT_SECONDS','WAIT %1 seconds',[val('TIME')]),colour:265},
  {type:'LEARNER_FOREACH',message0:'FOR EACH %1 IN %2',args0:[text('NAME','item'),val('LIST')],message1:'DO %1',args1:[{type:'input_statement',name:'BODY'}],previousStatement:null,nextStatement:null,colour:265},
  {type:'LEARNER_DEFINE',message0:'DEFINE PROCEDURE %1',args0:[text('NAME','my procedure')],message1:'DO %1',args1:[{type:'input_statement',name:'BODY'}],colour:265,tooltip:'A student-authored reusable program. No built-in route planning.'},
  {...statement('LEARNER_CALL','CALL PROCEDURE %1',[text('NAME','my procedure')]),colour:265},
  {...statement('LEARNER_RETURN','RETURN from procedure',[]),colour:265}
];}
export function learnerToolbox(){
  const block=(type,fields,inputs)=>({kind:'block',type,...(fields?{fields}:{}),...(inputs?{inputs}:{})});
  const number=value=>({shadow:{type:'math_number',fields:{NUM:value}}});
  const group=(name,colour,contents)=>({kind:'category',name,colour,contents});
  return {kind:'categoryToolbox',contents:[
    group('Sense',205,['READ_DISTANCE','READ_ANIMAL','READ_PERSON','READ_DIRT','READ_WET','READ_BATTERY','READ_POSITION','READ_DESTINATION','READ_VISION','READ_GRIP','READ_WEIGHT','READ_TIMER','READ_LIGHT','READ_SOUND','READ_EDGE','READ_STATE'].map(t=>block(t))),
    group('Condition',45,['VALUE_COMPARE','logic_operation','logic_negate','READING_AVAILABLE','LIST_CONTAINS','LIST_EMPTY','logic_boolean'].map(t=>block(t))),
    group('Action',155,[block('ROBOT_MOVE',null,{DISTANCE:number(.1)}),block('ROBOT_TURN',null,{ANGLE:number(90)}),block('ROBOT_HEADING',null,{ANGLE:number(0)}),block('ROBOT_SPEED',null,{VALUE:number(.4)}),...['ROBOT_STOP','ROBOT_VACUUM','ROBOT_MOP'].map(t=>block(t)),block('ROBOT_ARM',null,{DISTANCE:number(.6)}),...['ROBOT_GRIPPER','ROBOT_DOCK','ROBOT_GOAL','ROBOT_GOAL_POSITION','ROBOT_BIN','ROBOT_LED','ROBOT_SOUND'].map(t=>block(t))]),
    group('Control',265,[
      group('Program structure',265,['LEARNER_BEHAVIOR','controls_if','controls_repeat_ext','controls_whileUntil','LEARNER_FOREACH','controls_flow_statements','WAIT_SECONDS','WAIT_UNTIL','LEARNER_DEFINE','LEARNER_CALL','LEARNER_RETURN'].map(t=>block(t))),
      group('Values and calculations',265,['math_number','text','STATUS_VALUE','SET_LEARNER_VARIABLE','GET_LEARNER_VARIABLE','math_arithmetic','math_single','TASK_SETTING'].map(t=>block(t))),
      group('Automatic records',265,['MAP_VALUE','MAP_AT','RECORDED_LIST','RECORDED_PARENT','PROGRESS_VALUE'].map(t=>block(t))),
      group('Positions and lists',265,['POSITION_VALUE','OFFSET_POSITION','POSITION_DISTANCE','RECORD_FIELD','LIST_VALUE'].map(t=>block(t)))
    ])
  ]};
}
export function scaffoldWorkspace(B,workspace){
  appState.scaffoldedTasks??=new Set();let added=false;
  const maxY=Math.max(-180,...workspace.getTopBlocks(false).map(b=>b.getRelativeToSurfaceXY().y+200));let y=maxY+220;
  for(const s of LEARNER_SCAFFOLDS.filter(s=>appState.selectedTasks.includes(s.taskId)&&!appState.scaffoldedTasks.has(s.taskId))){
    appState.scaffoldedTasks.add(s.taskId);
    if(workspace.getTopBlocks(false).some(b=>b.type==='LEARNER_BEHAVIOR'&&b.getFieldValue('TASK')===s.taskId))continue;
    const b=workspace.newBlock('LEARNER_BEHAVIOR');b.setFieldValue(s.name,'NAME');b.setFieldValue(s.taskId,'TASK');b.initSvg();b.render();b.moveBy(24,y);
    const branch=workspace.newBlock('controls_if');branch.initSvg();branch.render();b.getInput('BODY').connection.connect(branch.previousConnection);y+=210;added=true;
  }return added;
}
