/**
 * CollabPEAS - Sensors Catalog
 * 15 sensors total: 11 required/relevant for the 6 tasks, 4 distractors.
 * Robot has a physical capacity of 11 mounting slots (min 8 required).
 */

export const MAX_SENSOR_SLOTS = 11;
export const MIN_SENSOR_SLOTS = 8;

export const SENSORS_CATALOG = [
  {
    id: 'SENSE_01',
    name: 'Animal Detection Sensor',
    shortName: 'Animal Detector',
    type: 'Proximity / Radar',
    measures: 'Presence and position of tagged cat within 1.5m radius. Returns DETECTED / CLEAR.',
    misses: 'Humans, furniture, walls (only detects cat tag). Does not give direction of travel.',
    returns: 'DETECTED / CLEAR',
    bodyModule: 'Cat antenna beacon (Head)',
    mountLocation: 'Head Top',
    isDistractor: false,
    tasks: ['TASK_4'],
    icon: '🐾'
  },
  {
    id: 'SENSE_02',
    name: 'Battery Sensor',
    shortName: 'Battery Sensor',
    type: 'Internal Power',
    measures: 'Current battery level as percentage: HIGH (>60%), MED (30-60%), LOW (<30%).',
    misses: 'Time remaining at current drain rate; distance to charging dock.',
    returns: 'HIGH / MED / LOW',
    bodyModule: 'Pulsing LED battery bar (Chest)',
    mountLocation: 'Chest Front',
    isDistractor: false,
    tasks: ['TASK_6'],
    icon: '🔋'
  },
  {
    id: 'SENSE_03',
    name: 'Destination Sensor',
    shortName: 'Destination Sensor',
    type: 'Navigation',
    measures: 'Direction and distance to a tagged target goal (SINK, BIN, or DOCK).',
    misses: 'Whether destination is reachable; intervening obstacles or walls.',
    returns: 'DIRECTION + DISTANCE',
    bodyModule: 'Directional head arrow pointer',
    mountLocation: 'Head Front',
    isDistractor: false,
    tasks: ['TASK_2', 'TASK_6'],
    icon: '🧭'
  },
  {
    id: 'SENSE_04',
    name: 'Distance Sensor',
    shortName: 'Distance Sensor',
    type: 'Obstacle Detection',
    measures: 'Distance to nearest obstacle in 4 directions (front, back, left, right) up to 5m.',
    misses: 'Obstacle identity (cannot distinguish cat, wall, sofa, or human operator).',
    returns: 'NEAR / FAR / BLOCKED',
    bodyModule: '360° sonar acoustic rings around chassis base',
    mountLocation: 'Chassis Ring',
    isDistractor: false,
    tasks: ['TASK_1', 'TASK_2', 'TASK_3', 'TASK_4', 'TASK_5', 'TASK_6'],
    icon: '📡'
  },
  {
    id: 'SENSE_05',
    name: 'Floor Dirt Sensor',
    shortName: 'Floor Dirt Sensor',
    type: 'Surface Inspection',
    measures: 'Optical dirt reflection on current cell directly underfoot. Returns DIRTY / CLEAN.',
    misses: 'Cells not directly under the robot; cannot see wet liquids or large objects.',
    returns: 'DIRTY / CLEAN',
    bodyModule: 'Undercarriage red LED scanning ring',
    mountLocation: 'Undercarriage Front',
    isDistractor: false,
    tasks: ['TASK_1'],
    icon: '✨'
  },
  {
    id: 'SENSE_06',
    name: 'Floor Wet Sensor',
    shortName: 'Floor Wet Sensor',
    type: 'Surface Inspection',
    measures: 'Moisture conductivity on current cell underfoot. Returns WET / DRY.',
    misses: 'Dry dirt particles; distant spills beyond the current cell.',
    returns: 'WET / DRY',
    bodyModule: 'Undercarriage blue LED moisture probe',
    mountLocation: 'Undercarriage Rear',
    isDistractor: false,
    tasks: ['TASK_3'],
    icon: '💧'
  },
  {
    id: 'SENSE_07',
    name: 'Floor Map Sensor',
    shortName: 'Floor Map Sensor',
    type: 'Spatial SLAM',
    measures: 'Full spatial state of every apartment cell: CLEAN / DIRTY / WET / VISITED / UNKNOWN.',
    misses: 'Dynamic moving objects; future state changes.',
    returns: 'FULL GRID MAP',
    bodyModule: 'Central SLAM processor module (Chassis Top)',
    mountLocation: 'Chassis Top',
    isDistractor: false,
    tasks: ['TASK_1', 'TASK_3'],
    icon: '🗺️'
  },
  {
    id: 'SENSE_08',
    name: 'Grip Sensor',
    shortName: 'Grip Sensor',
    type: 'Manipulator Feedback',
    measures: 'Mechanical contact sensor on gripper fingers. Returns GRIPPING / EMPTY.',
    misses: 'Object weight, fragility, slip risk, or whether item is trash vs belonging.',
    returns: 'GRIPPING / EMPTY',
    bodyModule: 'Green indicator LED on arm joint',
    mountLocation: 'Arm Joint',
    isDistractor: false,
    tasks: ['TASK_2'],
    icon: '🤏'
  },
  {
    id: 'SENSE_09',
    name: 'Human Proximity Sensor',
    shortName: 'Human Proximity',
    type: 'Human Presence',
    measures: 'Infrared beacon detecting participant avatar within 2m radius. Returns NEAR / CLEAR.',
    misses: 'Cat, furniture, walls (only responds to human participant tag).',
    returns: 'NEAR / CLEAR',
    bodyModule: 'Cyan proximity halo ring on torso',
    mountLocation: 'Torso Ring',
    isDistractor: false,
    tasks: ['TASK_5'],
    icon: '👤'
  },
  {
    id: 'SENSE_10',
    name: 'Light Level Sensor',
    shortName: 'Light Level Sensor',
    type: 'Environmental Ambient',
    measures: 'Ambient room illumination in lux: DARK / DIM / BRIGHT.',
    misses: 'Obstacles, dirt, spills, cats, battery level. (Irrelevant to cleaning goals)',
    returns: 'DARK / DIM / BRIGHT',
    bodyModule: 'Photodiode bulb on top turret',
    mountLocation: 'Turret',
    isDistractor: true,
    tasks: [],
    icon: '💡'
  },
  {
    id: 'SENSE_11',
    name: 'Object Weight Sensor',
    shortName: 'Object Weight Sensor',
    type: 'Force Transducer',
    measures: 'Approximate weight in grams of object contacting the arm.',
    misses: 'Object classification (cannot tell if cup is clean or trash), fragile items.',
    returns: 'WEIGHT (grams)',
    bodyModule: 'Strain gauge pad on gripper',
    mountLocation: 'Gripper Pad',
    isDistractor: true,
    tasks: [],
    icon: '⚖️'
  },
  {
    id: 'SENSE_12',
    name: 'Session Timer Sensor',
    shortName: 'Session Timer',
    type: 'Internal Clock',
    measures: 'Elapsed time of current task or state in seconds. Returns ELAPSED TIME.',
    misses: 'Root cause of delays or external environment obstacles.',
    returns: 'ELAPSED TIME (seconds)',
    bodyModule: 'Digital 7-segment timer display (Upper Back)',
    mountLocation: 'Upper Back',
    isDistractor: false,
    tasks: ['TASK_4'],
    icon: '⏱️'
  },
  {
    id: 'SENSE_13',
    name: 'Sound Level Sensor',
    shortName: 'Sound Level Sensor',
    type: 'Acoustic Ambient',
    measures: 'Ambient room noise level in decibels: QUIET / LOUD.',
    misses: 'Sound direction, speaker identity, room cleanliness. (Irrelevant)',
    returns: 'QUIET / LOUD',
    bodyModule: 'Microphone grill on head side',
    mountLocation: 'Head Side',
    isDistractor: true,
    tasks: [],
    icon: '🎙️'
  },
  {
    id: 'SENSE_14',
    name: 'Stair Edge Detector',
    shortName: 'Stair Edge Detector',
    type: 'Cliff Optical',
    measures: 'Floor drop-off / cliff edge ahead: EDGE DETECTED / CLEAR.',
    misses: 'Level ground obstacles. (Apartment is a single-level flat without interior stairs)',
    returns: 'EDGE DETECTED / CLEAR',
    bodyModule: 'Downward IR cliff beam',
    mountLocation: 'Bumper Bottom',
    isDistractor: true,
    tasks: [],
    icon: '🪜'
  },
  {
    id: 'SENSE_15',
    name: 'Vision Sensor (Object Classifier)',
    shortName: 'Vision Classifier',
    type: 'AI Computer Vision',
    measures: 'Identifies tagged objects in a 120° forward cone: CUP, FOOD, TRASH, BIN, SINK.',
    misses: 'Objects outside 120° cone, occluded objects behind furniture, untagged items.',
    returns: 'OBJECT TYPE + POSITION',
    bodyModule: 'Dual stereoscopic optical camera eyes with blinking HUD',
    mountLocation: 'Face Visor',
    isDistractor: false,
    tasks: ['TASK_2'],
    icon: '👁️'
  }
];

export function getSensorById(id) {
  return SENSORS_CATALOG.find(s => s.id === id);
}
