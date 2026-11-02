import { appState } from '../state.js';
import { getBlockById } from '../data/blocks.js';
import { defineBlocks, toolbox, compileWorkspace } from './structured-blocks.js';
export function acceptsBlock(slot, block) { return Boolean(block && (slot === 'secondaryAction' ? 'action' : slot.toLowerCase()) === block.kind.toLowerCase()); }
export class BlockCanvasView {
  constructor(containerElement) {
    this.container=containerElement;
    appState.on('tick',({robot})=>this.updateTracePulse(robot?.traceState));
    appState.on('stageChanged',()=>this.updateStatus());
  }
  render() {
    if(!this.container)return;
    if(this.workspace){requestAnimationFrame(()=>window.Blockly.svgResize(this.workspace));this.updateStatus();return;}
    this.container.innerHTML=`<div class="structured-editor"><header><h3>Program your robot</h3><p>Drag a Behavior onto the workspace. Snap conditions, sensors and actions inside it. Use the IF gear to add ELSE IF and ELSE; stack actions in order.</p><p>Higher execution priorities run first. Waits keep their priority. Common safety and charging apply in every mission.</p><p>Every input in AND / OR must be available. Missing or unmodeled sensors are UNKNOWN, never false; an unknown IF does not enter ELSE.</p></header><div class="blockly-host" data-i18n-skip aria-label="Nested robot program"></div><p class="program-status" aria-live="polite"></p><div class="editor-bottom"><canvas id="ruleApartmentPreview" width="480" height="360" aria-label="Live rule preview"></canvas><div class="rule-trace" aria-live="polite"><div data-trace="sense">SENSING —</div><div data-trace="decide">DECIDING —</div><div data-trace="act">ACTING —</div></div><button class="btn btn-outline preview-program">Preview program</button><button class="btn btn-primary rule-continue">Continue</button></div></div>`;
    const B=window.Blockly;defineBlocks(B);
    this.workspace=B.inject(this.container.querySelector('.blockly-host'),{toolbox:toolbox(),renderer:'zelos',media:'vendor/blockly/media/',trashcan:true,sounds:false,disable:false,scrollbars:true,move:{scrollbars:true,drag:true,wheel:true},zoom:{controls:true,wheel:true,startScale:.8},grid:{spacing:24,length:3,colour:'#d7e0eb',snap:true}});
    window.robotBlockWorkspace=this.workspace;
    if(appState.blockWorkspace)B.serialization.workspaces.load(appState.blockWorkspace,this.workspace);
    this.workspace.addChangeListener(event=>{
      if(event.isUiEvent||event.type===B.Events.FINISHED_LOADING)return;
      const {program,errors}=compileWorkspace(this.workspace);
      this.errors=errors;
      const draft=B.serialization.workspaces.save(this.workspace);
      if(!appState.setProgram(program,draft)){
        appState.setProgram([],draft);
        this.errors=['Program exceeds the supported 512 nodes or 32 nesting levels. Simplify it before running.'];
      }
      this.updateStatus();
    });
    this.container.querySelector('.rule-continue').onclick=()=>window.navigateStep?.(5);
    this.container.querySelector('.preview-program').onclick=()=>window.startRulePreview?.();
    this.updateStatus();
    new ResizeObserver(()=>B.svgResize(this.workspace)).observe(this.container.querySelector('.blockly-host'));
  }
  updateStatus(){
    if(!this.container)return;
    const status=this.container.querySelector('.program-status');
    if(status)status.textContent=this.errors?.join(' ')||'Programs remain available as you add missions. Disconnected blocks and future-mission behaviors do not execute.';
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
