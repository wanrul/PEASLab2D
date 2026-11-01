/** Researcher settings. These are uncalibrated pilot operational defaults,
 * not validated thresholds. Calibrate before collecting study data.
 * A null speedLimitSeconds means duration is an observation, never a pass gate.
 */
export const PILOT_STAGES = Object.freeze([
  { id: 1, name: 'Vacuum the floor', taskIds: ['TASK_1'] },
  { id: 2, name: 'Add pickup and sorting', taskIds: ['TASK_1', 'TASK_2'] }
]);
export const STAGE_CRITERIA = Object.freeze({
  1: Object.freeze({ dirtFraction: 1, speedLimitSeconds: null }),
  2: Object.freeze({ dirtFraction: 1, sortedFraction: 1, speedLimitSeconds: null })
});
export const TASK_PURPOSES = Object.freeze({
  TASK_1: { purpose: 'Vacuum dirt from the apartment floor.', priorities: [['thorough', 'Thorough cleaning'], ['speed', 'Speed — faster completion']] },
  TASK_2: { purpose: 'Pick up scattered objects and place them at their correct destinations.', priorities: [['correct', 'Correct sorting'], ['speed', 'Speed — faster completion']] }
});
export function criterionDescriptions(stageId, criteria = STAGE_CRITERIA) {
  const config = criteria[stageId];
  return [
    { id: 'cleaning', taskId: 'TASK_1', label: `Clean at least ${config.dirtFraction * 100}% of initial dirt cells` },
    ...(stageId === 2 ? [{ id: 'sorting', taskId: 'TASK_2', label: `Correctly sort at least ${config.sortedFraction * 100}% of initial objects` }] : []),
    ...(Number.isFinite(config.speedLimitSeconds) ? [{ id: 'speed', taskId: null, label: `Complete the current tasks within ${config.speedLimitSeconds} seconds` }] : [])
  ];
}
