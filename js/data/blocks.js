/**
 * CollabPEAS - Complete 64-Block Library
 * SENSE (15, Blue) -> CONDITION (20, Yellow) -> ACTION (23, Green) -> CONTROL (6, Grey)
 * Enforces SENSE -> CONDITION compatibility and ACTION -> Actuator requirements.
 */

export const BLOCK_KINDS = {
  Sense: { id: 'Sense', name: 'SENSE', color: '#0284c7', bg: '#0369a1', badge: 'Sense' },
  Condition: { id: 'Condition', name: 'CONDITION', color: '#d97706', bg: '#b45309', badge: 'Condition' },
  Action: { id: 'Action', name: 'ACTION', color: '#059669', bg: '#047857', badge: 'Action' },
  Control: { id: 'Control', name: 'CONTROL', color: '#475569', bg: '#334155', badge: 'Control' }
};

export const SENSE_BLOCKS = [
  { id: 'SENSE_01', kind: 'Sense', name: 'Animal Detection Sensor', returns: 'DETECTED / CLEAR', desc: 'Detects the tagged cat within 1.5m.' },
  { id: 'SENSE_02', kind: 'Sense', name: 'Battery Sensor', returns: 'HIGH / MED / LOW', desc: 'Battery level: HIGH (>60%), MED (30-60%), LOW (<30%).' },
  { id: 'SENSE_03', kind: 'Sense', name: 'Destination Sensor', returns: 'DIRECTION + DISTANCE', desc: 'Direction + distance to target goal (SINK/BIN/DOCK).' },
  { id: 'SENSE_04', kind: 'Sense', name: 'Distance Sensor', returns: 'NEAR / FAR / BLOCKED', desc: 'Nearest obstacle in 4 directions up to 5m.' },
  { id: 'SENSE_05', kind: 'Sense', name: 'Floor Dirt Sensor', returns: 'DIRTY / CLEAN', desc: 'Underfoot cell state: DIRTY / CLEAN.' },
  { id: 'SENSE_06', kind: 'Sense', name: 'Floor Wet Sensor', returns: 'WET / DRY', desc: 'Underfoot cell moisture: WET / DRY.' },
  { id: 'SENSE_07', kind: 'Sense', name: 'Floor Map Sensor', returns: 'FULL GRID MAP', desc: 'Global grid status: CLEAN/DIRTY/WET/VISITED/UNKNOWN.' },
  { id: 'SENSE_08', kind: 'Sense', name: 'Grip Sensor', returns: 'GRIPPING / EMPTY', desc: 'Arm holding an object: GRIPPING / EMPTY.' },
  { id: 'SENSE_09', kind: 'Sense', name: 'Human Proximity Sensor', returns: 'NEAR / CLEAR', desc: 'Operator avatar within 2m: NEAR / CLEAR.' },
  { id: 'SENSE_10', kind: 'Sense', name: 'Light Level Sensor', returns: 'DARK / DIM / BRIGHT', desc: 'Ambient room lighting in lux.' },
  { id: 'SENSE_11', kind: 'Sense', name: 'Object Weight Sensor', returns: 'WEIGHT (grams)', desc: 'Weight of contacting object in grams.' },
  { id: 'SENSE_12', kind: 'Sense', name: 'Session Timer Sensor', returns: 'ELAPSED TIME', desc: 'Elapsed duration of current state in seconds.' },
  { id: 'SENSE_13', kind: 'Sense', name: 'Sound Level Sensor', returns: 'QUIET / LOUD', desc: 'Acoustic decibel level in room.' },
  { id: 'SENSE_14', kind: 'Sense', name: 'Stair Edge Detector', returns: 'EDGE DETECTED / CLEAR', desc: 'Drop-off / cliff detection ahead.' },
  { id: 'SENSE_15', kind: 'Sense', name: 'Vision Sensor', returns: 'OBJECT TYPE + POS', desc: 'Classifies objects in 120° cone: CUP/FOOD/TRASH/BIN/SINK.' }
];

export const CONDITION_BLOCKS = [
  { id: 'COND_01', kind: 'Condition', name: 'IF obstacle is NEAR', requiresSense: ['SENSE_04'], desc: 'Distance sensor returns NEAR in front/back/sides.' },
  { id: 'COND_02', kind: 'Condition', name: 'IF obstacle is BLOCKED', requiresSense: ['SENSE_04'], desc: 'Distance sensor returns BLOCKED (<0.3m ahead).' },
  { id: 'COND_03', kind: 'Condition', name: 'IF floor is DIRTY', requiresSense: ['SENSE_05'], desc: 'Dirt sensor reads DIRTY on current cell.' },
  { id: 'COND_04', kind: 'Condition', name: 'IF floor is WET', requiresSense: ['SENSE_06'], desc: 'Wet sensor reads WET moisture on current cell.' },
  { id: 'COND_05', kind: 'Condition', name: 'IF floor cell is UNVISITED', requiresSense: ['SENSE_07'], desc: 'Map sensor shows cell as UNVISITED.' },
  { id: 'COND_06', kind: 'Condition', name: 'IF floor cell is CLEAN', requiresSense: ['SENSE_07', 'SENSE_05'], desc: 'Floor cell is already CLEAN.' },
  { id: 'COND_07', kind: 'Condition', name: 'IF animal is DETECTED', requiresSense: ['SENSE_01'], desc: 'Animal sensor returns DETECTED (cat within 1.5m).' },
  { id: 'COND_08', kind: 'Condition', name: 'IF battery is LOW', requiresSense: ['SENSE_02'], desc: 'Battery sensor reads LOW (<30%).' },
  { id: 'COND_09', kind: 'Condition', name: 'IF battery is HIGH', requiresSense: ['SENSE_02'], desc: 'Battery sensor reads HIGH (>60%).' },
  { id: 'COND_10', kind: 'Condition', name: 'IF destination is REACHED', requiresSense: ['SENSE_03'], desc: 'Destination sensor distance <= 0.2m.' },
  { id: 'COND_11', kind: 'Condition', name: 'IF destination is FAR', requiresSense: ['SENSE_03'], desc: 'Destination distance > 2m.' },
  { id: 'COND_12', kind: 'Condition', name: 'IF person is NEAR', requiresSense: ['SENSE_09'], desc: 'Human proximity reads NEAR (<2m).' },
  { id: 'COND_13', kind: 'Condition', name: 'IF person is CLEAR', requiresSense: ['SENSE_09'], desc: 'Human proximity reads CLEAR (>2m).' },
  { id: 'COND_14', kind: 'Condition', name: 'IF arm is GRIPPING', requiresSense: ['SENSE_08'], desc: 'Grip sensor confirms object is secured.' },
  { id: 'COND_15', kind: 'Condition', name: 'IF arm is EMPTY', requiresSense: ['SENSE_08'], desc: 'Gripper claw is empty / released.' },
  { id: 'COND_16', kind: 'Condition', name: 'IF object is TRASH', requiresSense: ['SENSE_15'], desc: 'Vision classifies targeted item as TRASH.' },
  { id: 'COND_17', kind: 'Condition', name: 'IF object is BELONGING', requiresSense: ['SENSE_15'], desc: 'Vision classifies targeted item as CUP or FOOD.' },
  { id: 'COND_18', kind: 'Condition', name: 'IF timer EXCEEDS limit', requiresSense: ['SENSE_12'], desc: 'Task state duration > timeout threshold.' },
  { id: 'COND_19', kind: 'Condition', name: 'IF edge is DETECTED', requiresSense: ['SENSE_14'], desc: 'Stair edge sensor flags cliff edge.' },
  { id: 'COND_20', kind: 'Condition', name: 'IF weight is DETECTED', requiresSense: ['SENSE_11'], desc: 'Object weight sensor reads > 0g.' }
];

export const ACTION_BLOCKS = [
  { id: 'ACT_01', kind: 'Action', name: 'MOVE FORWARD', requiresActuator: 'ACTUATOR_WHEELS', desc: 'Drive forward at current speed setting.' },
  { id: 'ACT_02', kind: 'Action', name: 'MOVE BACKWARD', requiresActuator: 'ACTUATOR_WHEELS', desc: 'Reverse drive straight back.' },
  { id: 'ACT_03', kind: 'Action', name: 'ROTATE LEFT 90°', requiresActuator: 'ACTUATOR_ROTATION', desc: 'Pivot 90° counterclockwise in place.' },
  { id: 'ACT_04', kind: 'Action', name: 'ROTATE RIGHT 90°', requiresActuator: 'ACTUATOR_ROTATION', desc: 'Pivot 90° clockwise in place.' },
  { id: 'ACT_05', kind: 'Action', name: 'ROTATE 180°', requiresActuator: 'ACTUATOR_ROTATION', desc: 'Make a full U-turn in place.' },
  { id: 'ACT_06', kind: 'Action', name: 'EMERGENCY STOP', requiresActuator: 'ACTUATOR_ESTOP', desc: 'Halt all wheels immediately this tick.' },
  { id: 'ACT_07', kind: 'Action', name: 'SET SPEED: SLOW', requiresActuator: 'ACTUATOR_WHEELS', desc: 'Reduce drive speed to 0.4 m/s.' },
  { id: 'ACT_08', kind: 'Action', name: 'SET SPEED: NORMAL', requiresActuator: 'ACTUATOR_WHEELS', desc: 'Restore drive speed to 1.0 m/s.' },
  { id: 'ACT_09', kind: 'Action', name: 'VACUUM ON', requiresActuator: 'ACTUATOR_VACUUM', desc: 'Start suction impeller (cleans dirty cells).' },
  { id: 'ACT_10', kind: 'Action', name: 'VACUUM OFF', requiresActuator: 'ACTUATOR_VACUUM', desc: 'Turn off suction to conserve battery.' },
  { id: 'ACT_11', kind: 'Action', name: 'MOP DEPLOY', requiresActuator: 'ACTUATOR_MOP', desc: 'Lower wet mop pad to clean spills.' },
  { id: 'ACT_12', kind: 'Action', name: 'MOP RETRACT', requiresActuator: 'ACTUATOR_MOP', desc: 'Lift mop pad back into undercarriage bay.' },
  { id: 'ACT_13', kind: 'Action', name: 'ARM EXTEND', requiresActuator: 'ACTUATOR_ARM_EXT', desc: 'Telescope arm forward toward target item.' },
  { id: 'ACT_14', kind: 'Action', name: 'GRIPPER CLOSE', requiresActuator: 'ACTUATOR_GRIP_CLOSE', desc: 'Close motorized claw fingers around object.' },
  { id: 'ACT_15', kind: 'Action', name: 'GRIPPER OPEN', requiresActuator: 'ACTUATOR_GRIP_OPEN', desc: 'Open claw fingers to drop/deposit object.' },
  { id: 'ACT_16', kind: 'Action', name: 'ARM RETRACT', requiresActuator: 'ACTUATOR_ARM_RET', desc: 'Fold robotic arm flush against body.' },
  { id: 'ACT_17', kind: 'Action', name: 'DOCK CONNECTOR ENGAGE', requiresActuator: 'ACTUATOR_DOCK_PIN', desc: 'Lock charging pin into wall dock.' },
  { id: 'ACT_18', kind: 'Action', name: 'LED FLASH: RED', requiresActuator: 'ACTUATOR_LED', desc: 'Pulse chassis light ring Red (warning/blocked).' },
  { id: 'ACT_19', kind: 'Action', name: 'LED FLASH: AMBER', requiresActuator: 'ACTUATOR_LED', desc: 'Pulse chassis light ring Amber (caution).' },
  { id: 'ACT_20', kind: 'Action', name: 'LED FLASH: BLUE', requiresActuator: 'ACTUATOR_LED', desc: 'Pulse chassis light ring Blue (active clean).' },
  { id: 'ACT_21', kind: 'Action', name: 'BIN LID OPEN', requiresActuator: 'ACTUATOR_BIN_OPEN', desc: 'Transmit wireless open command to smart bin.' },
  { id: 'ACT_22', kind: 'Action', name: 'PLAY SOUND: BEEP', requiresActuator: 'ACTUATOR_SPEAKER', desc: 'Emit short acoustic confirmation beep.' },
  { id: 'ACT_23', kind: 'Action', name: 'PLAY SOUND: CHIME', requiresActuator: 'ACTUATOR_SPEAKER', desc: 'Emit harmonic alert chime.' }
];

export const CONTROL_BLOCKS = [
  { id: 'CTRL_01', kind: 'Control', name: 'REPEAT UNTIL done', desc: 'Loops the action until condition clears.' },
  { id: 'CTRL_02', kind: 'Control', name: 'REPEAT WHILE true', desc: 'Repeats action continuously while condition holds.' },
  { id: 'CTRL_03', kind: 'Control', name: 'WAIT 2 seconds', desc: 'Pauses 2s (20 ticks) before firing action.' },
  { id: 'CTRL_04', kind: 'Control', name: 'THEN (sequence)', desc: 'Chains primary action with secondary action in sequence.' },
  { id: 'CTRL_05', kind: 'Control', name: 'PRIORITY: HIGH', desc: 'Wins arbitration against conflicting rules this tick.' },
  { id: 'CTRL_06', kind: 'Control', name: 'PRIORITY: NORMAL', desc: 'Standard execution priority.' }
];

export const ALL_BLOCKS = [
  ...SENSE_BLOCKS,
  ...CONDITION_BLOCKS,
  ...ACTION_BLOCKS,
  ...CONTROL_BLOCKS
];

export function getBlockById(id) {
  return ALL_BLOCKS.find(b => b.id === id);
}

/**
 * Checks if a CONDITION block is compatible with a SENSE block in Slot 1.
 */
export function isConditionCompatible(conditionId, senseId) {
  if (!conditionId) return true;
  if (!senseId) return false;
  const cond = getBlockById(conditionId);
  if (!cond || cond.kind !== 'Condition') return false;
  return cond.requiresSense.includes(senseId);
}

/**
 * Starter rule scaffolds for the 6 Tasks (Design Flow p.37)
 */
export const DEFAULT_RULE_TEMPLATES = [
  {
    taskIndex: 0,
    taskId: 'TASK_1',
    taskName: 'Vacuum the floor',
    slots: {
      sense: 'SENSE_05',
      condition: 'COND_03',
      action: 'ACT_09',
      control: 'CTRL_01'
    }
  },
  {
    taskIndex: 1,
    taskId: 'TASK_2',
    taskName: 'Pick up and sort scattered objects',
    slots: {
      sense: 'SENSE_15',
      condition: 'COND_16',
      action: 'ACT_13',
      control: 'CTRL_04'
    }
  },
  {
    taskIndex: 2,
    taskId: 'TASK_3',
    taskName: 'Detect and clean spills',
    slots: {
      sense: 'SENSE_06',
      condition: 'COND_04',
      action: 'ACT_11',
      control: 'CTRL_01'
    }
  },
  {
    taskIndex: 3,
    taskId: 'TASK_4',
    taskName: 'Detect and avoid the moving cat',
    slots: {
      sense: 'SENSE_01',
      condition: 'COND_07',
      action: 'ACT_06',
      control: 'CTRL_05'
    }
  },
  {
    taskIndex: 4,
    taskId: 'TASK_5',
    taskName: 'Slow down near participants',
    slots: {
      sense: 'SENSE_09',
      condition: 'COND_12',
      action: 'ACT_07',
      control: 'CTRL_06'
    }
  },
  {
    taskIndex: 5,
    taskId: 'TASK_6',
    taskName: 'Return to charging dock when battery is low',
    slots: {
      sense: 'SENSE_02',
      condition: 'COND_08',
      action: 'ACT_17',
      control: 'CTRL_05'
    }
  }
];
