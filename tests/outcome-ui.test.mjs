import test from 'node:test';
import assert from 'node:assert/strict';
import { appState } from '../js/state.js';
import { SimulationEngine } from '../js/sim/engine.js';
import { ApartmentWorld } from '../js/sim/world.js';
import { StepsView } from '../js/view/steps-view.js';
import { Apartment3DMap } from '../js/view/map-3d.js';
import { HouseCanvasRenderer } from '../js/view/house-canvas.js';
import * as THREE from '../lib/three/three.module.js';

test('task strip keeps unlocked live statuses and stage end summaries remain on final summary',t=>{
  const prior=globalThis.window;const engine=new SimulationEngine(new ApartmentWorld());globalThis.window={simEngine:engine};t.after(()=>globalThis.window=prior);
  const view=Object.create(StepsView.prototype);assert.match(view.renderTaskOutcomes(),/Visited/);assert.equal((view.renderTaskOutcomes().match(/data-task-id=/g)||[]).length,4);
  engine.floorCoverageGrid=new Map([['0,0',{}]]);engine.visitedFloorCells.add('0,0');engine.movingTicks=1;engine.updateOutcomes(true);assert.match(view.renderTaskOutcomes(),/data-status="done"/);
  const old=appState.runHistory;appState.runHistory=[{stageId:1,passed:true,criteria:engine.criteriaResults,elapsedSeconds:0,outcomes:engine.taskOutcomes,tasksCompleted:['TASK_1']}];t.after(()=>appState.runHistory=old);
  view.panel={innerHTML:'',querySelector(){return {};}};view.showFinalSummaryModal();assert.match(view.panel.innerHTML,/Visited 100.0%/);
});
test('3D LED follows selected catalog color, independent of vacuum or slow flags',()=>{
  const map=Object.create(Apartment3DMap.prototype);map.world=new ApartmentWorld();map.world.robot.ledColor='rgba(239, 68, 68, 0.95)';map.world.robot.vacuumActive=true;
  map.robotGroup=new THREE.Group();map.robotLedMat=new THREE.MeshStandardMaterial();
  map.to3D=(x,y,h)=>new THREE.Vector3(x,h,y);map.dirtDecals=[];map.wetDecals=[];map.controls={update(){}};map.updateOrbitLocomotion=()=>{};map.updateInspectionObjects=()=>{};
  map.updateViewPresentation=()=>{};map.updateCompassHud=()=>{};map.update(0.1);assert.equal(map.robotLedMat.color.getHex(),0xef4444);
});
test('2D smart bin renders an opened lid after deposit',()=>{
  const renderer=Object.create(HouseCanvasRenderer.prototype);renderer.world=new ApartmentWorld();const lidEnds=[];
  const context=new Proxy({lineTo(x,y){lidEnds.push([x,y]);}},{get(target,key){return target[key]||(()=>{});}});
  const bin=renderer.world.smartBin;
  renderer.renderDestinations(context);assert.deepEqual(lidEnds,[[bin.x+18,bin.y-15]]);
  lidEnds.length=0;bin.isOpen=true;renderer.renderDestinations(context);assert.deepEqual(lidEnds,[[bin.x+18,bin.y-35]]);
});
test('3D scene omits discarded destination placeholders and retains the working charging dock',t=>{
  const prior=globalThis.window;globalThis.window={currentViewMode:'3d'};t.after(()=>globalThis.window=prior);
  const map=Object.create(Apartment3DMap.prototype);map.world=new ApartmentWorld();map.world.objects=[];map.world.inspectionTags=[];map.scene=new THREE.Scene();map.to3D=(x,y,h)=>new THREE.Vector3(x,h,y);map.viewMode='orbit';map.createInspectionObjects();
  assert.equal(map.scene.getObjectByName('smart-bin-lid'),undefined);assert.deepEqual(map.scene.children,[map.chargingDock]);map.world.smartBin.isOpen=true;map.updateInspectionObjects();assert.equal(map.world.smartBin.isOpen,true);
});
test('reset from shared simulation controls refreshes task tiles before another tick',t=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document,previousListeners=new Map([...appState.listeners].map(([key,set])=>[key,new Set(set)]));
  const engine=new SimulationEngine(new ApartmentWorld()),strip={innerHTML:''};globalThis.window={simEngine:engine};globalThis.document={getElementById(){return null;}};
  t.after(()=>{globalThis.window=previousWindow;globalThis.document=previousDocument;appState.listeners=previousListeners;});
  new StepsView({querySelector(selector){return selector==='#taskOutcomeStrip'?strip:null;}},null,null);
  engine.world.dirtCells.forEach(d=>d.cleaned=true);engine.updateOutcomes(true);strip.innerHTML='old completed run';engine.reset();assert.match(strip.innerHTML,/data-status="not_started"/);assert.doesNotMatch(strip.innerHTML,/data-status="done"/);
});
