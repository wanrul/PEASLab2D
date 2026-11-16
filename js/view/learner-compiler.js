const sensors={READ_DISTANCE:'SENSE_04',READ_ANIMAL:'SENSE_01',READ_PERSON:'SENSE_09',READ_DIRT:'SENSE_05',READ_WET:'SENSE_06',READ_BATTERY:'SENSE_02',READ_POSITION:'SENSE_07',READ_DESTINATION:'SENSE_03',READ_VISION:'SENSE_15',READ_GRIP:'SENSE_08',READ_WEIGHT:'SENSE_11',READ_TIMER:'SENSE_12',READ_LIGHT:'SENSE_10',READ_SOUND:'SENSE_13',READ_EDGE:'SENSE_14',READ_STATE:'STATE'};
export function compileLearnerWorkspace(workspace){
  const errors=[],program=[];
  const expr=b=>{
    if(!b)throw new Error('Fill the empty condition or value input.');
    const n={id:b.id},f=name=>b.getFieldValue(name),input=name=>expr(b.getInputTargetBlock(name));
    if(b.type==='math_number')return {...n,type:'literal',value:Number(f('NUM'))};
    if(b.type==='text'||b.type==='STATUS_VALUE')return {...n,type:'literal',value:f(b.type==='text'?'TEXT':'VALUE')};
    if(b.type==='logic_boolean')return {...n,type:'literal',value:f('BOOL')==='TRUE'};
    if(sensors[b.type])return {...n,type:'reading',sensor:sensors[b.type],field:f('FIELD')||(b.type==='READ_BATTERY'?'level':b.type==='READ_DISTANCE'?'distance':'state'),direction:f('DIRECTION')||'front'};
    if(b.type==='VALUE_COMPARE'||b.type==='logic_compare')return {...n,type:'compare',op:({EQ:'=',NEQ:'!=',LT:'<',LTE:'<=',GT:'>',GTE:'>='})[f('OP')]||f('OP'),left:input('A'),right:input('B')};
    if(b.type==='logic_operation')return {...n,type:f('OP')==='AND'?'and':'or',left:input('A'),right:input('B')};
    if(b.type==='logic_negate')return {...n,type:'not',value:input('BOOL')};
    if(b.type==='READING_AVAILABLE')return {...n,type:'available',value:input('VALUE')};
    if(b.type==='GET_LEARNER_VARIABLE')return {...n,type:'variable',name:f('NAME')};
    if(b.type==='TASK_SETTING')return {...n,type:'setting',key:f('FIELD')};
    if(b.type==='math_arithmetic')return {...n,type:'arithmetic',op:({ADD:'+',MINUS:'-',MULTIPLY:'*',DIVIDE:'/',POWER:'^'})[f('OP')],left:input('A'),right:input('B')};
    if(b.type==='math_single')return {...n,type:'numberFunction',op:({ROOT:'sqrt',ABS:'abs',NEG:'neg',LN:'log',LOG10:'log10',EXP:'exp',POW10:'pow10'})[f('OP')],value:input('NUM')};
    if(b.type==='MAP_VALUE')return {...n,type:'record',source:'map',field:f('FIELD'),direction:f('DIRECTION')};
    if(b.type==='MAP_AT')return {...n,type:'record',source:'map',field:f('FIELD'),position:input('POSITION')};
    if(b.type==='RECORDED_LIST')return {...n,type:'record',source:f('SOURCE'),field:'all'};
    if(b.type==='RECORDED_PARENT')return {...n,type:'record',source:'path',field:'parent'};
    if(b.type==='PROGRESS_VALUE')return {...n,type:'record',source:'progress',field:f('FIELD')};
    if(b.type==='POSITION_VALUE')return {...n,type:'coordinate',x:input('X'),y:input('Y')};
    if(b.type==='OFFSET_POSITION')return {...n,type:'offset',position:input('POSITION'),direction:f('DIRECTION'),distance:input('DISTANCE')};
    if(b.type==='POSITION_DISTANCE')return {...n,type:f('OP'),left:input('A'),right:input('B')};
    if(b.type==='RECORD_FIELD')return {...n,type:'field',record:input('RECORD'),field:f('FIELD')};
    if(b.type==='LIST_EMPTY'||b.type==='LIST_CONTAINS')return {...n,type:'list',op:b.type==='LIST_EMPTY'?'empty':'contains',list:input('LIST'),...(b.type==='LIST_CONTAINS'?{item:input('ITEM')}:{})};
    if(b.type==='LIST_VALUE'){const op=f('OP');return {...n,type:'list',op,...(op!=='create'?{list:input('LIST')} :{}),...(['item','insert','remove'].includes(op)?{index:input('INDEX')} :{}),...(['append','insert'].includes(op)?{item:input('ITEM')} :{})};}
    throw new Error('Place a Sense, Condition or value block in this input.');
  };
  const sequence=first=>{const xs=[];for(let b=first;b;b=b.getNextBlock())xs.push(statement(b));return xs;};
  const statement=b=>{
    const n={id:b.id},f=name=>b.getFieldValue(name),input=name=>expr(b.getInputTargetBlock(name));
    if(b.type==='controls_if'){const branches=[];for(let i=0;b.getInput(`IF${i}`);i++)branches.push({condition:input(`IF${i}`),body:sequence(b.getInputTargetBlock(`DO${i}`))});return {...n,type:'if',branches,otherwise:sequence(b.getInputTargetBlock('ELSE'))};}
    if(b.type==='SET_LEARNER_VARIABLE')return {...n,type:'setVariable',name:f('NAME'),value:input('VALUE')};
    if(b.type==='controls_repeat_ext')return {...n,type:'repeatCount',count:input('TIMES'),body:sequence(b.getInputTargetBlock('DO'))};
    if(b.type==='controls_whileUntil')return {...n,type:f('MODE')==='UNTIL'?'repeatUntil':'repeatWhile',condition:input('BOOL'),body:sequence(b.getInputTargetBlock('DO'))};
    if(b.type==='LEARNER_FOREACH')return {...n,type:'forEach',name:f('NAME'),list:input('LIST'),body:sequence(b.getInputTargetBlock('BODY'))};
    if(b.type==='controls_flow_statements')return {...n,type:f('FLOW')==='CONTINUE'?'continue':'break'};
    if(b.type==='WAIT_SECONDS')return {...n,type:'wait',duration:input('TIME')};
    if(b.type==='WAIT_UNTIL')return {...n,type:'waitUntil',condition:input('CONDITION')};
    if(b.type==='LEARNER_CALL')return {...n,type:'call',name:f('NAME')};
    if(b.type==='LEARNER_RETURN')return {...n,type:'return'};
    const commands={
      ROBOT_MOVE:()=>['move',{direction:f('DIRECTION'),distance:input('DISTANCE')}],ROBOT_TURN:()=>['turn',{direction:f('DIRECTION'),angle:input('ANGLE')}],ROBOT_HEADING:()=>['heading',{angle:input('ANGLE')}],ROBOT_SPEED:()=>['speed',{value:input('VALUE')}],ROBOT_STOP:()=>['stop',{}],
      ROBOT_VACUUM:()=>['vacuum',{state:f('STATE')}],ROBOT_MOP:()=>['mop',{state:f('STATE')}],ROBOT_ARM:()=>['arm',{state:f('STATE'),distance:input('DISTANCE')}],ROBOT_GRIPPER:()=>['gripper',{state:f('STATE')}],ROBOT_DOCK:()=>['dock',{state:f('STATE')}],ROBOT_GOAL:()=>['goal',{target:f('TARGET')}],ROBOT_GOAL_POSITION:()=>['goalPosition',{position:input('POSITION')}],ROBOT_BIN:()=>['bin',{}],ROBOT_LED:()=>['led',{color:f('COLOR')}],ROBOT_SOUND:()=>['sound',{sound:f('SOUND')}]
    };
    if(commands[b.type]){const [command,args]=commands[b.type]();return {...n,type:'command',command,args};}
    throw new Error('Attach an Action or Control statement inside a Behavior.');
  };
  for(const b of workspace.getTopBlocks(true)){
    try{
      if(b.type==='LEARNER_DEFINE'){program.push({id:b.id,type:'procedure',name:b.getFieldValue('NAME'),body:sequence(b.getInputTargetBlock('BODY'))});continue;}
      if(b.type!=='LEARNER_BEHAVIOR'){errors.push('Attach loose blocks inside a Behavior.');continue;}
      const body=sequence(b.getInputTargetBlock('BODY'));if(!body.length)throw new Error('Add conditions and actions to this Behavior.');
      program.push({id:b.id,type:'behavior',model:'learner',taskId:b.getFieldValue('TASK'),name:b.getFieldValue('NAME'),priority:Number(b.getFieldValue('PRIORITY')),body});
    }catch(e){errors.push(`${b.getFieldValue?.('NAME')||'Draft'}: ${e.message}`);}
  }return {program,errors:[...new Set(errors)]};
}
