import { bindPurposeField, isFactoryPurpose } from '../i18n.js';
import { appState } from '../state.js';
import { TASKS_CATALOG } from '../data/tasks.js';
import { SENSORS_CATALOG } from '../data/sensors.js';
import { ACTUATORS_CATALOG } from '../data/actuators.js';
import { PILOT_STAGES, TASK_PURPOSES, criterionDescriptions } from '../pilot-config.js';
import { renderSensorStep, renderActuatorStep } from './mounting-view.js';
import { getBlockById } from '../data/blocks.js';
import { sessionLogger } from '../logging/session-log.js';
import { sound } from './audio.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class StepsView {
  constructor(panelElement,blockCanvasView,observationLogView) {
    this.panel=panelElement;this.blockCanvasView=blockCanvasView;this.observationLogView=observationLogView;
    appState.on('purposeChanged',()=>this.updatePurposeGate());
    appState.on('tick',()=>this.updateStep5LiveDashboard());
    appState.on('observationAdded',()=>this.renderObservations());
    appState.on('simReset',()=>this.updateStep5LiveDashboard());
    appState.on('simStateChanged',()=>this.updateStep5LiveDashboard());
    appState.on('runEnded',()=>this.updateStep5LiveDashboard());
    appState.on('reflectionNeeded',data=>this.showReflection(data));
    appState.on('reflectionSelected',()=>document.getElementById('reflectionPanel')?.remove());
  }
  render() { if(this.panel) this[`renderStep${appState.currentStep}`](); }
  stageHeading() { return `<p class="stage-progress">Stage ${appState.currentStage} of ${PILOT_STAGES.length} · ${escape(PILOT_STAGES[appState.currentStage-1].name)}</p>`; }
  renderOverview() {
    this.panel.innerHTML=`<section class="v6-step overview"><h2>One robot. Three growing missions.</h2><p>Design your own household robot from an empty body and program. Each mission adds a responsibility; keep and improve your earlier design.</p><div class="overview-missions"><article><h3>1 · Vacuum the floor</h3><p>Find and remove dirt throughout the apartment.</p></article><article><h3>2 · Add spill cleaning</h3><p>Keep vacuuming and clean spills without using suction on liquid.</p></article><article><h3>3 · Add pickup and sorting</h3><p>Keep both cleaning tasks and move scattered objects to their correct destinations.</p></article></div><h3>Common safety and charging</h3><p>In every mission, navigate furniture and doorways, stop for the moving cat, slow near people and resume afterwards, and return to connect at the dock when battery is low.</p><p>Each fresh test starts at 35% battery. LOW means below 30%. Battery drains during work and charges only while physically connected. Your program must decide when to release the connector and continue.</p><h3>Your five PEAS steps</h3><p>Purpose → Sensors → Actuators → Logic → Test & debug. Revisit any unlocked step to improve your design.</p><p>Sensor budgets grow from 7 to 8 to 11; there are 10 actuator positions. These are provisional pilot settings, not recommendations.</p><p>Advance after a formal run meets every current criterion. Final success means all three tasks and common safety and charging succeed in the same run.</p><p>Hardware, programs, purpose edits, observations and results carry forward. Overview can be revisited without losing your work.</p><button class="btn btn-primary" id="beginDesign">Begin / return to design</button></section>`;
    this.panel.querySelector('#beginDesign').onclick=()=>{appState.overviewStarted=true;window.navigateStep(appState.currentStep);};
  }
  renderStep1() {
    this.panel.innerHTML=`<section class="v6-step">${this.stageHeading()}<h2>Define the current purpose</h2><p>Choose what matters for each current task. Your selection records your design intent; your hardware and rules determine behavior.</p>
      <div class="stage-purposes">${PILOT_STAGES[appState.currentStage-1].missionTaskIds.map(id=>TASKS_CATALOG.find(task=>task.id===id)).map(task=>{
        const purpose=appState.stagePurposes[appState.currentStage][task.id];
        return `${task.id==='TASK_4'?'<h3 class="common-heading">Common safety and charging</h3>':''}<article class="purpose-task"><h3>${escape(task.icon)} ${escape(task.name)}</h3><label>Purpose<textarea data-task-purpose="${task.id}" rows="2">${escape(purpose.purpose)}</textarea></label><p>Success criterion: ${escape(criterionDescriptions(appState.currentStage).find(c=>c.taskId===task.id)?.label)}</p><fieldset><legend>Task priority</legend>${TASK_PURPOSES[task.id].priorities.map(([id,label])=>`<label><input type="radio" name="priority-${task.id}" data-task-priority="${task.id}" value="${id}" ${purpose.priority===id?'checked':''}> ${escape(label)}</label>`).join('')}</fieldset></article>`;
      }).join('')}</div><h3>Common safety and charging</h3><p>In every mission, navigate furniture and doorways, stop for the moving cat, slow near people and resume afterwards, and return to connect at the dock when battery is low.</p><p>${criterionDescriptions(appState.currentStage).some(c=>c.id==='speed')?escape(criterionDescriptions(appState.currentStage).find(c=>c.id==='speed').label):'Speed: elapsed duration will be recorded. No time target is set for this stage.'}</p>
      <footer class="step-nav-footer"><span>Choose a task priority for each current task to continue.</span><button id="priorityContinue" class="btn btn-primary">Continue</button></footer></section>`;
    this.panel.querySelectorAll('[data-task-purpose]').forEach(input=>{
      const taskId=input.dataset.taskPurpose;
      const readPurpose=bindPurposeField(input,appState.stagePurposes[appState.currentStage][taskId].purpose,TASK_PURPOSES[taskId].purpose,`${appState.currentStage}:${taskId}`);
      input.onchange=()=>appState.setTaskPurpose(taskId,readPurpose());
    });
    this.panel.querySelectorAll('[data-task-priority]').forEach(input=>input.onchange=()=>appState.setTaskPriority(input.dataset.taskPriority,input.value));
    this.panel.querySelector('#priorityContinue').onclick=()=>window.navigateStep(2);
    this.updatePurposeGate();
  }
  updatePurposeGate() { const button=this.panel?.querySelector('#priorityContinue');if(button)button.disabled=!appState.canContinue(1); }
  renderStep2(){renderSensorStep(this.panel);}
  renderStep3(){renderActuatorStep(this.panel);}
  renderStep4(){this.blockCanvasView.render();}
  renderStep5() {
    if(appState.sessionFinished){if(this.finalSummary)this.showFinalSummaryModal();else this.showClosingReflection();return;}
    const engine=window.simEngine,attempted=appState.getAttemptedTaskIds().length;
    this.panel.innerHTML=`<section class="v6-step run-step">${this.stageHeading()}<h2>Test & debug</h2><p>Observe the results against the current criteria. Revise your design and try again.</p><p>Fresh runs start at 35% battery; LOW is below 30%. Every current task and common safety and charging criterion must succeed in the same run.</p><span class="attempt-count">Programs configured for ${attempted} active behavior groups.</span>
      <div class="sim-control-bar"><button class="btn btn-primary" id="simPlayBtn">Run</button><button class="btn btn-outline" id="simPauseBtn">Pause</button><button class="btn btn-outline" id="simResetBtn">Reset</button><label>Speed <select id="runSpeed"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option></select></label><button class="btn btn-outline" id="evaluateRun">End run & evaluate</button></div>
      <div id="criterionResults">${this.renderCriteria()}</div><div id="taskOutcomeStrip">${this.renderTaskOutcomes()}</div>
      <div class="trace-panel" id="runTrace"><div>SENSING <span>—</span></div><div>DECIDING <span>—</span></div><div>ACTING <span>—</span></div></div>
      <div class="observation-input"><input id="observationNote" maxlength="180" placeholder="Optional note" aria-label="Observation note">${['✓','✗','?'].map(s=>`<button class="btn btn-outline" data-stamp="${s}">${s}</button>`).join('')}</div><div id="singleObservationLog"></div>
      <div class="edit-actions">${[[1,'Purpose'],[2,'Sensors'],[3,'Actuators'],[4,'Logic']].map(([step,label])=>`<button class="btn btn-outline" data-edit-step="${step}">Edit ${label}</button>`).join('')}</div>
      <label for="stageReflection">Stage reflection: What did you change, and what did you observe?</label><textarea id="stageReflection" rows="3">${escape(appState.stageResults[appState.currentStage].closingText)}</textarea>
      ${appState.currentStage<PILOT_STAGES.length?'<p id="stagePassStatus"></p><button class="btn btn-primary" id="continueStage">Continue to next stage</button>':'<button class="btn btn-primary" id="finishSession">Finish & reflect</button>'}</section>`;
    this.panel.querySelector('#simPlayBtn').onclick=()=>{const wasRunning=appState.simRunning;engine.start();if(!wasRunning)sound.playEvent?.('run');};
    this.panel.querySelector('#simPauseBtn').onclick=()=>engine.pause();
    this.panel.querySelector('#simResetBtn').onclick=()=>engine.reset();
    this.panel.querySelector('#evaluateRun').onclick=()=>{engine.endRun('evaluate');this.updateStep5LiveDashboard();};
    this.panel.querySelector('#runSpeed').value=String(appState.simSpeed);
    this.panel.querySelector('#runSpeed').onchange=e=>engine.setSpeed(Number(e.target.value));
    this.panel.querySelectorAll('[data-stamp]').forEach(btn=>btn.onclick=()=>{const note=this.panel.querySelector('#observationNote');appState.addObservation(btn.dataset.stamp,note.value);note.value='';});
    this.panel.querySelectorAll('[data-edit-step]').forEach(btn=>btn.onclick=()=>{engine.endRun('revision');window.navigateStep(Number(btn.dataset.editStep));});
    this.panel.querySelector('#stageReflection').onchange=event=>appState.setClosingText(event.target.value);
    if(appState.currentStage<PILOT_STAGES.length) this.panel.querySelector('#continueStage').onclick=()=>{
      engine.endRun('stage-transition');
      appState.setClosingText(this.panel.querySelector('#stageReflection').value || '');
      if(appState.continueStage()) window.navigateStep(1);
    };
    else this.panel.querySelector('#finishSession').onclick=()=>this.showClosingReflection();
    this.renderObservations();this.updateStep5LiveDashboard();
    if(appState.reflectionPrompt)this.showReflection(appState.reflectionPrompt);
  }
  renderObservations(){
    const log=this.panel?.querySelector('#singleObservationLog');if(!log)return;
    log.innerHTML=appState.observationLogs.map(e=>`<div class="single-stamp"><strong>${e.stamp}</strong><time>${escape(e.timestamp)} · Stage ${e.stageId}</time><span data-i18n-skip>${escape(e.comment)}</span></div>`).reverse().join('');
  }
  renderCriteria(criteria=window.simEngine?.criteriaResults,elapsed=window.simEngine?.elapsedSeconds,counters=null) {
    const engine=window.simEngine;
    const inspection=counters?.inspectionSeconds ?? (engine?.inspectionTicks||0)/(engine?.tickRateHz||10);
    const cleanVacuum=counters?.cleanVacuumSeconds ?? (engine?.cleanVacuumTicks||0)/(engine?.tickRateHz||10);
    return `<table class="criteria-table"><thead><tr><th>Criterion</th><th>Observed result</th><th>Status</th></tr></thead><tbody>${(criteria||[]).map(c=>`<tr data-criterion="${c.id}"><th>${escape(c.label)}</th><td>${escape(c.observed)}</td><td>${escape(c.status)}</td></tr>`).join('')}</tbody></table><p class="elapsed-observation">Elapsed duration: ${Number(elapsed||0).toFixed(1)} seconds</p><p class="tool-observations">Inspection without cleaning tools: ${inspection.toFixed(1)} seconds · Vacuum on clean floor: ${cleanVacuum.toFixed(1)} seconds. These observations have no pass threshold.</p>`;
  }
  updateStep5LiveDashboard(){
    const engine=window.simEngine;
    const table=this.panel?.querySelector('#criterionResults');if(table)table.innerHTML=this.renderCriteria();
    const strip=this.panel?.querySelector('#taskOutcomeStrip');if(strip)strip.innerHTML=this.renderTaskOutcomes();
    const next=this.panel?.querySelector('#continueStage');if(next)next.disabled=!appState.canContinueStage();
    const pass=this.panel?.querySelector('#stagePassStatus');if(pass)pass.textContent=appState.canContinueStage()?`Stage ${appState.currentStage} has a recorded passing run (run ${appState.stageResults[appState.currentStage].passingRunId}). You may continue, or revise and test again.`:`End a formal run that meets all current criteria to unlock Stage ${appState.currentStage+1}.`;
    const trace=this.panel?.querySelector('#runTrace'),t=engine?.lastTrace||engine?.world?.robot?.traceState;
    if(trace&&t) ['sense','decide','act'].forEach((key,i)=>{trace.children[i].querySelector('span').textContent=getBlockById(t[key]||t[{sense:'sense',decide:'condition',act:'action'}[key]])?.name||t[key]||'—';});
  }
  renderTaskOutcomes(outcomes=window.simEngine?.taskOutcomes, expanded=window.simEngine?.finalOutcomes) {
    const icons={not_started:'○',in_progress:'◷',done:'✓',failed:'✗'};
    return `<div class="task-outcome-strip">${(outcomes||[]).map(outcome=>{
      const task=TASKS_CATALOG.find(task=>task.id===outcome.taskId),status=outcome.status;
      return `<article class="task-outcome" data-task-id="${outcome.taskId}" data-status="${status}"><strong><span role="img" aria-label="${status.replace('_',' ')}">${icons[status]}</span> ${escape(task?.name)}</strong><span class="task-outcome-summary" ${expanded?'':'hidden'}>${escape(outcome.summary)}</span></article>`;
    }).join('')}</div>`;
  }
  showReflection(data){
    document.getElementById('reflectionPanel')?.remove();
    const panel=document.createElement('aside');panel.id='reflectionPanel';panel.className='reflection-panel';
    panel.innerHTML=`<p>Run ${data.runId} ended with an unmet criterion. Which part of your design would you review?</p><div>${[['goal','My goal or task priority'],['sensor','My sensors'],['rule','My rules'],['actuator','My actuators']].map(([id,label])=>`<button class="btn btn-outline" data-reflection="${id}">${label}</button>`).join('')}</div>`;
    document.body.appendChild(panel);
    panel.querySelectorAll('[data-reflection]').forEach(btn=>btn.onclick=()=>appState.selectReflection(btn.dataset.reflection));
  }
  showClosingReflection(){
    window.simEngine?.endRun('finish');
    appState.sessionFinished=true;
    if(!this.closingStarted) {
      appState.record('STAGE_ENDED',String(appState.currentStage),{passingRunId:appState.stageResults[appState.currentStage].passingRunId});
      this.closingStarted=true;
    }
    document.querySelectorAll('.step-nav-item,.modal-tab-btn').forEach(button=>{button.disabled=Number(button.dataset.step)!==5;});
    const hud=document.getElementById('simFloatingHud');if(hud)hud.hidden=true;
    this.panel.innerHTML=`<section class="v6-step"><h2>Reflect on your design</h2><label for="closingReflection">What did you change about your robot, and how did that affect its behavior?</label><textarea id="closingReflection" rows="5">${escape(this.closingDraft||appState.stageResults[appState.currentStage].closingText)}</textarea><button class="btn btn-primary" id="showSummary">Continue</button></section>`;
    this.panel.querySelector('#closingReflection').oninput=event=>{this.closingDraft=event.target.value;};
    this.panel.querySelector('#showSummary').onclick=()=>{appState.setClosingText(this.panel.querySelector('#closingReflection').value);this.finalSummary=true;document.getElementById('reflectionPanel')?.remove();this.showFinalSummaryModal();};
  }
  showFinalSummaryModal(){
    const catalogNames=(set,catalog)=>[...set].map(id=>catalog.find(c=>c.id===id)?.name||id).join(', ');
    this.panel.innerHTML=`<section class="v6-step"><h2>Your robot design</h2><dl><dt>Sensors</dt><dd>${escape(catalogNames(appState.installedSensors,SENSORS_CATALOG))||'None'}</dd><dt>Actuators</dt><dd>${escape(catalogNames(appState.installedActuators,ACTUATORS_CATALOG))||'None'}</dd><dt>Revisions</dt><dd>${appState.revisitedSteps.length}</dd></dl>
      ${PILOT_STAGES.filter(stage=>appState.stageResults[stage.id]).map(stage=>{
        const runs=appState.runHistory.filter(run=>run.stageId===stage.id),last=runs.at(-1),result=appState.stageResults[stage.id];
        return `<article class="stage-summary"><h3>Stage ${stage.id}: ${escape(stage.name)}</h3><p>${result.passingRunId===null?'No recorded passing run.':`Recorded passing run: ${result.passingRunId}.`} ${runs.length} formal runs.</p>${Object.entries(appState.stagePurposes[stage.id]).map(([id,p])=>`<p><span>${escape(TASKS_CATALOG.find(t=>t.id===id)?.name)}</span>: <span ${isFactoryPurpose(p.purpose,TASK_PURPOSES[id].purpose,`${stage.id}:${id}`)?'':'data-i18n-skip'}>${escape(p.purpose)}</span> · <span>Priority:</span> <span>${escape(TASK_PURPOSES[id].priorities.find(([key])=>key===p.priority)?.[1]||'Not selected')}</span></p>`).join('')}<p>Latest run: ${last?(last.passed?'all criteria achieved':'criteria unmet'):'No run recorded'}</p>${last?this.renderCriteria(last.criteria,last.elapsedSeconds,last.counters)+this.renderTaskOutcomes(last.outcomes,true):''}<p data-i18n-skip>${escape(result.closingText)}</p></article>`;
      }).join('')}<button class="btn btn-primary" id="downloadSession">Download log</button></section>`;
    this.panel.querySelector('#downloadSession').onclick=()=>sessionLogger.exportCsv();
  }
}
