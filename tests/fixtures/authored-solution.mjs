import { appState } from '../../js/state.js';
function rule(task,slots) { const row=appState.addRule(`TASK_${task}`);for(const [slot,block]of Object.entries(slots))appState.setRuleSlot(row.id,slot,block);return row; }

// These are authored examples for feasibility testing, never installed into the learner's editor.
export function authorSolution(stage){
  appState.installedSensors=new Set(['SENSE_05','SENSE_07','SENSE_04',...(stage>=2?['SENSE_15','SENSE_03','SENSE_08']:[]),...(stage>=3?['SENSE_06']:[]),...(stage>=4?['SENSE_01']:[]),...(stage>=5?['SENSE_09']:[]),...(stage>=6?['SENSE_02']:[])]);
  appState.installedActuators=new Set(['ACTUATOR_WHEELS','ACTUATOR_ROTATION','ACTUATOR_VACUUM',...(stage>=2?['ACTUATOR_ARM_EXT','ACTUATOR_GRIP_CLOSE','ACTUATOR_GRIP_OPEN']:[]),...(stage>=3?['ACTUATOR_MOP']:[]),...(stage>=4?['ACTUATOR_ESTOP']:[]),...(stage>=6?['ACTUATOR_DOCK_PIN']:[])]);
  rule(1,{sense:'SENSE_05',condition:'COND_03',action:'ACT_09'});
  rule(1,{sense:'SENSE_05',condition:'COND_06',action:'ACT_10'});
  if(stage>=2){
    rule(2,{sense:'SENSE_15',condition:'COND_16',action:'ACT_24'});
    rule(2,{sense:'SENSE_15',condition:'COND_17',action:'ACT_25'});
    rule(2,{sense:'SENSE_15',action:'ACT_13',control:'CTRL_04',secondaryAction:'ACT_14'});
    rule(2,{sense:'SENSE_03',condition:'COND_10',action:'ACT_15',priority:'CTRL_05'});
  }
  if(stage>=3){rule(3,{sense:'SENSE_06',condition:'COND_04',action:'ACT_10',control:'CTRL_04',secondaryAction:'ACT_11',priority:'CTRL_05'});rule(3,{sense:'SENSE_06',condition:'COND_21',action:'ACT_12'});}
  if(stage>=4)rule(4,{sense:'SENSE_01',condition:'COND_07',action:'ACT_06',priority:'CTRL_05'});
  if(stage>=5){rule(5,{sense:'SENSE_09',condition:'COND_12',action:'ACT_07',priority:'CTRL_05'});rule(5,{sense:'SENSE_09',condition:'COND_13',action:'ACT_08',priority:'CTRL_05'});}
  if(stage>=6){rule(6,{sense:'SENSE_02',condition:'COND_08',action:'ACT_26',priority:'CTRL_05'});rule(6,{sense:'SENSE_03',condition:'COND_10',action:'ACT_17',priority:'CTRL_05'});}
}

