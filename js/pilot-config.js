/** Cumulative learner-authored tasks. Time labels are estimates, not deadlines. */
export const PILOT_STAGES = Object.freeze([
  {id:1,name:'Navigation & common behaviors',sensorBudget:7,taskIds:['TASK_1','TASK_4','TASK_5','TASK_6']},
  {id:2,name:'Vacuum and mop',sensorBudget:8,taskIds:['TASK_1','TASK_2','TASK_4','TASK_5','TASK_6']},
  {id:3,name:'Pick up and sort',sensorBudget:11,taskIds:['TASK_1','TASK_2','TASK_3','TASK_4','TASK_5','TASK_6']}
].map(s=>Object.freeze({...s,missionTaskIds:s.taskIds.filter(id=>['TASK_1','TASK_2','TASK_3'].includes(id))})));
export const STAGE_CRITERIA=Object.freeze(Object.fromEntries(PILOT_STAGES.map(({id})=>[id,Object.freeze({
  navigationFraction:id===1?1:0, ...(id>=2?{floorFraction:1,spillFraction:1,maxVacuumLiquidMistakes:0}:{}), ...(id>=3?{sortedFraction:1}:{}),
  minCatEncounters:1,maxCatViolations:0,minHumanEncounters:1,maxHumanViolations:0,minHumanResumes:1,lowBatteryPercent:30,speedLimitSeconds:null
})])));
export const TASK_PURPOSES=Object.freeze({
  TASK_1:{purpose:'Visit the reachable apartment, decide how to move around obstacles, respond safely to animals and people, and return to charge.',priorities:[['thorough','Thorough cleaning'],['speed','Speed']]},
  TASK_2:{purpose:'Vacuum the floor and mop spills. Keep suction off water. Choose the floor cleaning coverage goal.',priorities:[['thorough','Thorough cleaning'],['speed','Speed']]},
  TASK_3:{purpose:'Pick up scattered objects and place each at its correct destination.',priorities:[['correct','Correct sorting']]},
  TASK_4:{purpose:'Define your animal response and when movement can continue.',priorities:[['safe','Safe response']]},
  TASK_5:{purpose:'Define when to slow down near a person and restore speed.',priorities:[['safe','Safe response']]},
  TASK_6:{purpose:'Define low battery, return to the dock, connect, and resume after charging.',priorities:[['reliable','Reliable docking']]}
});
export function criterionDescriptions(stageId,criteria=STAGE_CRITERIA){const c=criteria[stageId];
  // Preserve explicit researcher fixture overrides; the learner-facing defaults use area coverage.
  if(Number.isFinite(c.dirtFraction)&&!Number.isFinite(c.floorFraction)&&!Number.isFinite(c.navigationFraction))return [
    {id:'cleaning',taskId:'TASK_1',label:`Clean at least ${c.dirtFraction*100}% of initial dirt cells`},
    ...(Number.isFinite(c.spillFraction)?[{id:'spills',taskId:'TASK_3',label:`Mop at least ${c.spillFraction*100}% of spills; at most ${c.maxVacuumLiquidMistakes??0} vacuum-on-liquid events`}]:[]),
    ...(Number.isFinite(c.sortedFraction)?[{id:'sorting',taskId:'TASK_2',label:`Correctly sort at least ${c.sortedFraction*100}% of initial objects`}]:[]),
    ...(Number.isFinite(c.speedLimitSeconds)?[{id:'speed',taskId:null,label:`Complete the current tasks within ${c.speedLimitSeconds} seconds`}]:[])
  ];
  return [
  {id:'navigation',taskId:'TASK_1',label:stageId===1?'Visit all reachable floor area':'Continue learner-authored navigation'},
  ...(Number.isFinite(c.floorFraction)?[{id:'cleaning',taskId:'TASK_2',label:`Clean at least ${c.floorFraction*100}% of cleanable floor area`}]:[]),
  ...(Number.isFinite(c.spillFraction)?[{id:'spills',taskId:'TASK_2',label:'Mop every spill once; keep suction off liquid'}]:[]),
  ...(Number.isFinite(c.sortedFraction)?[{id:'sorting',taskId:'TASK_3',label:'Place all required objects at their correct destinations'}]:[]),
  ...(Number.isFinite(c.minCatEncounters)?[{id:'cat',taskId:'TASK_4',label:'Respond safely in every moving cat encounter'}]:[]),
  ...(Number.isFinite(c.minHumanEncounters)?[{id:'human',taskId:'TASK_5',label:'Slow near people and restore speed after passing'}]:[]),
  ...(Number.isFinite(c.lowBatteryPercent)?[{id:'docking',taskId:'TASK_6',label:'Return on low battery, connect, recharge and resume'}]:[]),
  ...(Number.isFinite(c.speedLimitSeconds)?[{id:'speed',taskId:null,label:`Complete the current tasks within ${c.speedLimitSeconds} seconds`}]:[])
];}
export const SIMULATION_SETTINGS=Object.freeze({initialBatteryPercent:35,batteryDrainPerTick:.009,chargePerTick:.25,catDwellTicks:25});
