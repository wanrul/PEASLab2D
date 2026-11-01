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

test('rule library shows one category and retains both columns after a block edit',()=>{
  const container={zone:{scrollTop:310},list:{scrollTop:160,dataset:{shelf:'Action'}},html:'',
    get innerHTML(){return this.html;},
    set innerHTML(value){this.html=value;this.zone={scrollTop:0};this.list={scrollTop:0,dataset:{shelf:'Action'}};},
    querySelector(selector){if(selector==='.task-zones-column')return this.zone;if(selector==='.palette-list')return this.list;return {};},
    querySelectorAll(){return [];}};
  const view=Object.create(BlockCanvasView.prototype);view.container=container;view.activeShelf='Action';
  view.render();
  assert.match(container.innerHTML,/role="tablist"/);
  assert.equal((container.innerHTML.match(/role="tab"/g)||[]).length,4);
  assert.match(container.innerHTML,/MOVE FORWARD/);
  assert.ok(!container.innerHTML.includes('Animal Detection Sensor'));
  assert.equal(container.zone.scrollTop,310);
  assert.equal(container.list.scrollTop,160);
});

test('dropping an action into a lower rule preserves both scroll offsets',()=>{
  const slot={dataset:{taskIndex:'5',slot:'action'},querySelector:()=>null};
  const container={zone:{scrollTop:500},list:{scrollTop:700,dataset:{shelf:'Action'}},html:'',
    get innerHTML(){return this.html;},
    set innerHTML(value){this.html=value;this.zone={scrollTop:0};this.list={scrollTop:0,dataset:{shelf:'Action'}};},
    querySelector(selector){if(selector==='.task-zones-column')return this.zone;if(selector==='.palette-list')return this.list;return {};},
    querySelectorAll(selector){return selector==='.slot-container'?[slot]:[];}};
  const view=Object.create(BlockCanvasView.prototype);view.container=container;view.activeShelf='Action';
  const previous=appState.rules[5].slots.action;
  const off=appState.on('rulesChanged',()=>view.render());
  try {
    view.render();slot.ondrop({preventDefault(){},dataTransfer:{getData:()=> 'ACT_22'}});
    assert.equal(appState.rules[5].slots.action,'ACT_22');
    assert.equal(container.zone.scrollTop,500);assert.equal(container.list.scrollTop,700);
  } finally {off();appState.rules[5].slots.action=previous;}
});
