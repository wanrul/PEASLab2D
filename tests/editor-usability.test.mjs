import test from 'node:test';
import assert from 'node:assert/strict';
import {appState} from '../js/state.js';
import {BlockCanvasView} from '../js/view/block-canvas.js';

test('priority weights use ten-percent increments, including initial values',()=>{
  const state=new appState.constructor();
  assert.equal(Object.values(state.weights).reduce((a,b)=>a+b,0),100);
  assert.ok(Object.values(state.weights).every(v=>v%10===0));
  state.setWeight('Coverage',37);assert.equal(state.weights.Coverage,40);
  state.setWeight('Coverage',104);assert.equal(state.weights.Coverage,100);
});

test('nested editor exposes the complete original library and structural blocks',async()=>{
  const {toolbox}=await import('../js/view/structured-blocks.js');
  const {ALL_BLOCKS}=await import('../js/data/blocks.js');
  const box=toolbox();const types=box.contents.flatMap(c=>c.contents.map(b=>b.type));
  for(const b of ALL_BLOCKS)assert.ok(types.includes(b.id),b.id);
  for(const type of ['PEAS_BEHAVIOR','controls_if','logic_operation','WAIT_UNTIL'])assert.ok(types.includes(type));
});
test('rerendering an existing nested workspace preserves the live workspace instead of replacing its contents',()=>{
  const oldWindow=globalThis.window,oldFrame=globalThis.requestAnimationFrame;let resized=null;
  globalThis.window={Blockly:{svgResize:w=>resized=w}};globalThis.requestAnimationFrame=f=>f();
  try{const view=Object.create(BlockCanvasView.prototype);view.workspace={scrollX:420,scrollY:170};view.container={querySelector:()=>null,set innerHTML(_){throw new Error('Workspace destroyed');}};view.render();assert.equal(resized,view.workspace);assert.equal(view.workspace.scrollX,420);assert.equal(view.workspace.scrollY,170);}finally{globalThis.window=oldWindow;globalThis.requestAnimationFrame=oldFrame;}
});
