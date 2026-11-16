import {ACTION_BLOCKS} from '../data/blocks.js';
const scalarOps=new Set(['literal','reading','variable','arithmetic','compare','and','or','not','available','setting','record','coordinate','offset','distance','direction','list','field','numberFunction']);
const statements=new Set(['command','action','if','setVariable','repeatCount','repeatWhile','repeatUntil','forEach','wait','waitUntil','sequence','call','return','break','continue']);
const operators=new Set(['+','-','*','/','%','^','min','max','=','!=','<','<=','>','>=']);
export function validateLearnerProgram(program){
  const ids=new Set(),seen=new Set();let count=0;
  const object=(n,depth)=>{if(!n||typeof n!=='object'||seen.has(n)||!n.id||ids.has(n.id)||++count>1024||depth>40)return false;seen.add(n);ids.add(n.id);return true;};
  const list=(xs,d)=>Array.isArray(xs)&&xs.every(n=>statement(n,d+1));
  const expr=(n,d)=>{if(!object(n,d)||!scalarOps.has(n.type))return false;
    if(n.type==='literal')return ['string','number','boolean'].includes(typeof n.value)&&(!(typeof n.value==='number')||Number.isFinite(n.value));
    if(['variable','setting','record','reading'].includes(n.type))return typeof(n.name||n.key||n.source||n.sensor)==='string'&&(!n.index||expr(n.index,d+1))&&(!n.position||expr(n.position,d+1));
    if(['arithmetic','compare','and','or'].includes(n.type))return (['and','or'].includes(n.type)||operators.has(n.op))&&expr(n.left,d+1)&&expr(n.right,d+1);
    if(['not','available','numberFunction'].includes(n.type))return expr(n.value,d+1);
    if(n.type==='coordinate')return expr(n.x,d+1)&&expr(n.y,d+1);
    if(n.type==='offset')return expr(n.position,d+1)&&expr(n.distance,d+1);
    if(['distance','direction'].includes(n.type))return expr(n.left,d+1)&&expr(n.right,d+1);
    if(n.type==='field')return expr(n.record,d+1)&&typeof n.field==='string';
    if(n.type==='list')return (!n.list||expr(n.list,d+1))&&(!n.index||expr(n.index,d+1))&&(!n.item||expr(n.item,d+1));
    return false;};
  const statement=(n,d)=>{if(!object(n,d)||!statements.has(n.type))return false;
    if(n.type==='command')return typeof n.command==='string'&&n.args&&Object.values(n.args).every(v=>typeof v==='string'||expr(v,d+1));
    if(n.type==='action')return ACTION_BLOCKS.some(a=>a.id===n.command);
    if(n.type==='setVariable')return typeof n.name==='string'&&expr(n.value,d+1);
    if(n.type==='if')return Array.isArray(n.branches)&&n.branches.length>0&&n.branches.every(b=>expr(b.condition,d+1)&&list(b.body,d+1))&&list(n.otherwise,d+1);
    if(n.type==='sequence')return list(n.body,d+1);
    if(n.type==='repeatCount')return expr(n.count,d+1)&&list(n.body,d+1);
    if(['repeatWhile','repeatUntil'].includes(n.type))return expr(n.condition,d+1)&&list(n.body,d+1);
    if(n.type==='forEach')return typeof n.name==='string'&&expr(n.list,d+1)&&list(n.body,d+1);
    if(n.type==='wait')return n.duration?expr(n.duration,d+1):Number.isInteger(n.ticks)&&n.ticks>0&&n.ticks<=36000;
    if(n.type==='waitUntil')return expr(n.condition,d+1);
    if(n.type==='call')return typeof n.name==='string';
    if(n.type==='return')return !n.value||expr(n.value,d+1);
    return n.type==='break'||n.type==='continue';};
  return Array.isArray(program)&&program.every(n=>object(n,0)&&(n.type==='procedure'?typeof n.name==='string'&&list(n.body,1):n.type==='behavior'&&/^TASK_[1-6]$/.test(n.taskId)&&Number.isFinite(n.priority)&&n.priority>=0&&list(n.body,1)));
}
const clone=v=>v===undefined?null:structuredClone(v);
export function learnerValue(n,engine,p){
  if(!n)return null;
  const v=x=>learnerValue(x,engine,p),unknown=x=>x===null||x===undefined;
  switch(n.type){
    case 'literal':return n.value;
    case 'variable':return clone(engine.learnerVariables[n.name]??null);
    case 'reading':{const value=engine.learnerRead(n,p);engine.programReads.push({nodeId:n.id,sensor:n.sensor,value:value??'UNKNOWN'});return value;}
    case 'setting':return engine.learnerSetting(n.key);
    case 'record':return engine.learnerRecord(n.source,n.field,n.direction,n.index?v(n.index):undefined,n.position?v(n.position):undefined);
    case 'available':return !unknown(v(n.value));
    case 'not':{const x=v(n.value);return unknown(x)?null:!x;}
    case 'and':case 'or':{const a=v(n.left),b=v(n.right);return unknown(a)||unknown(b)?null:n.type==='and'?Boolean(a&&b):Boolean(a||b);}
    case 'compare':{const a=v(n.left),b=v(n.right);if(unknown(a)||unknown(b))return null;if(engine.currentLearnerTask==='TASK_6'){if(n.left.type==='reading'&&n.left.sensor==='SENSE_02'&&['<','<='].includes(n.op)&&Number.isFinite(b)&&b>=0&&b<=100)engine.authoredLowThreshold=b;if(n.right.type==='reading'&&n.right.sensor==='SENSE_02'&&['>','>='].includes(n.op)&&Number.isFinite(a)&&a>=0&&a<=100)engine.authoredLowThreshold=a;}return ({'=':()=>JSON.stringify(a)===JSON.stringify(b),'!=':()=>JSON.stringify(a)!==JSON.stringify(b),'<':()=>a<b,'<=':()=>a<=b,'>':()=>a>b,'>=':()=>a>=b})[n.op]?.()??null;}
    case 'arithmetic':{const a=v(n.left),b=v(n.right);if(!Number.isFinite(a)||!Number.isFinite(b))return null;const result=({'+':()=>a+b,'-':()=>a-b,'*':()=>a*b,'/':()=>b?a/b:NaN,'%':()=>b?a%b:NaN,'^':()=>a**b,min:()=>Math.min(a,b),max:()=>Math.max(a,b)})[n.op]?.();return Number.isFinite(result)?result:null;}
    case 'numberFunction':{const x=v(n.value),result=Number.isFinite(x)?({abs:Math.abs,floor:Math.floor,ceil:Math.ceil,round:Math.round,sqrt:Math.sqrt,neg:x=>-x,log:Math.log,log10:Math.log10,exp:Math.exp,pow10:x=>10**x})[n.op]?.(x):null;return Number.isFinite(result)?result:null;}
    case 'coordinate':{const x=v(n.x),y=v(n.y);return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;}
    case 'offset':{const pos=v(n.position),d=v(n.distance),angle=engine.world.robot.heading+({front:0,back:Math.PI,left:-Math.PI/2,right:Math.PI/2}[n.direction]??0);return pos&&Number.isFinite(d)?{x:pos.x+Math.cos(angle)*d,y:pos.y+Math.sin(angle)*d}:null;}
    case 'distance':case 'direction':{const a=v(n.left),b=v(n.right);if(!a||!b)return null;return n.type==='distance'?Math.hypot(a.x-b.x,a.y-b.y):Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;}
    case 'field':{const r=v(n.record);return r&&typeof r==='object'?clone(r[n.field]??null):null;}
    case 'list':{const xs=n.list?v(n.list):[],i=n.index?v(n.index):0,item=n.item?v(n.item):undefined;if(!Array.isArray(xs))return null;if(['contains','append','insert'].includes(n.op)&&unknown(item))return null;if(['item','insert','remove'].includes(n.op)&&(!Number.isInteger(i)||i<0||i>xs.length||(n.op!=='insert'&&i===xs.length)))return null;
      if(n.op==='create')return [];
      if(n.op==='length')return xs.length;
      if(n.op==='empty')return !xs.length;
      if(n.op==='contains')return xs.some(x=>JSON.stringify(x)===JSON.stringify(item));
      if(n.op==='item')return clone(xs[i]??null);
      if(n.op==='append')return [...xs,clone(item)].slice(0,4096);
      if(n.op==='insert'){const out=xs.slice();out.splice(Math.max(0,i),0,clone(item));return out.slice(0,4096);}
      if(n.op==='remove')return xs.filter((_,index)=>index!==i);
      return null;}
    default:return null;
  }
}
function legacyCommand(n){return {ACT_01:['move',{direction:'forward',distance:.1}],ACT_02:['move',{direction:'backward',distance:.1}],ACT_03:['turn',{direction:'left',angle:90}],ACT_04:['turn',{direction:'right',angle:90}],ACT_05:['turn',{direction:'right',angle:180}],ACT_06:['stop',{}],ACT_07:['speed',{value:.4}],ACT_08:['speed',{value:1}],ACT_09:['vacuum',{state:'on'}],ACT_10:['vacuum',{state:'off'}],ACT_11:['mop',{state:'deploy'}],ACT_12:['mop',{state:'retract'}],ACT_13:['arm',{state:'extend',distance:.6}],ACT_16:['arm',{state:'retract',distance:.6}],ACT_14:['gripper',{state:'close'}],ACT_15:['gripper',{state:'open'}],ACT_17:['dock',{state:'engage'}],ACT_27:['dock',{state:'release'}],ACT_24:['goal',{target:'BIN'}],ACT_25:['goal',{target:'TABLE'}],ACT_26:['goal',{target:'DOCK'}],ACT_21:['bin',{}],ACT_18:['led',{color:'red'}],ACT_19:['led',{color:'amber'}],ACT_20:['led',{color:'blue'}],ACT_22:['sound',{sound:'beep'}],ACT_23:['sound',{sound:'chime'}]}[n.command];}
/** Bounded cooperative interpreter. Only authored primitive commands can move the robot. */
export function runLearnerProgram(engine,program,p,state){
  engine.programReads=[];engine.programDiagnostic=null;
  const memory=engine.programRuntime,claims=new Map(),used=new Set(),events=[];let budget=1024,frame='';
  const runtimeKey=id=>frame?`${frame}/${id}`:id;
  const definitions=new Map(program.filter(n=>n.type==='procedure').map(n=>[n.name,n]));
  const value=n=>learnerValue(n,engine,p);
  const clear=n=>{if(current){const held=memory[current.id]?.held;for(const resource of Object.keys(held||{}))if(!used.has(resource)&&claims.get(resource)===current.id)claims.delete(resource);if(memory[current.id])delete memory[current.id].held;}const runtimeId=runtimeKey(n.id);delete memory[runtimeId];delete memory[`${runtimeId}:branch`];delete engine.learnerMotion[runtimeId];if(n.type==='call'){for(const k of Object.keys(memory))if(k===`${runtimeId}:call`||k.startsWith(`${runtimeId}/`))delete memory[k];for(const k of Object.keys(engine.learnerMotion))if(k.startsWith(`${runtimeId}/`))delete engine.learnerMotion[k];}for(const b of n.branches||[])b.body.forEach(clear);for(const x of n.body||[])clear(x);for(const x of n.otherwise||[])clear(x);};
  let current;
  const seq=(key,body)=>{const m=memory[key]||={index:0};while(m.index<body.length){const result=visit(body[m.index]);if(result==='wait')return 'wait';if(result==='break'||result==='return'||result==='continue'){m.index=0;return result;}m.index++;}m.index=0;return 'done';};
  const visit=n=>{
    if(--budget<0)return 'wait';
    if(n.type==='setVariable'){const x=value(n.value);if(x===null){engine.programDiagnostic={nodeId:n.id,decide:'Unavailable value; variable was not changed'};return 'wait';}engine.learnerVariables[n.name]=clone(x);return 'done';}
    if(n.type==='command'||n.type==='action'){
      const [command,raw]=n.type==='action'?(legacyCommand(n)||['unknown',{}]):[n.command,n.args];
      const args=Object.fromEntries(Object.entries(raw).map(([k,x])=>[k,typeof x==='object'?value(x):x]));
      if(Object.values(args).some(x=>x===null)){engine.programDiagnostic={nodeId:n.id,decide:'Unavailable command input'};return 'wait';}
      const resource=({move:'motion',turn:'motion',heading:'motion',stop:'motion',speed:'speed',vacuum:'vacuum',mop:'mop',arm:'arm',gripper:'gripper',dock:'dock',goal:'goal',goalPosition:'goal',bin:'bin',led:'led',sound:'sound'})[command]||command;
      if((claims.has(resource)&&claims.get(resource)!==current.id)||used.has(resource))return 'wait';
      claims.set(resource,current.id);used.add(resource);
      const result=engine.performLearnerCommand(command,args,runtimeKey(n.id));
      events.push({nodeId:n.id,action:command,args,taskId:current.taskId,ruleId:current.id,priority:current.priority,executed:result!=='blocked'});
      return result==='done'?'done':'wait';
    }
    if(n.type==='if'){
      let selected=-1;for(let i=0;i<n.branches.length;i++){const x=value(n.branches[i].condition);if(x===null){clear(n);engine.programDiagnostic={nodeId:n.id,decide:'Unavailable input: this IF does not enter ELSE'};return 'done';}if(x){selected=i;break;}}
      if(memory[runtimeKey(n.id)]?.selected!==selected){clear(n);memory[runtimeKey(n.id)]={selected};}
      return seq(`${runtimeKey(n.id)}:branch`,selected<0?n.otherwise:n.branches[selected].body);
    }
    if(n.type==='sequence')return seq(runtimeKey(n.id),n.body);
    if(n.type==='wait'){const seconds=n.duration?value(n.duration):null;if(n.duration&&(!Number.isFinite(seconds)||seconds<0||seconds>3600))return 'wait';const m=memory[runtimeKey(n.id)]||={since:engine.tickCount,ticks:n.duration?Math.round(seconds*10):n.ticks};if(engine.tickCount-m.since<m.ticks)return 'wait';delete memory[runtimeKey(n.id)];return 'done';}
    if(n.type==='waitUntil'){const x=value(n.condition);return x===true?'done':'wait';}
    if(n.type==='break'||n.type==='return'||n.type==='continue')return n.type;
    if(n.type==='call'){const d=definitions.get(n.name);if(!d){engine.programDiagnostic={nodeId:n.id,decide:`Procedure not defined: ${n.name}`};return 'wait';}const outer=frame;frame=runtimeKey(n.id);let result;try{result=seq(`${frame}:call`,d.body);}finally{frame=outer;}return result==='wait'?'wait':'done';}
    if(n.type==='repeatCount'||n.type==='forEach'){
      const m=memory[runtimeKey(n.id)]||={iteration:0};const items=n.type==='forEach'?value(n.list):null,amount=n.type==='repeatCount'?value(n.count):null;if((n.type==='forEach'&&!Array.isArray(items))||(n.type==='repeatCount'&&(!Number.isFinite(amount)||amount<0||amount>4096)))return 'wait';const count=n.type==='forEach'?items.length:Math.floor(amount);
      while(m.iteration<count){if(n.type==='forEach')engine.learnerVariables[n.name]=clone(items[m.iteration]);const result=seq(`${runtimeKey(n.id)}:branch`,n.body);if(result==='wait')return 'wait';if(result==='return')return result;if(result==='break')break;m.iteration++;if(--budget<0)return 'wait';}delete memory[runtimeKey(n.id)];return 'done';
    }
    if(n.type==='repeatWhile'||n.type==='repeatUntil'){
      while(true){const x=value(n.condition);if(x===null)return 'wait';if((n.type==='repeatWhile'&&!x)||(n.type==='repeatUntil'&&x))return 'done';const result=seq(`${runtimeKey(n.id)}:branch`,n.body);if(result==='wait')return 'wait';if(result==='return')return result;if(result==='break')return 'done';if(--budget<0)return 'wait';}
    }
    return 'done';
  };
  for(const b of program.filter(n=>n.type==='behavior'&&state.selectedTasks.includes(n.taskId)).sort((a,b)=>b.priority-a.priority)){current=b;engine.currentLearnerTask=b.taskId;const held=memory[b.id]?.held||{};for(const resource of Object.keys(held))if(!claims.has(resource))claims.set(resource,b.id);const result=seq(b.id,b.body);if(result==='wait'){memory[b.id].held=Object.fromEntries([...claims].filter(([,owner])=>owner===b.id).map(([resource])=>[resource,true]));}else delete memory[b.id].held;}
  const lead=events[0];
  engine.learnerEvents=events;
  if(!lead){engine.lastTrace={sense:engine.programReads.map(r=>`${r.sensor}: ${JSON.stringify(r.value)}`).join('; '),decide:engine.programDiagnostic?.decide||'No authored action',act:'—'};return null;}
  const trace={nodeId:lead.nodeId,sense:engine.programReads.map(r=>`${r.sensor}: ${JSON.stringify(r.value)}`).join('; '),decide:engine.programDiagnostic?.decide||'Learner program',act:events.map(e=>`${e.action}${e.executed?'':' (blocked)'}`).join(' + ')};
  engine.lastTrace=trace;
  return {...lead,executedInProgram:true,trace};
}
