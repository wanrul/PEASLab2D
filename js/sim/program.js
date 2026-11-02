import { ACTION_BLOCKS, CONDITION_BLOCKS, SENSE_BLOCKS } from '../data/blocks.js';
const actions = new Set(ACTION_BLOCKS.map(b=>b.id));
const sensors = new Set(SENSE_BLOCKS.map(b=>b.id));
/** Serializable, acyclic tree; no executable strings, at most 512 nodes / depth 32. */
export function validateProgram(program) {
  const seen=new Set(), ids=new Set(); let count=0;
  const list=(xs,depth)=>Array.isArray(xs)&&xs.every(x=>['action','if','sequence','repeatUntil','repeatWhile','waitUntil','wait'].includes(x?.type)&&node(x,depth+1));
  const node=(n,depth)=>{
    if(!n||typeof n!=='object'||seen.has(n)||typeof n.id!=='string'||!n.id||ids.has(n.id)||++count>512||depth>32)return false;
    seen.add(n);ids.add(n.id);
    switch(n.type){
      case 'behavior': return /^TASK_[1-6]$/.test(n.taskId)&&Number.isFinite(n.priority)&&list(n.body,depth);
      case 'action': return actions.has(n.command);
      case 'condition': return sensors.has(n.sensor)&&Boolean(CONDITION_BLOCKS.find(b=>b.id===n.command)?.requiresSense.includes(n.sensor));
      case 'sense': return sensors.has(n.sensor);
      case 'and': case 'or': return Array.isArray(n.operands)&&n.operands.length>=2&&n.operands.every(x=>expr(x,depth+1));
      case 'if': return Array.isArray(n.branches)&&n.branches.length>0&&n.branches.every(b=>expr(b.condition,depth+1)&&list(b.body,depth))&&list(n.otherwise,depth);
      case 'sequence': return list(n.body,depth);
      case 'repeatUntil': case 'repeatWhile': return expr(n.condition,depth+1)&&list(n.body,depth);
      case 'waitUntil': return expr(n.condition,depth+1);
      case 'wait': return Number.isInteger(n.ticks)&&n.ticks>=1&&n.ticks<=36000;
      default: return false;
    }
  };
  const expr=(n,depth)=>['condition','sense','and','or'].includes(n?.type)&&node(n,depth);
  return Array.isArray(program)&&program.every(n=>n?.type==='behavior'&&node(n,0));
}
/** Unknown is contagious, deliberately including OR: every authored channel must be available. */
export function evaluateCondition(node, engine, percepts, mounted) {
  if(node.type==='and'||node.type==='or'){
    const values=node.operands.map(n=>evaluateCondition(n,engine,percepts,mounted));
    if(values.includes(null))return null;
    return node.type==='and'?values.every(Boolean):values.some(Boolean);
  }
  const value=percepts[node.sensor];
  engine.programReads?.push({nodeId:node.id,sensor:node.sensor,condition:node.command||null,value:value??'UNKNOWN'});
  if(!mounted.has(node.sensor)||value===undefined||value===null||['NOT_INSTALLED','NOT_MODELLED','UNKNOWN'].includes(value)){engine.programDiagnostic={nodeId:node.id,sense:node.sensor,decide:`Unavailable input: ${node.sensor} (${value??'UNKNOWN'})`,act:null};return null;}
  if(node.type==='sense')return true;
  if(node.command==='COND_06'&&(!mounted.has('SENSE_05')||!['CLEAN','DIRTY'].includes(percepts.SENSE_05)))return null;
  if(['COND_23','COND_24'].includes(node.command)&&percepts.mapForwardVisited===undefined)return null;
  return engine.conditionPassed(node.sensor,node.command,percepts);
}
/** Cooperative interpreter state is plain data so preview can snapshot/restore it. */
export function evaluateProgram(engine, program, percepts, state) {
  let budget=256;
  engine.programDiagnostic=null;
  engine.programReads=[];
  const memory=engine.programRuntime;
  const waiting=node=>({nodeId:node.id,action:null,waiting:true});
  const clear=n=>{delete memory[n.id];delete memory[`${n.id}:branch`];if(n.body)n.body.forEach(clear);if(n.branches)n.branches.forEach(b=>b.body.forEach(clear));if(n.otherwise)n.otherwise.forEach(clear);};
  const sequence=(owner,body)=>{
    const m=memory[owner] ||= {index:0};
    while(m.index<body.length){
      const result=visit(body[m.index]);
      if(result){
        if(result.complete)m.index++;
        const complete=m.index===body.length;
        if(complete)m.index=0;
        return {...result,complete};
      }
      m.index++;
    }
    m.index=0;return null;
  };
  const visit=n=>{
    if(--budget<0)return waiting(n);
    if(n.type==='action'){
      const required=ACTION_BLOCKS.find(b=>b.id===n.command)?.requiresActuator;
      if(required&&!state.installedActuators.has(required))return {...waiting(n),blocked:required};
      if(['ACT_01','ACT_02'].includes(n.command)&&!state.installedActuators.has('ACTUATOR_ROTATION'))return {...waiting(n),blocked:'ACTUATOR_ROTATION'};
      if(engine.actionAlreadySatisfied(n.command))return null;
      return {nodeId:n.id,action:n.command,complete:true};
    }
    if(n.type==='if'){
      let selected=-1;
      for(let i=0;i<n.branches.length;i++){
        const value=evaluateCondition(n.branches[i].condition,engine,percepts,state.installedSensors);
        if(value===null){clear(n);return null;}
        if(value){selected=i;break;}
      }
      const m=memory[n.id];
      if(m?.selected!==selected){clear(n);memory[n.id]={selected};}
      return sequence(`${n.id}:branch`,selected<0?n.otherwise:n.branches[selected].body);
    }
    if(n.type==='sequence')return sequence(n.id,n.body);
    if(n.type==='wait'){
      const m=memory[n.id] ||= {since:engine.tickCount};
      if(engine.tickCount-m.since<n.ticks)return waiting(n);
      delete memory[n.id];return null;
    }
    const value=evaluateCondition(n.condition,engine,percepts,state.installedSensors);
    if(value===null)return waiting(n);
    if(n.type==='waitUntil')return value?null:waiting(n);
    if((n.type==='repeatUntil'&&value)||(n.type==='repeatWhile'&&!value)){clear(n);return null;}
    return {...(sequence(n.id,n.body)||waiting(n)),complete:false};
  };
  for(const b of program.filter(b=>state.selectedTasks.includes(b.taskId)).sort((a,b)=>b.priority-a.priority)){
    const result=sequence(b.id,b.body);
    if(result)return {...result,ruleId:b.id,taskId:b.taskId,priority:b.priority,trace:{ruleId:b.id,taskId:b.taskId,nodeId:result.nodeId,sense:engine.programReads.map(r=>`${r.sensor}: ${typeof r.value==='object'?JSON.stringify(r.value):r.value}`).join('; '),conditions:structuredClone(engine.programReads),action:result.action,decide:result.blocked?`Missing actuator: ${result.blocked}`:result.waiting?'Waiting': 'Program'}};
  }
  return null;
}
