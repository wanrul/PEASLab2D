import { appState } from '../state.js';
import { SENSE_BLOCKS, CONDITION_BLOCKS, ACTION_BLOCKS, CONTROL_BLOCKS, DEFAULT_RULE_TEMPLATES } from '../data/blocks.js';
export function defineBlocks(B) {
  if(B.Blocks.PEAS_BEHAVIOR)return;
  const tasks=()=>DEFAULT_RULE_TEMPLATES.map(t=>[`${!appState.selectedTasks.includes(t.taskId)?'Future mission: ':['TASK_4','TASK_5','TASK_6'].includes(t.taskId)?'Common: ':''}${t.taskName}`,t.taskId]);
  const header=(type,name,priority)=>({type,message0:`${name} %1 priority %2`,args0:[{type:'field_dropdown',name:'TASK',options:tasks},{type:'field_number',name:'PRIORITY',value:priority,min:1,max:100,precision:1}],message1:'DO %1',args1:[{type:'input_statement',name:'BODY'}],colour:265,tooltip:'Execution priority is separate from nesting. Higher numbers run first; a waiting behavior holds its priority.'});
  B.common.defineBlocksWithJsonArray([
    header('PEAS_BEHAVIOR','BEHAVIOR',1),header('CTRL_05','PRIORITY: HIGH',10),header('CTRL_06','PRIORITY: NORMAL',1),
    ...SENSE_BLOCKS.map(b=>({type:b.id,message0:b.name,output:'Sensor',colour:205,tooltip:b.desc})),
    ...CONDITION_BLOCKS.map(b=>({type:b.id,message0:`${b.name} %1`,args0:[{type:'input_value',name:'SENSOR',check:'Sensor'}],output:'Boolean',colour:45,tooltip:`${b.desc} Compatible: ${b.requiresSense.join(', ')}`})),
    ...ACTION_BLOCKS.map(b=>({type:b.id,message0:b.name,previousStatement:null,nextStatement:null,colour:155,tooltip:b.desc})),
    ...[['CTRL_01','REPEAT UNTIL done'],['CTRL_02','REPEAT WHILE true']].map(([type,name])=>({type,message0:`${name} %1`,args0:[{type:'input_value',name:'CONDITION',check:'Boolean'}],message1:'DO %1',args1:[{type:'input_statement',name:'BODY'}],previousStatement:null,nextStatement:null,colour:265})),
    {type:'CTRL_03',message0:'WAIT 2 seconds',previousStatement:null,nextStatement:null,colour:265},
    {type:'CTRL_04',message0:'THEN (sequence) %1',args0:[{type:'input_statement',name:'BODY'}],previousStatement:null,nextStatement:null,colour:265},
    {type:'WAIT_UNTIL',message0:'WAIT UNTIL %1',args0:[{type:'input_value',name:'CONDITION',check:'Boolean'}],previousStatement:null,nextStatement:null,colour:265}
  ]);
}
export function toolbox() {
  const category=(name,colour,types)=>({kind:'category',name,colour,contents:types.map(type=>({kind:'block',type}))});
  return {kind:'categoryToolbox',contents:[category('Behavior',265,['PEAS_BEHAVIOR']),category('Sense',205,SENSE_BLOCKS.map(b=>b.id)),category('Condition',45,[...CONDITION_BLOCKS.map(b=>b.id),'logic_operation']),category('Action',155,ACTION_BLOCKS.map(b=>b.id)),category('Control',265,['controls_if',...CONTROL_BLOCKS.map(b=>b.id),'WAIT_UNTIL'])]};
}
/** Compile only connected trees. Incomplete drafts stay in workspace, never execute an older hidden tree. */
export function compileWorkspace(workspace) {
  const errors=[];
  const expr=b=>{
    if(!b)throw new Error('Connect a condition and its sensor.');
    if(b.type==='logic_operation')return {id:b.id,type:b.getFieldValue('OP')==='AND'?'and':'or',operands:[expr(b.getInputTargetBlock('A')),expr(b.getInputTargetBlock('B'))]};
    const sensor=b.getInputTargetBlock('SENSOR');
    if(!sensor||!CONDITION_BLOCKS.find(c=>c.id===b.type)?.requiresSense.includes(sensor.type))throw new Error('Connect a compatible Sense block to each Condition.');
    return {id:b.id,type:'condition',command:b.type,sensor:sensor.type};
  };
  const sequence=first=>{const body=[];for(let b=first;b;b=b.getNextBlock())body.push(statement(b));return body;};
  const statement=b=>{
    const n={id:b.id};
    if(ACTION_BLOCKS.some(a=>a.id===b.type))return {...n,type:'action',command:b.type};
    if(b.type==='controls_if'){
      const branches=[];
      for(let i=0;b.getInput(`IF${i}`);i++)branches.push({condition:expr(b.getInputTargetBlock(`IF${i}`)),body:sequence(b.getInputTargetBlock(`DO${i}`))});
      return {...n,type:'if',branches,otherwise:sequence(b.getInputTargetBlock('ELSE'))};
    }
    if(b.type==='CTRL_03')return {...n,type:'wait',ticks:20};
    if(b.type==='CTRL_04')return {...n,type:'sequence',body:sequence(b.getInputTargetBlock('BODY'))};
    if(['CTRL_01','CTRL_02','WAIT_UNTIL'].includes(b.type))return {...n,type:{CTRL_01:'repeatUntil',CTRL_02:'repeatWhile',WAIT_UNTIL:'waitUntil'}[b.type],condition:expr(b.getInputTargetBlock('CONDITION')),...(b.type==='WAIT_UNTIL'?{}:{body:sequence(b.getInputTargetBlock('BODY'))})};
    throw new Error('Attach action and control blocks inside a Behavior.');
  };
  const program=[];
  for(const b of workspace.getTopBlocks(true)){
    if(!['PEAS_BEHAVIOR','CTRL_05','CTRL_06'].includes(b.type)){errors.push('Attach action and control blocks inside a Behavior.');continue;}
    try{const body=sequence(b.getInputTargetBlock('BODY'));if(!body.length)throw new Error('Add actions inside your Behavior.');program.push({id:b.id,type:'behavior',taskId:b.getFieldValue('TASK'),priority:Number(b.getFieldValue('PRIORITY')),body});}catch(e){errors.push(e.message);}
  }
  return {program,errors:[...new Set(errors)]};
}
