import {scaffoldWorkspace} from './learner-blocks.js';
import { appState } from '../state.js';
import { getBlockById } from '../data/blocks.js';
import { defineBlocks, toolbox, compileWorkspace } from './structured-blocks.js';
export function acceptsBlock(slot, block) { return Boolean(block && (slot === 'secondaryAction' ? 'action' : slot.toLowerCase()) === block.kind.toLowerCase()); }
export class BlockCanvasView {
  constructor(containerElement) {
    this.container=containerElement;
    appState.on('tick',({robot})=>this.updateTracePulse(robot?.traceState));
    appState.on('stageChanged',()=>{if(this.workspace){scaffoldWorkspace(window.Blockly,this.workspace);this.compileDraft();}this.updateStatus();});
  }
  render() {
    if(!this.container)return;
    if(this.workspace){requestAnimationFrame(()=>window.Blockly.svgResize(this.workspace));this.updateStatus();return;}
    this.container.innerHTML=`<div class="structured-editor"><header><h3>Program your robot</h3><p>${this.answerPreview?'Task 1 reference: 100% patrol of the current apartment. Every block is editable.':'Fill the empty IF conditions and actions in the starter Behaviors. Change priorities, add branches or create your own Behaviors.'}</p><p>You choose directions, distances, safety thresholds and charging rules. Higher priorities win conflicting commands; movement and cleaning tools can run together.</p><p>Map, traveled path and cleaning progress are recorded automatically. No program means no movement. UNKNOWN inputs never enter ELSE.</p></header><div class="logic-board"><header class="logic-board-header"><h3>${this.answerPreview?'Decision Logic · Task 1 reference (100% patrol)':'Decision Logic'}</h3><button type="button" class="logic-board-toggle" title="Expand Logic canvas" aria-label="Expand Logic canvas" aria-controls="logicBoardDialog" aria-expanded="false">⛶</button></header><div class="blockly-host" data-i18n-skip aria-label="Nested robot program"></div></div><p class="program-status" aria-live="polite"></p><div class="editor-bottom"><canvas id="ruleApartmentPreview" width="480" height="360" aria-label="Live rule preview"></canvas><div class="rule-trace" aria-live="polite"><div data-trace="sense">SENSING —</div><div data-trace="decide">DECIDING —</div><div data-trace="act">ACTING —</div></div><button class="btn btn-outline preview-program">Preview program</button><button class="btn btn-primary rule-continue">Continue</button></div></div>`;
    this.board=this.container.querySelector('.logic-board');
    this.boardHome=this.board.parentElement;
    this.boardToggle=this.board.querySelector('.logic-board-toggle');
    this.boardToggle.onclick=()=>this.setExpanded(!this.expanded);
    const dialog=document.getElementById('logicBoardDialog');
    dialog.addEventListener('cancel',event=>{event.preventDefault();this.setExpanded(false);});
    dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.setExpanded(false);}});
    dialog.addEventListener('click',event=>{if(event.target===dialog)this.setExpanded(false);});
    const B=window.Blockly;defineBlocks(B);
    this.workspace=B.inject(this.container.querySelector('.blockly-host'),{toolbox:toolbox(),renderer:'zelos',media:'vendor/blockly/media/',trashcan:true,sounds:false,disable:false,scrollbars:true,move:{scrollbars:true,drag:true,wheel:true},zoom:{controls:true,wheel:true,startScale:.8},grid:{spacing:24,length:3,colour:'#d7e0eb',snap:true}});
    window.robotBlockWorkspace=this.workspace;
    if(appState.blockWorkspace)B.serialization.workspaces.load(appState.blockWorkspace,this.workspace);
    scaffoldWorkspace(B,this.workspace);
    this.workspace.addChangeListener(event=>{
      if(event.isUiEvent||event.type===B.Events.FINISHED_LOADING)return;
      this.compileDraft();
    });
    this.container.querySelector('.rule-continue').onclick=()=>window.navigateStep?.(6);
    this.container.querySelector('.preview-program').onclick=()=>window.startRulePreview?.();
    this.compileDraft();
    new ResizeObserver(()=>B.svgResize(this.workspace)).observe(this.container.querySelector('.blockly-host'));
  }
  compileDraft(){
    const {program,errors}=compileWorkspace(this.workspace);
    this.errors=errors;
    const draft=window.Blockly.serialization.workspaces.save(this.workspace);
    if(!appState.setProgram(program,draft)){appState.setProgram([],draft);this.errors=['Program exceeds the supported 1024 nodes or 40 nesting levels.'];}
    this.updateStatus();
  }
  setExpanded(expanded) {
    if(!this.board || Boolean(this.expanded)===expanded)return;
    const dialog=document.getElementById('logicBoardDialog');
    window.Blockly.hideChaff();
    if(expanded) {
      dialog.appendChild(this.board);
      this.blocklyLayers=[...document.querySelectorAll('.blocklyWidgetDiv,.blocklyDropDownDiv,.blocklyTooltipDiv')].map(node=>({node,parent:node.parentElement}));
      for(const {node} of this.blocklyLayers)dialog.appendChild(node);
      this.board.classList.add('expanded');
      dialog.showModal();
    } else {
      dialog.close();
      this.boardHome.insertBefore(this.board,this.container.querySelector('.program-status'));
      for(const {node,parent} of this.blocklyLayers)parent.appendChild(node);
      this.board.classList.remove('expanded');
    }
    this.expanded=expanded;
    const label=expanded?'Return to workstation':'Expand Logic canvas';
    this.boardToggle.textContent=expanded?'↙':'⛶';
    this.boardToggle.title=label;
    this.boardToggle.setAttribute('aria-label',label);
    this.boardToggle.setAttribute('aria-expanded',String(expanded));
    this.boardToggle.focus({preventScroll:true});
    requestAnimationFrame(()=>window.Blockly.svgResize(this.workspace));
  }
  updateStatus(){
    if(!this.container)return;
    const status=this.container.querySelector('.program-status');
    if(status)status.textContent=this.errors?.join(' ')||(this.answerPreview?'Task 1 reference: 100% patrol of the current apartment. Every block is editable.':'Your program carries forward. Empty or disconnected blocks do not run; no automatic navigation or answers are added.');
    const button=this.container.querySelector('.rule-continue');if(button)button.disabled=!appState.program.some(b=>appState.selectedTasks.includes(b.taskId));
  }
  updateTracePulse(traceState) {
    const trace=window.simEngine?.lastTrace||traceState||{};
    this.workspace?.highlightBlock(trace.nodeId||null);
    for(const [key,label] of [['sense','SENSING'],['decide','DECIDING'],['act','ACTING']]){
      const value=trace[key]??trace[{sense:'sense',decide:'condition',act:'action'}[key]];
      const line=this.container?.querySelector(`[data-trace="${key}"]`);
      if(line)line.textContent=`${label} ${getBlockById(value)?.name||value||'—'}`;
    }
  }
}
export { BlockCanvasView as BlockCanvasRenderer };
