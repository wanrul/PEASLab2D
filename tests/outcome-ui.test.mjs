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
  const view=Object.create(StepsView.prototype);assert.match(view.renderTaskOutcomes(),/Never vacuumed/);assert.equal((view.renderTaskOutcomes().match(/data-task-id=/g)||[]).length,1);
  engine.world.dirtCells.forEach(d=>d.cleaned=true);engine.vacuumTicks=1;engine.updateOutcomes(true);assert.match(view.renderTaskOutcomes(),/data-status="done"/);
  const old=appState.runHistory;appState.runHistory=[{stageId:1,passed:true,criteria:engine.criteriaResults,elapsedSeconds:0,outcomes:engine.taskOutcomes,tasksCompleted:['TASK_1']}];t.after(()=>appState.runHistory=old);
  view.panel={innerHTML:'',querySelector(){return {};}};view.showFinalSummaryModal();assert.match(view.panel.innerHTML,/Cleaned 17 of 17 dirty cells/);
});
test('3D LED follows selected catalog color, independent of vacuum or slow flags',()=>{
  const map=Object.create(Apartment3DMap.prototype);map.world=new ApartmentWorld();map.world.robot.ledColor='rgba(239, 68, 68, 0.95)';map.world.robot.vacuumActive=true;
  map.robotGroup=new THREE.Group();map.robotLedMat=new THREE.MeshStandardMaterial();map.robotGroundMat=new THREE.MeshBasicMaterial();map.robotBeamMat=new THREE.MeshBasicMaterial();
  map.to3D=(x,y,h)=>new THREE.Vector3(x,h,y);map.updateRobotActionSprite=()=>{};map.dirtDecals=[];map.wetDecals=[];map.stationObjects=[];map.controls={update(){}};map.updateOrbitLocomotion=()=>{};map.updateInspectionObjects=()=>{};
  map.updateViewPresentation=()=>{};map.updateCompassHud=()=>{};map.update(0.1);assert.equal(map.robotLedMat.color.getHex(),0xef4444);
});
test('2D smart bin renders an opened lid after deposit',()=>{
  const renderer=Object.create(HouseCanvasRenderer.prototype);renderer.world=new ApartmentWorld();const lines=[];
  const context=new Proxy({fillText(text){lines.push(text);}},{get(target,key){return target[key]||(()=>{});}});
  renderer.renderDestinations(context);assert.ok(lines.includes('Bin'));
  renderer.world.smartBin.isOpen=true;renderer.renderDestinations(context);assert.ok(lines.includes('Bin · lid open'));
});
test('3D bin lid opens from the same world deposit state',t=>{
  const prior=globalThis.window;globalThis.window={currentViewMode:'3d'};t.after(()=>globalThis.window=prior);
  const map=Object.create(Apartment3DMap.prototype);map.world=new ApartmentWorld();map.world.objects=[];map.world.inspectionTags=[];map.scene=new THREE.Scene();map.to3D=(x,y,h)=>new THREE.Vector3(x,h,y);map.viewMode='orbit';map.createInspectionObjects();
  const lid=map.scene.getObjectByName('smart-bin-lid');assert.ok(lid);map.world.smartBin.isOpen=true;map.updateInspectionObjects();assert.ok(Math.abs(lid.rotation.x)>1);
});
test('reset from shared simulation controls refreshes task tiles before another tick',t=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document,previousListeners=new Map([...appState.listeners].map(([key,set])=>[key,new Set(set)]));
  const engine=new SimulationEngine(new ApartmentWorld()),strip={innerHTML:''};globalThis.window={simEngine:engine};globalThis.document={getElementById(){return null;}};
  t.after(()=>{globalThis.window=previousWindow;globalThis.document=previousDocument;appState.listeners=previousListeners;});
  new StepsView({querySelector(selector){return selector==='#taskOutcomeStrip'?strip:null;}},null,null);
  engine.world.dirtCells.forEach(d=>d.cleaned=true);engine.updateOutcomes(true);strip.innerHTML='old completed run';engine.reset();assert.match(strip.innerHTML,/data-status="not_started"/);assert.doesNotMatch(strip.innerHTML,/data-status="done"/);
});
