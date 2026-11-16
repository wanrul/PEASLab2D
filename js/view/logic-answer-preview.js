// Explicit waypoints for the current apartment, visible as editable position blocks.
const ROUTE_POINTS=[[412, 52], [412, 244], [436, 244], [436, 44], [388, 44], [388, 980], [316, 980], [316, 1060], [372, 1060], [372, 1012], [348, 1012], [348, 1020], [348, 812], [356, 812], [308, 812], [308, 964], [308, 884], [300, 884], [300, 852], [252, 852], [252, 876], [532, 876], [532, 1028], [708, 1028], [708, 996], [500, 996], [500, 1028], [508, 1028], [508, 908], [500, 908], [500, 980], [540, 980], [532, 980], [532, 500], [708, 500], [708, 748], [980, 748], [980, 660], [740, 660], [740, 716], [948, 716], [948, 692], [564, 692], [564, 788], [692, 788], [692, 724], [596, 724], [596, 756], [652, 756], [652, 532], [676, 532], [676, 652], [564, 652], [564, 532], [620, 532], [620, 620], [596, 620], [596, 572], [420, 572], [420, 844], [500, 844], [500, 812], [508, 812], [508, 804], [516, 804], [516, 796], [524, 796], [524, 604], [452, 604], [452, 748], [492, 748], [492, 500], [508, 500], [420, 500], [420, 540], [460, 540], [460, 500], [452, 500], [452, 492], [420, 492], [420, 460], [436, 460], [436, 476], [444, 476], [196, 476], [196, 748], [356, 748], [356, 508], [228, 508], [228, 716], [324, 716], [324, 540], [260, 540], [260, 684], [292, 684], [292, 580], [116, 580], [116, 748], [172, 748], [172, 612], [148, 612], [148, 708], [148, 492], [164, 492], [164, 540], [116, 540], [116, 556], [116, 492], [180, 492], [180, 484], [196, 484], [196, 196], [356, 196], [356, 444], [228, 444], [228, 228], [324, 228], [324, 276], [324, 268], [260, 268], [260, 276], [244, 276], [244, 436], [340, 436], [340, 260], [396, 260], [396, 180], [220, 180], [228, 180], [228, 116], [356, 116], [356, 148], [228, 148], [228, 180], [220, 180], [220, 188], [212, 188], [212, 196], [116, 196], [116, 220], [180, 220], [180, 228], [196, 228], [196, 748], [372, 748], [372, 756], [380, 756], [380, 764], [388, 764], [388, 796], [380, 796], [380, 804], [428, 804], [428, 812], [436, 812], [436, 820], [444, 820], [444, 828], [452, 828], [452, 836], [484, 836], [484, 884], [484, 876], [452, 876], [452, 884], [420, 884], [420, 916], [436, 916], [436, 900], [444, 900], [444, 884], [452, 884], [452, 876], [532, 876], [532, 804], [540, 804], [540, 764], [516, 764], [516, 644], [724, 644], [716, 644], [716, 636], [708, 636], [708, 588], [716, 588], [716, 516], [716, 524], [980, 524], [980, 596], [940, 596], [940, 556], [748, 556], [748, 572], [908, 572], [908, 588], [772, 588], [772, 596], [828, 596], [828, 452], [980, 452], [980, 500], [860, 500], [860, 484], [940, 484], [940, 444], [980, 444], [980, 348], [948, 348], [948, 452], [772, 452], [772, 492], [796, 492], [796, 572], [716, 572], [716, 588], [708, 588], [708, 636], [716, 636], [716, 644], [724, 644], [724, 652], [732, 652], [732, 660], [916, 660], [916, 756], [972, 756], [964, 756], [964, 1028], [980, 1028], [980, 812], [772, 812], [772, 916], [932, 916], [932, 844], [804, 844], [804, 884], [940, 884], [940, 924], [948, 924], [948, 1028], [948, 788], [924, 788], [924, 756], [916, 756], [916, 748], [388, 748], [388, 796], [380, 796], [380, 804], [372, 804], [372, 812], [316, 812], [316, 1060], [308, 1060]];
/** Temporary local reference workspace. Never loaded by the normal study entry. */
export function createLogicAnswerWorkspace(){
 let id=0;const block=(type,fields={},inputs={})=>({type,id:`answer-${++id}`,fields,inputs:Object.fromEntries(Object.entries(inputs).filter(([,v])=>v).map(([k,v])=>[k,{block:v}]))});
 const num=n=>block('math_number',{NUM:n}),bool=v=>block('logic_boolean',{BOOL:v?'TRUE':'FALSE'}),variable=name=>block('GET_LEARNER_VARIABLE',{NAME:name});
 const read=(type,fields={})=>block(type,fields),state=field=>read('READ_STATE',{FIELD:field});
 const cmp=(a,op,b)=>block('VALUE_COMPARE',{OP:op},{A:a,B:b}),or=(a,b)=>block('logic_operation',{OP:'OR'},{A:a,B:b});
 const chain=xs=>{xs=xs.filter(Boolean);for(let i=0;i<xs.length-1;i++)xs[i].next={block:xs[i+1]};return xs[0];};
 const iff=(condition,body,otherwise)=>{const b=block('controls_if',{}, {IF0:condition,DO0:chain(body),ELSE:otherwise?chain(otherwise):null});if(otherwise)b.extraState={hasElse:true};return b;};
 const set=(name,value)=>block('SET_LEARNER_VARIABLE',{NAME:name},{VALUE:value}),speed=n=>block('ROBOT_SPEED',{}, {VALUE:num(n)}),stop=()=>block('ROBOT_STOP');
 const position=()=>read('READ_POSITION',{FIELD:'position'}),heading=()=>read('READ_POSITION',{FIELD:'heading'});
 const goTo=name=>[
  block('ROBOT_HEADING',{}, {ANGLE:block('POSITION_DISTANCE',{OP:'direction'},{A:position(),B:variable(name)})}),
  block('ROBOT_MOVE',{DIRECTION:'forward'},{DISTANCE:block('POSITION_DISTANCE',{OP:'distance'},{A:position(),B:variable(name)})})
 ];
 const behavior=(name,task,priority,body,x,y)=>({...block('LEARNER_BEHAVIOR',{NAME:name,TASK:task,PRIORITY:priority},{BODY:chain(body)}),x,y});
 const [firstX,firstY]=ROUTE_POINTS[0];
 const route=[set('waypoint',block('POSITION_VALUE',{}, {X:num(firstX/60),Y:num(firstY/60)})),block('LEARNER_CALL',{NAME:'Move to waypoint'})];
 let routeHeading=null;
 for(let i=1;i<ROUTE_POINTS.length;i++){
  const [x,y]=ROUTE_POINTS[i],[px,py]=ROUTE_POINTS[i-1],angle=Math.atan2(y-py,x-px)*180/Math.PI;
  const difference=routeHeading===null?null:((angle-routeHeading+540)%360)-180;
  const backward=difference===-180;
  if(difference!==0&&!backward&&Math.hypot(x-px,y-py)===8&&[0,90].includes(angle)){
    route.push(block('LEARNER_CALL',{NAME:angle===0?'Small east step':'Small south step'}));routeHeading=angle;continue;
  }
  if(difference!==0&&!backward){route.push(block('ROBOT_HEADING',{}, {ANGLE:num(angle)}));routeHeading=angle;}
  route.push(block('ROBOT_MOVE',{DIRECTION:backward?'backward':'forward'},{DISTANCE:num(Math.hypot(x-px,y-py)/60)}));
 }
 const navigation=behavior('Driving route — full patrol','TASK_1',20,[
  iff(variable('charged once'),[
   iff(cmp(read('PROGRESS_VALUE',{FIELD:'patrolCoverage'}),'<',num(100)),[block('LEARNER_CALL',{NAME:'Current apartment route'})],[stop()])
  ])
 ],24,24);
 const animal=behavior('Animal response','TASK_4',100,[
  iff(cmp(read('READ_ANIMAL',{FIELD:'distance'}),'<',num(1.5)),[stop()])
 ],24,500);
 const human=behavior('Human response','TASK_5',90,[
  iff(cmp(read('READ_PERSON',{FIELD:'distance'}),'<=',num(2)),[speed(.25)],[speed(1)])
 ],24,780);
 const battery=()=>read('READ_BATTERY');
 const charging=behavior('Charging and resume','TASK_6',80,[
  iff(or(state('docked'),cmp(battery(),'<',num(40))),[
   iff(state('docked'),[
    iff(cmp(battery(),'>=',num(100)),[block('ROBOT_DOCK',{STATE:'release'}),set('charged once',bool(true))],[stop()])
   ],[
    block('ROBOT_GOAL',{TARGET:'DOCK'}),
    iff(cmp(read('READ_DESTINATION',{FIELD:'distance'}),'<',num(.3)),[block('ROBOT_DOCK',{STATE:'engage'})],[
     block('ROBOT_HEADING',{}, {ANGLE:block('math_arithmetic',{OP:'ADD'},{A:heading(),B:read('READ_DESTINATION',{FIELD:'direction'})})}),
     block('ROBOT_MOVE',{DIRECTION:'forward'},{DISTANCE:num(.05)})
    ])
   ])
  ])
 ],24,1100);
  const go=block('LEARNER_DEFINE',{NAME:'Move to waypoint'},{BODY:chain([
  ...goTo('waypoint')
 ])});go.x=4700;go.y=24;
 const plannedRoute=block('LEARNER_DEFINE',{NAME:'Current apartment route'},{BODY:chain(route)});plannedRoute.x=2900;plannedRoute.y=24;
 const smallSteps=[['Small east step',0],['Small south step',90]].map(([name,angle],i)=>({...block('LEARNER_DEFINE',{NAME:name},{BODY:chain([block('ROBOT_HEADING',{}, {ANGLE:num(angle)}),block('ROBOT_MOVE',{DIRECTION:'forward'},{DISTANCE:num(8/60)})])}),x:4700,y:700+i*350}));
 return {blocks:{languageVersion:0,blocks:[navigation,animal,human,charging,plannedRoute,go,...smallSteps]}};
}
