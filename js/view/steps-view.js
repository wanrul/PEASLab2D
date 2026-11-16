import { isFactoryPurpose } from '../i18n.js';
import { appState } from '../state.js';
import { TASKS_CATALOG } from '../data/tasks.js';
import { SENSORS_CATALOG } from '../data/sensors.js';
import { ACTUATORS_CATALOG } from '../data/actuators.js';
import { PILOT_STAGES, TASK_PURPOSES, criterionDescriptions } from '../pilot-config.js';
import { renderSensorStep, renderActuatorStep } from './mounting-view.js';
import { getBlockById } from '../data/blocks.js';
import { sessionLogger } from '../logging/session-log.js';
import { sound } from './audio.js';
import { ENVIRONMENT_ITEMS } from '../data/environment.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class StepsView {
  constructor(panelElement,blockCanvasView,observationLogView) {
    this.panel=panelElement;this.blockCanvasView=blockCanvasView;this.observationLogView=observationLogView;
    appState.on('purposeChanged',()=>this.updatePurposeGate());
    appState.on('environmentObservationChanged',()=>this.updateEnvironmentGate());
    appState.on('tick',()=>this.updateStep6LiveDashboard());
    appState.on('observationAdded',()=>this.renderObservations());
    appState.on('simReset',()=>this.updateStep6LiveDashboard());
    appState.on('simStateChanged',()=>this.updateStep6LiveDashboard());
    appState.on('runEnded',()=>this.updateStep6LiveDashboard());
    appState.on('reflectionNeeded',data=>this.showReflection(data));
    appState.on('reflectionSelected',()=>document.getElementById('reflectionPanel')?.remove());
  }
  render() { if(this.panel) this[`renderStep${appState.currentStep}`](); }
  stageHeading() { return `<p class="stage-progress">Task ${appState.currentStage} of ${PILOT_STAGES.length} · ${escape(PILOT_STAGES[appState.currentStage-1].name)}</p>`; }
  renderOverview() {
    this.panel.innerHTML=`<section class="v6-step overview"><h2>Instructions</h2><p>Build one robot across three tasks. Keep your hardware and program, then add the next capability.</p><div class="overview-missions"><article><h3>1 · Navigation & common behaviors</h3><p>Write the driving route, obstacle responses, animal and human safety, and charging rules.</p></article><article><h3>2 · Vacuum and mop</h3><p>Keep navigation. Add suction and mop control, choose Quick or Thorough coverage, and keep suction off water.</p></article><article><h3>3 · Pick up and sort</h3><p>Keep earlier behaviors. Add object identification, pickup, delivery and release.</p></article></div><footer class="step-nav-footer overview-footer"><button class="btn btn-primary" id="beginDesign">Continue</button></footer></section>`;
    this.panel.querySelector('#beginDesign').onclick=()=>{appState.overviewStarted=true;window.navigateStep(appState.currentStep);};
  }
  renderStep1() {
    const tasks=PILOT_STAGES[appState.currentStage-1].missionTaskIds;
    this.panel.innerHTML=`<section class="v6-step"><h2>Set performance measurement</h2><p>Choose the result you want. Your own program must implement it; selecting a goal does not change the route automatically.</p><div class="stage-purposes">${tasks.map(id=>{
      const task=TASKS_CATALOG.find(t=>t.id===id),purpose=appState.stagePurposes[appState.currentStage][id];
      const requirements=id==='TASK_1'?`<section class="purpose-requirements"><h4>Common behaviors in every task</h4><ul><li>Write how to move around furniture and through doorways.</li><li>Define how to respond to the cat.</li><li>Define when to slow near a person and restore speed.</li><li>Define when to return, connect, recharge and resume.</li></ul></section>`:id==='TASK_2'?'<p>Each spill is clean after actual mop contact. No repeated wiping or cleaning-degree setting is required. Never vacuum water.</p>':'<p>Trash belongs in the bin; belongings go to the designated table. Confirm pickup and release.</p>';
      const goal=id==='TASK_1'?`${appState.currentStage===1?'<p>Task 1 requires visiting 100% of reachable floor area in either mode. The cleaning targets below apply from Task 2.</p>':''}<fieldset class="cleaning-goals"><legend>Performance measurement</legend>${TASK_PURPOSES[id].priorities.map(([value,label])=>{
        const coverage=value==='thorough'?'100% of cleanable floor area':'At least 60% of cleanable floor area';
        return `<label class="cleaning-goal"><input type="radio" name="priority-${id}" data-task-priority="${id}" value="${value}" ${purpose.priority===value?'checked':''}><span><strong>${escape(label)}</strong><span class="cleaning-goal-detail">${coverage}</span><span class="cleaning-goal-detail">${value==='thorough'?'About 40 simulation minutes':'About 20 simulation minutes'}</span></span></label>`;
      }).join('')}</fieldset>`:'';
      return `<article class="purpose-task"><h3>${escape(task.name)}</h3><p class="purpose-task-description" data-task-description="${id}">${escape(purpose.purpose)}</p>${requirements}${goal}</article>`;
    }).join('')}</div><footer class="step-nav-footer"><span>Choose a performance measurement to continue.</span><button id="priorityContinue" class="btn btn-primary">Continue</button></footer></section>`;
    this.panel.querySelectorAll('[data-task-priority]').forEach(input=>input.onchange=()=>appState.setTaskPriority(input.dataset.taskPriority,input.value));
    this.panel.querySelector('#priorityContinue').onclick=()=>window.navigateStep(2);
    this.updatePurposeGate();
  }
  updatePurposeGate() { const button=this.panel?.querySelector('#priorityContinue');if(button)button.disabled=!appState.canContinue(1); }
  renderStep2() {
    this.panel.innerHTML=`<section class="v6-step environment-step">${this.stageHeading()}<h2>Observe the environment</h2><p>Walk around in FPS 360°, 3D 360° or Third person and approach every labelled location. Labels turn green after observation.</p><div class="environment-actions"><button class="btn btn-primary" id="walkEnvironment">Walk around in FPS 360°</button><button class="btn btn-outline" id="viewYourself">View yourself in Third person</button><button class="btn btn-outline" id="viewWholeApartment">View whole apartment</button></div><p id="environmentProgress" role="status" aria-live="polite"></p><div class="environment-checklist" role="group" aria-label="Environment observations">${ENVIRONMENT_ITEMS.map(item=>{
      const progress=appState.getEnvironmentProgress(item.id);
      return `<article class="environment-item" data-environment-category="${item.id}"><div class="environment-item-heading"><strong>${item.label}</strong><span class="environment-count">${progress.observed} / ${progress.total}</span></div><span class="environment-description">${item.description}</span></article>`;
    }).join('')}</div><footer class="step-nav-footer"><button class="btn btn-primary" id="environmentContinue">Continue</button></footer></section>`;
    this.panel.querySelector('#walkEnvironment').onclick=()=>{
      window.switchViewMode('fps');
      appState.environmentWalkingEnabled=true;
      document.getElementById(window.map3d?'threeCanvas':'houseCanvas')?.focus({preventScroll:true});
    };
    this.panel.querySelector('#viewYourself').onclick=()=>{
      window.switchViewMode('thirdPerson');
      appState.environmentWalkingEnabled=true;
      document.getElementById(window.map3d?'threeCanvas':'houseCanvas')?.focus({preventScroll:true});
    };
    this.panel.querySelector('#viewWholeApartment').onclick=()=>{
      window.switchViewMode(window.map3d?'3d':'fallback');
      appState.environmentWalkingEnabled=Boolean(window.map3d);
      window.map3d?.viewWholeApartment();
      window.closeStepModal?.();
    };
    this.panel.querySelector('#environmentContinue').onclick=()=>{if(appState.canContinue(2))window.navigateStep(3);};
    this.updateEnvironmentGate();
  }
  updateEnvironmentGate() {
    const button=this.panel?.querySelector('#environmentContinue');if(button)button.disabled=!appState.canContinue(2);
    const count=this.panel?.querySelector('#environmentProgress'),progress=appState.getEnvironmentProgress();
    if(count)count.textContent=`${progress.observed} / ${progress.total} observed`;
    this.panel?.querySelectorAll('[data-environment-category]').forEach(row=>{
      const status=appState.getEnvironmentProgress(row.dataset.environmentCategory);
      row.querySelector('.environment-count').textContent=`${status.observed} / ${status.total}`;
      row.classList.toggle('observed',status.total>0&&status.observed===status.total);
    });
  }
  renderStep3(){renderSensorStep(this.panel);}
  renderStep4(){renderActuatorStep(this.panel);}
  renderStep5(){this.blockCanvasView.render();}
  renderStep6() {
    if(appState.sessionFinished){if(this.finalSummary)this.showFinalSummaryModal();else this.showClosingReflection();return;}
    const engine=window.simEngine,attempted=appState.getAttemptedTaskIds().length;
    this.panel.innerHTML=`<section class="v6-step run-step">${this.stageHeading()}<h2>Test & debug</h2><p>Observe the results against the current criteria. Revise your design and try again.</p><p>Fresh runs start at 35% battery. Set your own response thresholds in Logic. Every current task and common behavior must succeed in the same run.</p><span class="attempt-count">Programs configured for ${attempted} active behavior groups.</span>
      <div class="sim-control-bar"><button class="btn btn-primary" id="simPlayBtn">Run</button><button class="btn btn-outline" id="simPauseBtn">Pause</button><button class="btn btn-outline" id="simResetBtn">Reset</button><label>Speed <select id="runSpeed"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option></select></label><button class="btn btn-outline" id="evaluateRun">End run & evaluate</button></div>
      <div id="criterionResults">${this.renderCriteria()}</div><div id="taskOutcomeStrip">${this.renderTaskOutcomes()}</div>
      <div class="trace-panel" id="runTrace"><div>SENSING <span>—</span></div><div>DECIDING <span>—</span></div><div>ACTING <span>—</span></div></div>
      <div class="observation-input"><input id="observationNote" maxlength="180" placeholder="Optional note" aria-label="Observation note">${['✓','✗','?'].map(s=>`<button class="btn btn-outline" data-stamp="${s}">${s}</button>`).join('')}</div><div id="singleObservationLog"></div>
      <div class="edit-actions">${[[1,'Purpose'],[2,'Environment'],[3,'Sensors'],[4,'Actuators'],[5,'Logic']].map(([step,label])=>`<button class="btn btn-outline" data-edit-step="${step}">Edit ${label}</button>`).join('')}</div>
      <label for="stageReflection">Stage reflection: What did you change, and what did you observe?</label><textarea id="stageReflection" rows="3">${escape(appState.stageResults[appState.currentStage].closingText)}</textarea>
      ${appState.currentStage<PILOT_STAGES.length?'<p id="stagePassStatus"></p><footer class="step-nav-footer"><button class="btn btn-primary" id="continueStage">Continue</button></footer>':'<footer class="step-nav-footer"><button class="btn btn-primary" id="finishSession">Continue</button></footer>'}</section>`;
    this.panel.querySelector('#simPlayBtn').onclick=()=>{const wasRunning=appState.simRunning;engine.start();if(!wasRunning)sound.playEvent?.('run');};
    this.panel.querySelector('#simPauseBtn').onclick=()=>engine.pause();
    this.panel.querySelector('#simResetBtn').onclick=()=>engine.reset();
    this.panel.querySelector('#evaluateRun').onclick=()=>{engine.endRun('evaluate');this.updateStep6LiveDashboard();};
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
    this.renderObservations();this.updateStep6LiveDashboard();
    if(appState.reflectionPrompt)this.showReflection(appState.reflectionPrompt);
  }
  renderObservations(){
    const log=this.panel?.querySelector('#singleObservationLog');if(!log)return;
    log.innerHTML=appState.observationLogs.map(e=>`<div class="single-stamp"><strong>${e.stamp}</strong><time>${escape(e.timestamp)} · Stage ${e.stageId}</time><span data-i18n-skip>${escape(e.comment)}</span></div>`).reverse().join('');
  }
  renderCriteria(criteria=window.simEngine?.criteriaResults,elapsed=window.simEngine?.elapsedSeconds,counters=null) {
    const engine=window.simEngine;
    const navigationOnly=(criteria||[]).some(c=>c.id==='navigation')&&!(criteria||[]).some(c=>['cleaning','spills','sorting'].includes(c.id));
    const metrics=counters===null?engine?.getCleaningMetrics?.():counters;
    const percent=value=>Number.isFinite(value)?`${value.toFixed(1)}%`:'—';
    const dirtCount=Number.isFinite(metrics?.dirtCleaned)&&Number.isFinite(metrics?.dirtTotal)?`${metrics.dirtCleaned} / ${metrics.dirtTotal}`:'—';
    const dirtPercent=metrics?.dirtCleanedPercent ?? (Number.isFinite(metrics?.dirtCleaned)&&metrics?.dirtTotal>0?metrics.dirtCleaned/metrics.dirtTotal*100:undefined);
    const inspection=counters===null?(engine?.inspectionTicks||0)/(engine?.tickRateHz||10):counters.inspectionSeconds;
    const cleanVacuum=counters===null?(engine?.cleanVacuumTicks||0)/(engine?.tickRateHz||10):counters.cleanVacuumSeconds;
    const seconds=value=>Number.isFinite(value)?value.toFixed(1):'—';
    return `<section class="cleaning-results-panel"><h3>Recorded results</h3><div class="cleaning-results"><article data-cleaning-metric="navigation"><h4>Patrol coverage</h4><strong>${percent(engine?.navigationCoveragePercent?.())}</strong><p>Actual floor visited</p></article>${navigationOnly?'':`<article data-cleaning-metric="floor"><h4>Floor cleaning coverage</h4><strong>${percent(metrics?.floorCoveragePercent)}</strong><p>Of cleanable floor area</p></article><article data-cleaning-metric="dirt"><h4>Dirt spots removed</h4><strong>${dirtCount}</strong><p>${percent(dirtPercent)}</p></article>`}</div></section><table class="criteria-table"><thead><tr><th>Criterion</th><th>Observed result</th><th>Status</th></tr></thead><tbody>${(criteria||[]).map(c=>`<tr data-criterion="${c.id}"><th>${escape(c.label)}</th><td>${escape(c.observed)}</td><td>${escape(c.status)}</td></tr>`).join('')}</tbody></table><p class="elapsed-observation">Elapsed duration: ${Number(elapsed||0).toFixed(1)} seconds</p>${navigationOnly?'':`<p class="tool-observations">Inspection without cleaning tools: ${seconds(inspection)} seconds · Vacuum on clean floor: ${seconds(cleanVacuum)} seconds. These observations have no pass threshold.</p>`}`;
  }
  updateStep6LiveDashboard(){
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
    document.querySelectorAll('.step-nav-item,.modal-tab-btn').forEach(button=>{button.disabled=Number(button.dataset.step)!==6;});
    const hud=document.getElementById('simFloatingHud');if(hud)hud.hidden=true;
    this.panel.innerHTML=`<section class="v6-step"><h2>Reflect on your design</h2><label for="closingReflection">What did you change about your robot, and how did that affect its behavior?</label><textarea id="closingReflection" rows="5">${escape(this.closingDraft||appState.stageResults[appState.currentStage].closingText)}</textarea><footer class="step-nav-footer"><button class="btn btn-primary" id="showSummary">Continue</button></footer></section>`;
    this.panel.querySelector('#closingReflection').oninput=event=>{this.closingDraft=event.target.value;};
    this.panel.querySelector('#showSummary').onclick=()=>{appState.setClosingText(this.panel.querySelector('#closingReflection').value);this.finalSummary=true;document.getElementById('reflectionPanel')?.remove();this.showFinalSummaryModal();};
  }
  showFinalSummaryModal(){
    const catalogNames=(set,catalog)=>[...set].map(id=>catalog.find(c=>c.id===id)?.name||id).join(', ');
    this.panel.innerHTML=`<section class="v6-step"><h2>Your robot design</h2><dl><dt>Sensors</dt><dd>${escape(catalogNames(appState.installedSensors,SENSORS_CATALOG))||'None'}</dd><dt>Actuators</dt><dd>${escape(catalogNames(appState.installedActuators,ACTUATORS_CATALOG))||'None'}</dd><dt>Revisions</dt><dd>${appState.revisitedSteps.length}</dd></dl>
      ${PILOT_STAGES.filter(stage=>appState.stageResults[stage.id]).map(stage=>{
        const runs=appState.runHistory.filter(run=>run.stageId===stage.id),last=runs.at(-1),result=appState.stageResults[stage.id];
        return `<article class="stage-summary"><h3>Stage ${stage.id}: ${escape(stage.name)}</h3><p>${result.passingRunId===null?'No recorded passing run.':`Recorded passing run: ${result.passingRunId}.`} ${runs.length} formal runs.</p>${Object.entries(appState.stagePurposes[stage.id]).map(([id,p])=>`<p><span>${escape(TASKS_CATALOG.find(t=>t.id===id)?.name)}</span>: <span ${isFactoryPurpose(p.purpose,TASK_PURPOSES[id].purpose,`${stage.id}:${id}`)?'':'data-i18n-skip'}>${escape(p.purpose)}</span> · <span>Priority:</span> <span>${escape(TASK_PURPOSES[id].priorities.find(([key])=>key===p.priority)?.[1]||'Not selected')}</span></p>`).join('')}<p>Latest run: ${last?(last.passed?'all criteria achieved':'criteria unmet'):'No run recorded'}</p>${last?this.renderCriteria(last.criteria,last.elapsedSeconds,last.counters||{})+this.renderTaskOutcomes(last.outcomes,true):''}<p data-i18n-skip>${escape(result.closingText)}</p></article>`;
      }).join('')}<button class="btn btn-primary" id="downloadSession">Download log</button></section>`;
    this.panel.querySelector('#downloadSession').onclick=()=>sessionLogger.exportCsv();
  }
}
