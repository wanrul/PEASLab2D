/** Researcher settings: operational pilot defaults, not validated thresholds.
 * Duration is observed; null speedLimitSeconds never imposes a deadline.
 */
export const PILOT_STAGES = Object.freeze([
  { id: 1, name: 'Vacuum the floor', sensorBudget: 7, taskIds: ['TASK_1','TASK_4','TASK_5','TASK_6'] },
  { id: 2, name: 'Add spill cleaning', sensorBudget: 8, taskIds: ['TASK_1','TASK_3','TASK_4','TASK_5','TASK_6'] },
  { id: 3, name: 'Add pickup and sorting', sensorBudget: 11, taskIds: ['TASK_1','TASK_3','TASK_2','TASK_4','TASK_5','TASK_6'] }
].map(stage => Object.freeze({...stage,missionTaskIds:stage.taskIds.filter(id=>['TASK_1','TASK_2','TASK_3'].includes(id))})));
export const STAGE_CRITERIA = Object.freeze(Object.fromEntries(PILOT_STAGES.map(({id}) => [id, Object.freeze({
  dirtFraction: 1, ...(id>=3?{sortedFraction:1}:{}), ...(id>=2?{spillFraction:1,maxVacuumLiquidMistakes:0}:{}),
  minCatEncounters:1,maxCatViolations:0,minHumanEncounters:1,maxHumanViolations:0,minHumanResumes:1,
  lowBatteryPercent:30, speedLimitSeconds: null
})])));
export const TASK_PURPOSES = Object.freeze({
  TASK_1: { purpose: 'Vacuum dirt from the apartment floor.', priorities: [['thorough','Thorough cleaning'],['speed','Speed — faster completion']] },
  TASK_2: { purpose: 'Pick up scattered objects and choose their correct destinations.', priorities: [['correct','Correct sorting'],['speed','Speed — faster completion']] },
  TASK_3: { purpose: 'Clean spills with the mop and keep vacuum suction off liquid.', priorities: [['safe','Safe spill cleaning'],['speed','Speed — faster completion']] },
  TASK_4: { purpose: 'Stop when the moving cat enters sensing range.', priorities: [['safe','Safe response'],['speed','Speed — faster completion']] },
  TASK_5: { purpose: 'Slow near the participant and resume normal speed after leaving.', priorities: [['safe','Safe response'],['speed','Speed — faster completion']] },
  TASK_6: { purpose: 'Select the dock when battery is low and physically engage its connector.', priorities: [['reliable','Reliable docking'],['speed','Speed — faster completion']] }
});
export function criterionDescriptions(stageId, criteria = STAGE_CRITERIA) {
  const config=criteria[stageId];
  return [
    {id:'cleaning',taskId:'TASK_1',label:`Clean at least ${config.dirtFraction*100}% of initial dirt cells`},
    ...(Number.isFinite(config.sortedFraction)?[{id:'sorting',taskId:'TASK_2',label:`Correctly sort at least ${config.sortedFraction*100}% of initial objects`}]:[]),
    ...(Number.isFinite(config.spillFraction)?[{id:'spills',taskId:'TASK_3',label:`Mop at least ${config.spillFraction*100}% of spills; at most ${config.maxVacuumLiquidMistakes} vacuum-on-liquid events`}]:[]),
    ...(Number.isFinite(config.minCatEncounters)?[{id:'cat',taskId:'TASK_4',label:`Stop in every moving cat encounter (at least ${config.minCatEncounters}); at most ${config.maxCatViolations} unsafe crossings`}]:[]),
    ...(Number.isFinite(config.minHumanEncounters)?[{id:'human',taskId:'TASK_5',label:`Slow in every moving person encounter (at least ${config.minHumanEncounters}), resume at least ${config.minHumanResumes} time; at most ${config.maxHumanViolations} fast passes`}]:[]),
    ...(Number.isFinite(config.lowBatteryPercent)?[{id:'docking',taskId:'TASK_6',label:`Below ${config.lowBatteryPercent}% battery, choose DOCK, travel and connect before depletion`}]:[]),
    ...(Number.isFinite(config.speedLimitSeconds)?[{id:'speed',taskId:null,label:`Complete the current tasks within ${config.speedLimitSeconds} seconds`}]:[])
  ];
}

/** Pilot defaults, not validated thresholds. LOW is encountered after about 56s from 35%. */
export const SIMULATION_SETTINGS = Object.freeze({ initialBatteryPercent: 35, batteryDrainPerTick: 0.009, chargePerTick: 0.25, catDwellTicks: 25 });
