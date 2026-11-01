import { appState } from '../state.js';
import { TASKS_CATALOG, PEAS_DIMENSIONS } from '../data/tasks.js';
import { SENSORS_CATALOG } from '../data/sensors.js';
import { ACTUATORS_CATALOG } from '../data/actuators.js';
import { renderSensorStep, renderActuatorStep } from './mounting-view.js';
import { getBlockById } from '../data/blocks.js';
import { sessionLogger } from '../logging/session-log.js';
import { sound } from './audio.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dimensions = ['coverage','safety','time','hazard','composite'];
const names = ['Coverage','Safety','Time','Hazard Response','Weighted total'];

export class StepsView {
  constructor(panelElement,blockCanvasView,observationLogView) {
    this.panel=panelElement;this.blockCanvasView=blockCanvasView;this.observationLogView=observationLogView;
    appState.on('weightsChanged',()=>this.updateWeights());
    appState.on('tick',({scores})=>this.updateStep5LiveDashboard(scores));
    appState.on('observationAdded',()=>this.renderObservations());
    appState.on('simReset',()=>this.updateStep5LiveDashboard(window.simEngine?.scores));
    appState.on('runEnded',()=>this.updateStep5LiveDashboard(window.simEngine?.scores));
    appState.on('reflectionNeeded',data=>this.showReflection(data));
    appState.on('reflectionSelected',()=>document.getElementById('reflectionPanel')?.remove());
  }
  render() {
    if(this.panel) this[`renderStep${appState.currentStep}`]();
  }
  renderStep1() {
    this.panel.innerHTML=`<section class="v6-step"><h2>Set your robot's priorities</h2><p>All six tasks are required. Decide how much each outcome matters.</p>
      <div class="fixed-mission">${TASKS_CATALOG.map(t=>`<article><strong>${t.icon} ${t.name}</strong><span>${t.description.split(/(?<=[.!?])\s/)[0]}</span></article>`).join('')}</div>
      <div class="priority-layout"><div>${Object.entries(PEAS_DIMENSIONS).map(([key,d])=>`<label class="priority-slider">${d.name}<output id="weight-${key}">${appState.weights[key]}%</output><input type="range" min="0" max="100" step="10" list="weightStops" value="${appState.weights[key]}" data-weight="${key}" aria-label="${d.name} weight"></label>`).join('')}<datalist id="weightStops">${Array.from({length:11},(_,i)=>`<option value="${i*10}"></option>`).join('')}</datalist><div class="weight-total">Total <output id="weightTotal"></output></div><p id="weightWarning" class="weight-warning" role="status" aria-live="polite" hidden>Total exceeds 100%. Reduce the weights to continue.</p></div>
      <div class="priority-demo" id="priorityDemo" aria-label="Robot priority preview"><div class="demo-obstacle"></div><div class="demo-robot" id="priorityRobot">🤖</div><output id="priorityLabel"></output></div></div>
      <footer class="step-nav-footer"><span>Total must equal 100%.</span><button id="priorityContinue" class="btn btn-primary">Continue</button></footer></section>`;
    this.panel.querySelectorAll('[data-weight]').forEach(input=>input.oninput=()=>appState.setWeight(input.dataset.weight,input.value));
    this.panel.querySelector('#priorityContinue').onclick=()=>window.navigateStep(2);
    this.updateWeights();
  }
  updateWeights() {
    if(appState.currentStep!==1 || !this.panel?.querySelector('#weightTotal'))return;
    const sum=Object.values(appState.weights).reduce((a,b)=>a+b,0),dominant=appState.getDominantDimension();
    this.panel.querySelector('#weightTotal').textContent=`${sum}%`;
    this.panel.querySelector('#priorityContinue').disabled=sum!==100;
    this.panel.querySelector('#weightWarning').hidden=sum<=100;
    this.panel.querySelector('#weightTotal').classList.toggle('over-limit',sum>100);
    for(const [key,val] of Object.entries(appState.weights)){this.panel.querySelector(`#weight-${key}`).textContent=`${val}%`;this.panel.querySelector(`[data-weight="${key}"]`).value=String(val);}
    const demo=this.panel.querySelector('#priorityDemo');demo.dataset.priority=dominant;
    demo.classList.toggle('tradeoff',appState.weights.Time>=30 && appState.weights.Safety>=30);
    demo.style.setProperty('--priority-color',PEAS_DIMENSIONS[dominant].color);
    this.panel.querySelector('#priorityLabel').textContent=PEAS_DIMENSIONS[dominant].name;
  }
  renderStep2(){renderSensorStep(this.panel);}
  renderStep3(){renderActuatorStep(this.panel);}
  renderStep4(){this.blockCanvasView.render();}
  renderStep5() {
    if(appState.sessionFinished){if(this.finalSummary)this.showFinalSummaryModal();else this.showClosingReflection();return;}
    const engine=window.simEngine,attempted=appState.getAttemptedTaskIds().length;
    this.panel.innerHTML=`<section class="v6-step run-step"><h2>Run it</h2><p>Watch your robot. Then fix what went wrong.</p><span class="attempt-count">Your robot will attempt ${attempted} of 6 tasks.</span>
      <div class="sim-control-bar"><button class="btn btn-primary" id="simPlayBtn">Run</button><button class="btn btn-outline" id="simPauseBtn">Pause</button><button class="btn btn-outline" id="simResetBtn">Reset</button><label>Speed <select id="runSpeed"><option value="1">1x</option><option value="2">2x</option><option value="5">5x</option></select></label></div>
      <div class="v6-scores">${dimensions.map((key,i)=>`<div title="${escape(engine?.scoreDefinitions?.[key]||'')}"><span>${names[i]}</span><strong id="score-${key}">—</strong></div>`).join('')}</div>
      <div id="taskOutcomeStrip">${this.renderTaskOutcomes()}</div>
      <div class="trace-panel" id="runTrace"><div>SENSING <span>—</span></div><div>DECIDING <span>—</span></div><div>ACTING <span>—</span></div></div>
      <div class="observation-input"><input id="observationNote" maxlength="180" placeholder="Optional note" aria-label="Observation note">${['✓','✗','?'].map(s=>`<button class="btn btn-outline" data-stamp="${s}">${s}</button>`).join('')}</div><div id="singleObservationLog"></div>
      <div class="edit-actions"><button class="btn btn-outline" data-edit-step="2">Edit sensors</button><button class="btn btn-outline" data-edit-step="3">Edit body</button><button class="btn btn-outline" data-edit-step="4">Edit rules</button></div>
      <button class="btn btn-primary" id="finishSession">Finish</button></section>`;
    this.panel.querySelector('#simPlayBtn').onclick=()=>{const wasRunning=appState.simRunning;engine.start();if(!wasRunning)sound.playEvent?.('run');};
    this.panel.querySelector('#simPauseBtn').onclick=()=>engine.stop();
    this.panel.querySelector('#simResetBtn').onclick=()=>{engine.reset();document.getElementById('reflectionPanel')?.remove();this.updateStep5LiveDashboard(engine.scores);};
    this.panel.querySelector('#runSpeed').value=String(appState.simSpeed);
    this.panel.querySelector('#runSpeed').onchange=e=>engine.setSpeed(Number(e.target.value));
    this.panel.querySelectorAll('[data-stamp]').forEach(btn=>btn.onclick=()=>{const note=this.panel.querySelector('#observationNote');appState.addObservation(btn.dataset.stamp,note.value);note.value='';});
    this.panel.querySelectorAll('[data-edit-step]').forEach(btn=>btn.onclick=()=>{engine.endRun('revision');window.navigateStep(Number(btn.dataset.editStep));});
    this.panel.querySelector('#finishSession').onclick=()=>this.showClosingReflection();
    this.renderObservations();this.updateStep5LiveDashboard(engine?.scores);
    if(appState.reflectionPrompt)this.showReflection(appState.reflectionPrompt);
  }
  renderObservations(){
    const log=this.panel?.querySelector('#singleObservationLog');if(!log)return;
    log.innerHTML=appState.observationLogs.map(e=>`<div class="single-stamp"><strong>${e.stamp}</strong><time>${escape(e.timestamp)}</time><span>${escape(e.comment)}</span></div>`).reverse().join('');
  }
  updateStep5LiveDashboard(scores){
    if(!scores)return;
    for(const key of dimensions){const el=this.panel?.querySelector(`#score-${key}`);if(el)el.textContent=`${Number(scores[key]).toFixed(1)}%`;}
    const strip=this.panel?.querySelector('#taskOutcomeStrip');if(strip)strip.innerHTML=this.renderTaskOutcomes();
    const trace=this.panel?.querySelector('#runTrace'),t=window.simEngine?.lastTrace||window.simEngine?.world?.robot?.traceState;
    if(trace&&t) ['sense','decide','act'].forEach((key,i)=>{trace.children[i].querySelector('span').textContent=getBlockById(t[key]||t[{sense:'sense',decide:'condition',act:'action'}[key]])?.name||t[key]||'—';});
  }
  renderTaskOutcomes(outcomes=window.simEngine?.taskOutcomes, expanded=window.simEngine?.finalOutcomes) {
    const icons={not_started:'○',in_progress:'◷',done:'✓',failed:'✗'};
    return `<div class="task-outcome-strip">${TASKS_CATALOG.map((task,i)=>{
      const outcome=outcomes?.[i],status=outcome?.status||'not_started';
      return `<article class="task-outcome" data-task-id="${task.id}" data-status="${status}"><strong><span role="img" aria-label="${status.replace('_',' ')}">${icons[status]}</span> ${escape(task.name)}</strong><span class="task-outcome-summary" ${expanded?'':'hidden'}>${escape(outcome?.summary||'')}</span></article>`;
    }).join('')}</div>`;
  }
  showReflection(data){
    document.getElementById('reflectionPanel')?.remove();
    const panel=document.createElement('aside');panel.id='reflectionPanel';panel.className='reflection-panel';
    panel.innerHTML=`<p>Your robot just ${escape(data.behavior||'changed its performance')}. Was it behaving irrationally, or rationally with a wrong specification?</p><div>${[['sensor',"My sensor doesn't detect what I expected"],['rule','My decision rule fires at the wrong time'],['actuator',"My actuator can't do what my performance measure requires"],['weights','My performance measure weights are set incorrectly']].map(([id,label])=>`<button class="btn btn-outline" data-reflection="${id}">${label}</button>`).join('')}</div>`;
    document.body.appendChild(panel);
    panel.querySelectorAll('[data-reflection]').forEach(btn=>btn.onclick=()=>appState.selectReflection(btn.dataset.reflection));
    sound.playEvent?.('score-drop');
  }
  showClosingReflection(){
    window.simEngine?.endRun('finish');
    appState.sessionFinished=true;
    document.querySelectorAll('.step-nav-item,.modal-tab-btn').forEach(button=>{button.disabled=Number(button.dataset.step)!==5;});
    const hud=document.getElementById('simFloatingHud');if(hud)hud.hidden=true;
    document.getElementById('reflectionPanel')?.remove();
    this.panel.innerHTML=`<section class="v6-step"><h2>Reflect on your design</h2><label for="closingReflection">What did you change about your robot, and how did that affect its behavior?</label><textarea id="closingReflection" rows="5">${escape(this.closingDraft||'')}</textarea><button class="btn btn-primary" id="showSummary">Continue</button></section>`;
    this.panel.querySelector('#closingReflection').oninput=event=>{this.closingDraft=event.target.value;};
    this.panel.querySelector('#showSummary').onclick=()=>{appState.setClosingText(this.panel.querySelector('#closingReflection').value);this.finalSummary=true;this.showFinalSummaryModal();};
  }
  showFinalSummaryModal(){
    const first=appState.runHistory[0],last=appState.runHistory.at(-1),catalogNames=(set,catalog)=>[...set].map(id=>catalog.find(c=>c.id===id)?.name||id).join(', ');
    this.panel.innerHTML=`<section class="v6-step"><h2>Your robot design</h2><dl><dt>Purpose</dt><dd>${escape(appState.agentPurpose)}</dd><dt>Weights</dt><dd>${Object.entries(appState.weights).map(([k,v])=>`${k} ${v}%`).join(' · ')}</dd><dt>Sensors</dt><dd>${escape(catalogNames(appState.installedSensors,SENSORS_CATALOG))}</dd><dt>Body</dt><dd>${escape(catalogNames(appState.installedActuators,ACTUATORS_CATALOG))}</dd><dt>Tasks completed</dt><dd>${last?.tasksCompleted?.length||0} / 6</dd><dt>Revisions</dt><dd>${appState.revisitedSteps.length}</dd><dt>Steps revisited</dt><dd>${appState.revisitedSteps.join(', ')||'—'}</dd></dl><div class="summary-comparison"><span>Dimension</span><span>First run</span><span>Final run</span>${dimensions.map((k,i)=>`<span>${names[i]}</span><strong>${first?Number(first.scores[k]).toFixed(1):'—'}</strong><strong>${last?Number(last.scores[k]).toFixed(1):'—'}</strong>`).join('')}</div>${this.renderTaskOutcomes(last?.outcomes,true)}<button class="btn btn-primary" id="downloadSession">Download log</button></section>`;
    this.panel.querySelector('#downloadSession').onclick=()=>sessionLogger.exportCsv();
  }
}
