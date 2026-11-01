/** Researcher settings: operational pilot defaults, not validated thresholds.
 * Duration is observed; null speedLimitSeconds never imposes a deadline.
 */
export const PILOT_STAGES = Object.freeze([
  { id: 1, name: 'Vacuum the floor', sensorBudget: 3 },
  { id: 2, name: 'Add pickup and sorting', sensorBudget: 6 },
  { id: 3, name: 'Add spill cleaning', sensorBudget: 7 },
  { id: 4, name: 'Add stopping for the cat', sensorBudget: 8 },
  { id: 5, name: 'Add slowing for people', sensorBudget: 9 },
  { id: 6, name: 'Add low-battery docking', sensorBudget: 10 }
].map(stage => Object.freeze({ ...stage, taskIds: Array.from({ length: stage.id }, (_, i) => `TASK_${i+1}`) })));
export const STAGE_CRITERIA = Object.freeze(Object.fromEntries(PILOT_STAGES.map(({id}) => [id, Object.freeze({
  dirtFraction: 1, ...(id>=2?{sortedFraction:1}:{}), ...(id>=3?{spillFraction:1,maxVacuumLiquidMistakes:0}:{}),
  ...(id>=4?{minCatEncounters:1,maxCatViolations:0}:{}), ...(id>=5?{minHumanEncounters:1,maxHumanViolations:0,minHumanResumes:1}:{}),
  ...(id>=6?{lowBatteryPercent:30}:{}), speedLimitSeconds: null
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
    ...(stageId>=2?[{id:'sorting',taskId:'TASK_2',label:`Correctly sort at least ${config.sortedFraction*100}% of initial objects`}]:[]),
    ...(stageId>=3?[{id:'spills',taskId:'TASK_3',label:`Mop at least ${config.spillFraction*100}% of spills; at most ${config.maxVacuumLiquidMistakes} vacuum-on-liquid events`}]:[]),
    ...(stageId>=4?[{id:'cat',taskId:'TASK_4',label:`Stop in every moving cat encounter (at least ${config.minCatEncounters}); at most ${config.maxCatViolations} unsafe crossings`}]:[]),
    ...(stageId>=5?[{id:'human',taskId:'TASK_5',label:`Slow in every moving person encounter (at least ${config.minHumanEncounters}), resume at least ${config.minHumanResumes} time; at most ${config.maxHumanViolations} fast passes`}]:[]),
    ...(stageId>=6?[{id:'docking',taskId:'TASK_6',label:`Below ${config.lowBatteryPercent}% battery, choose DOCK, travel and connect before depletion`}]:[]),
    ...(Number.isFinite(config.speedLimitSeconds)?[{id:'speed',taskId:null,label:`Complete the current tasks within ${config.speedLimitSeconds} seconds`}]:[])
  ];
}

/** Common endurance for every stage. Geometry exploration replaces the old omniscient
 * route: the old 0.05%/tick depleted in 200s after only 10/17 dirt cells.
 * At 10Hz this default permits 1,111s from full to empty, LOW at about 778s.
 */
export const SIMULATION_SETTINGS = Object.freeze({ batteryDrainPerTick: 0.009, chargePerTick: 0.25, catDwellTicks: 25 });
