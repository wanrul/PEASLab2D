/**
 * CollabPEAS - Tasks Catalog
 * Based on CollabPEAS (CSCW Companion '26) & Design Flow Document
 * Six household tasks for the autonomous cleaning agent.
 */

export const PEAS_DIMENSIONS = {
  Coverage: { id: 'Coverage', name: 'Coverage', color: '#eab308', dominantColor: 'rgb(234, 179, 8)' },
  Safety: { id: 'Safety', name: 'Safety', color: '#22c55e', dominantColor: 'rgb(34, 197, 94)' },
  Time: { id: 'Time', name: 'Time', color: '#3b82f6', dominantColor: 'rgb(59, 130, 246)' },
  Hazard: { id: 'Hazard', name: 'Hazard Response', color: '#a855f7', dominantColor: 'rgb(168, 85, 247)' }
};

export const TASKS_CATALOG = [
  {index:0,id:'TASK_1',name:'Navigation & common behaviors',shortName:'Navigation',description:'Write movement, obstacle, animal, human and charging rules. Sensors record observations automatically; the robot follows only your program.',primaryDimension:'Coverage',requiredActuators:['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_ESTOP','ACTUATOR_DOCK_PIN'],requiredModuleNames:['Wheel Drive','Body Rotation','Emergency Stop','Dock Connector Engage'],recommendedSensors:['SENSE_04','SENSE_07','SENSE_01','SENSE_09','SENSE_02','SENSE_03'],icon:'🧭',targetType:'navigation',evaluationCriteria:'Patrol reachable floor and demonstrate common safety and charging behavior.'},
  {index:1,id:'TASK_2',name:'Vacuum and mop',shortName:'Vacuum and mop',description:'Keep your navigation program. Add suction on dry floor and mop contact on spills; choose Quick or Thorough floor coverage.',primaryDimension:'Coverage',requiredActuators:['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_VACUUM','ACTUATOR_MOP'],requiredModuleNames:['Wheel Drive','Body Rotation','Vacuum Suction','Mop Pad Deploy / Retract'],recommendedSensors:['SENSE_04','SENSE_05','SENSE_06','SENSE_07'],icon:'🧹',targetType:'cleaning',evaluationCriteria:'Meet actual floor coverage, mop each spill once and never vacuum water.'},
  {index:2,id:'TASK_3',name:'Pick up and sort',shortName:'Pick up and sort',description:'Keep navigation and cleaning. Identify and pick up objects, choose their destination, carry, release and retract the arm.',primaryDimension:'Coverage',requiredActuators:['ACTUATOR_ARM_EXT','ACTUATOR_ARM_RET','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN'],requiredModuleNames:['Arm Extend','Arm Retract','Gripper Close','Gripper Open'],recommendedSensors:['SENSE_15','SENSE_08','SENSE_03'],icon:'📦',targetType:'objects',evaluationCriteria:'All required objects reach their correct destinations.'},
  {
    index: 3,
    id: 'TASK_4',
    name: 'Detect and avoid the moving cat',
    shortName: 'Avoid Cat',
    description: 'Stop immediately when the moving cat crosses the path (faster than normal deceleration), pause, and reroute safely without disruption.',
    primaryDimension: 'Safety',
    requiredActuators: ['ACTUATOR_ESTOP', 'ACTUATOR_ROTATION', 'ACTUATOR_WHEELS'],
    requiredModuleNames: ['Emergency Stop', 'Body Rotation', 'Wheel Drive'],
    recommendedSensors: ['SENSE_01', 'SENSE_04', 'SENSE_12'],
    icon: '🐱',
    targetType: 'cat',
    evaluationCriteria: 'Zero collisions with the roaming cat; quick emergency stop within 1.5m.'
  },
  {
    index: 4,
    id: 'TASK_5',
    name: 'Slow down near participants',
    shortName: 'Slow Near Humans',
    description: 'When the human operator/participant avatar is within 2 meters, reduce speed to slow; resume normal speed once they leave.',
    primaryDimension: 'Safety',
    requiredActuators: ['ACTUATOR_WHEELS'],
    requiredModuleNames: ['Wheel Drive'],
    recommendedSensors: ['SENSE_04', 'SENSE_09'],
    icon: '🚶',
    targetType: 'participant',
    evaluationCriteria: 'Maintain slow speed while avatar is within 2m proximity.'
  },
  {
    index: 5,
    id: 'TASK_6',
    name: 'Return to charging dock when battery is low',
    shortName: 'Dock on Low Battery',
    description: 'When battery drops below the configured LOW threshold (default 30%), abandon active tasks, navigate directly to the charging dock, and engage docking connector pin.',
    primaryDimension: 'Time',
    requiredActuators: ['ACTUATOR_WHEELS', 'ACTUATOR_ROTATION', 'ACTUATOR_DOCK_PIN'],
    requiredModuleNames: ['Wheel Drive', 'Body Rotation', 'Dock Connector Engage'],
    recommendedSensors: ['SENSE_02', 'SENSE_03', 'SENSE_04'],
    icon: '⚡',
    targetType: 'dock',
    evaluationCriteria: 'Successfully dock and begin charging before battery reaches 0%.'
  }
];

export function getTaskById(id) {
  return TASKS_CATALOG.find(t => t.id === id);
}

export function getTaskByIndex(index) {
  return TASKS_CATALOG[index] || null;
}
