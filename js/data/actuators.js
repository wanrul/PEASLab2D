/**
 * CollabPEAS - Actuators Catalog
 * 14 actuators total across 5 categories: Locomotion, Cleaning Tools, Mechanical Arm, Docking, Additional.
 * 10 are required for the tasks, 4 are distractors or redundant.
 */

export const ACTUATOR_CATEGORIES = [
  'Locomotion',
  'Cleaning Tools',
  'Mechanical Arm',
  'Docking',
  'Additional Actuators'
];

export const ACTUATORS_CATALOG = [
  // 1. Locomotion
  {
    id: 'ACTUATOR_WHEELS',
    name: 'Wheel Drive',
    category: 'Locomotion',
    does: 'Spins drive wheels to move forward or backward. Speed is dynamically adjustable.',
    cannot: 'Cannot move laterally (strafe); turning requires rotation command.',
    bodyPart: 'Dual heavy-duty differential drive wheels',
    requiredForTasks: ['TASK_1', 'TASK_2', 'TASK_3', 'TASK_4', 'TASK_5', 'TASK_6'],
    isDistractor: false,
    icon: '⚙️'
  },
  {
    id: 'ACTUATOR_ROTATION',
    name: 'Body Rotation',
    category: 'Locomotion',
    does: 'Rotates the chassis in place left or right by discrete angles (45°, 90°, 180°).',
    cannot: 'Cannot translate forward while turning.',
    bodyPart: 'Central high-torque pivot turntable',
    requiredForTasks: ['TASK_1', 'TASK_2', 'TASK_3', 'TASK_4', 'TASK_6'],
    isDistractor: false,
    icon: '🔄'
  },
  {
    id: 'ACTUATOR_ESTOP',
    name: 'Emergency Stop',
    category: 'Locomotion',
    does: 'Immediately halts all wheel motion in current tick (bypasses deceleration inertia).',
    cannot: 'Does not reverse or steer; robot freezes at current position.',
    bodyPart: 'Pneumatic emergency brake caliper',
    requiredForTasks: ['TASK_4'],
    isDistractor: false,
    icon: '🛑'
  },

  // 2. Cleaning Tools
  {
    id: 'ACTUATOR_VACUUM',
    name: 'Vacuum Suction',
    category: 'Cleaning Tools',
    does: 'Activates cyclonic suction on undercarriage. Cleans dry DIRTY cells within 1s.',
    cannot: 'CANNOT CLEAN WET CELLS. Sucking liquid short-circuits and damages the impeller!',
    bodyPart: 'Undercarriage vacuum intake nozzle & cyclonic filter',
    requiredForTasks: ['TASK_1'],
    isDistractor: false,
    icon: '🌪️'
  },
  {
    id: 'ACTUATOR_MOP',
    name: 'Mop Pad Deploy / Retract',
    category: 'Cleaning Tools',
    does: 'Lowers microfiber absorbent mop pad onto floor. Cleans WET liquid spills in 2s.',
    cannot: 'Cannot clean dry dust particles; cannot run simultaneously with vacuum suction.',
    bodyPart: 'Pneumatic mop arm with absorbent sponge pad',
    requiredForTasks: ['TASK_3'],
    isDistractor: false,
    icon: '🧽'
  },

  // 3. Mechanical Arm
  {
    id: 'ACTUATOR_ARM_EXT',
    name: 'Arm Extend',
    category: 'Mechanical Arm',
    does: 'Telescopes robotic arm forward up to 0.6m toward detected target object.',
    cannot: 'Cannot reach past 0.6m; cannot penetrate through solid furniture or walls.',
    bodyPart: 'Telescopic carbon-fiber robotic arm segment',
    requiredForTasks: ['TASK_2'],
    isDistractor: false,
    icon: '🦾'
  },
  {
    id: 'ACTUATOR_GRIP_CLOSE',
    name: 'Gripper Close (Grab)',
    category: 'Mechanical Arm',
    does: 'Closes robotic gripper fingers around adjacent target object; locks grip.',
    cannot: 'Cannot grab objects out of reach; cannot hold more than one object at once.',
    bodyPart: 'Two-finger motorized claw with rubberized pads',
    requiredForTasks: ['TASK_2'],
    isDistractor: false,
    icon: '✊'
  },
  {
    id: 'ACTUATOR_GRIP_OPEN',
    name: 'Gripper Open (Release)',
    category: 'Mechanical Arm',
    does: 'Opens gripper fingers to release held object into target bin or table.',
    cannot: 'Cannot throw or place with precision; object drops to surface under claw.',
    bodyPart: 'Spring-loaded quick-release finger actuators',
    requiredForTasks: ['TASK_2'],
    isDistractor: false,
    icon: '🖐️'
  },
  {
    id: 'ACTUATOR_ARM_RET',
    name: 'Arm Retract',
    category: 'Mechanical Arm',
    does: 'Folds mechanical arm back into compact home compartment flush with chassis.',
    cannot: 'Cannot retract while claw is gripping an object that exceeds bay volume.',
    bodyPart: 'Arm folding hinges and recessed chassis cradle',
    requiredForTasks: ['TASK_2'],
    isDistractor: false,
    icon: '📥'
  },

  // 4. Docking
  {
    id: 'ACTUATOR_DOCK_PIN',
    name: 'Dock Connector Engage',
    category: 'Docking',
    does: 'Extends charging pin into wall dock receptacle when within 0.2m to initiate fast charge.',
    cannot: 'Cannot engage from >0.2m or if robot orientation is misaligned by >15°.',
    bodyPart: 'High-current magnetic docking connector pin',
    requiredForTasks: ['TASK_6'],
    isDistractor: false,
    icon: '🔌'
  },

  // 5. Additional Actuators
  {
    id: 'ACTUATOR_LED',
    name: 'LED Body Flash',
    category: 'Additional Actuators',
    does: 'Pulses 360° LED halo strip: Red (blocked/error), Amber (caution), Blue (active/cleaning).',
    cannot: 'Cannot display text or arbitary symbols.',
    bodyPart: 'Multi-color RGB peripheral glow lightbar',
    requiredForTasks: ['TASK_2', 'TASK_3', 'TASK_4', 'TASK_5'],
    isDistractor: false,
    icon: '🚨'
  },
  {
    id: 'ACTUATOR_BIN_OPEN',
    name: 'Bin Lid Open',
    category: 'Additional Actuators',
    does: 'Transmits 2.4GHz RF pulse to trigger smart trash bin lid servo before item deposit.',
    cannot: 'Cannot open non-smart furniture doors or sinks.',
    bodyPart: 'RF wireless transceiver antenna',
    requiredForTasks: ['TASK_2'],
    isDistractor: false,
    icon: '🗑️'
  },
  {
    id: 'ACTUATOR_SPEAKER',
    name: 'Speaker / Voice Output',
    category: 'Additional Actuators',
    does: 'Emits auditory alert signals: short confirmation beep, or warning chime.',
    cannot: 'Cannot generate synthetic conversational human speech.',
    bodyPart: 'Acoustic micro-speaker transducer',
    requiredForTasks: ['TASK_6'],
    isDistractor: false,
    icon: '🔊'
  },
  {
    id: 'ACTUATOR_SPEED_CTRL',
    name: 'Arm Speed Control',
    category: 'Additional Actuators',
    does: 'Redundant hardware speed dial for robotic arm extension.',
    cannot: 'Duplicates software block logic (arm speed is already set via SET SPEED blocks).',
    bodyPart: 'Secondary potentiometer knob',
    requiredForTasks: [],
    isDistractor: true,
    icon: '🎛️'
  }
];

export function getActuatorById(id) {
  return ACTUATORS_CATALOG.find(a => a.id === id);
}
