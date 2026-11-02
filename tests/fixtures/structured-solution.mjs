import { appState } from '../../js/state.js';
let id=0;
const n=(type,fields={})=>({id:`authored-${++id}`,type,...fields});
const a=command=>n('action',{command});
const c=(sensor,command)=>n('condition',{sensor,command});
const and=(...operands)=>n('and',{operands});
const iff=(condition,body,otherwise=[])=>n('if',{branches:[{condition,body}],otherwise});
const behavior=(taskId,priority,body)=>n('behavior',{taskId,priority,body});
// Test-only learner design. Never loaded into the product or initial workspace.
export function authorStructuredSolution(stage){
  appState.installedSensors=new Set(['SENSE_05','SENSE_07','SENSE_04','SENSE_01','SENSE_09','SENSE_02','SENSE_03',...(stage>=2?['SENSE_06']:[]),...(stage>=3?['SENSE_15','SENSE_08']:[])]);
  appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_VACUUM','ACTUATOR_ESTOP','ACTUATOR_DOCK_PIN',...(stage>=2?['ACTUATOR_MOP']:[]),...(stage>=3?['ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']:[])]);
  const program=[behavior('TASK_4',100,[iff(c('SENSE_01','COND_07'),[a('ACT_06')])]),behavior('TASK_5',90,[iff(c('SENSE_09','COND_12'),[a('ACT_07')],[a('ACT_08')])]),behavior('TASK_6',70,[iff(c('SENSE_02','COND_08'),[a('ACT_26'),iff(c('SENSE_03','COND_10'),[a('ACT_17')])])]),behavior('TASK_6',70,[iff(c('SENSE_02','COND_09'),[a('ACT_27')])])];
  if(stage>=2)program.push(behavior('TASK_3',80,[iff(c('SENSE_06','COND_04'),[a('ACT_10'),a('ACT_11')],[a('ACT_12')])]));
  program.push(behavior('TASK_1',50,[iff(stage>=2?and(c('SENSE_05','COND_03'),c('SENSE_06','COND_21')):c('SENSE_05','COND_03'),[a('ACT_09')],[a('ACT_10')])]));
  if(stage>=3)program.push(behavior('TASK_2',40,[iff(c('SENSE_02','COND_08'),[],[iff(c('SENSE_15','COND_16'),[a('ACT_24')],[iff(c('SENSE_15','COND_17'),[a('ACT_25')])]),iff(c('SENSE_08','COND_15'),[a('ACT_13'),a('ACT_14')],[iff(c('SENSE_03','COND_10'),[a('ACT_15')])])])]));
  if(!appState.setProgram(program))throw new Error('Invalid authored test program');
  return program;
}
