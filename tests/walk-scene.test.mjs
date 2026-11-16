import test from 'node:test';
import assert from 'node:assert/strict';
import {openSync,readSync,closeSync} from 'node:fs';
import * as THREE from '../lib/three/three.module.js';
import {Apartment3DMap} from '../js/view/map-3d.js';
import {HouseCanvasRenderer} from '../js/view/house-canvas.js';
import {ApartmentWorld} from '../js/sim/world.js';
import {appState} from '../js/state.js';

function stateFixture(t){
  const before={...appState},oldWindow=globalThis.window;
  appState.currentStep=2;appState.isRobotPovActive=false;appState.observedEnvironmentTargets=new Set();
  globalThis.window={currentViewMode:'fps'};
  t.after(()=>{for(const key of Object.keys(appState))if(!(key in before))delete appState[key];Object.assign(appState,before);globalThis.window=oldWindow;});
}

test('an individually observed 3D label repaints green with a check and keeps following its entity',t=>{
  stateFixture(t);const oldDocument=globalThis.document,draws=[];
  const context=new Proxy({measureText:text=>({width:text.length*18}),fill(){draws.push({background:this.fillStyle});},fillText(text){draws.push({text,color:this.fillStyle});}},{get:(target,key)=>key in target?target[key]:(()=>{})});
  globalThis.document={createElement:()=>({height:0,width:0,getContext:()=>context})};t.after(()=>{globalThis.document=oldDocument;});
  const map=Object.create(Apartment3DMap.prototype),entity={id:'DIRT_1',x:200,y:300},label=map.createWorldLabel('Dirt');
  map.viewMode='fps';map.environmentObservation=true;map.environmentLabels=[{entity,kind:'dirt',targetId:'DIRT_1',height:.45,label}];
  map.updateEnvironmentLabels();
  assert.equal(label.userData.observed,false);
  assert.ok(draws.some(draw=>draw.text==='Dirt'&&draw.color==='#263c4c'));
  appState.observedEnvironmentTargets.add('DIRT_1');entity.x=260;map.updateEnvironmentLabels();
  assert.equal(label.userData.observed,true);
  assert.ok(draws.some(draw=>draw.background==='#dcfce7'));
  assert.ok(draws.some(draw=>draw.text==='✓ Dirt'&&draw.color==='#166534'));
  assert.deepEqual(label.position,map.to3D(260,300,.45));
  const paints=draws.length;map.updateEnvironmentLabels();assert.equal(draws.length,paints,'unchanged observed labels do not repaint each frame');
  map.viewMode='robot';map.updateEnvironmentLabels();assert.equal(label.visible,false);
});

test('2D labels expose each target observed status and draw its green checked caption',t=>{
  stateFixture(t);window.currentViewMode='fallback';
  const renderer=Object.create(HouseCanvasRenderer.prototype);renderer.world=new ApartmentWorld();renderer.environmentObservation=true;renderer.camera={scale:1};
  const first=renderer.world.dirtCells[0];appState.observedEnvironmentTargets.add(first.id);
  const items=renderer.getEnvironmentLabels();
  assert.equal(items.find(item=>item.targetId===first.id).observed,true);
  assert.equal(items.find(item=>item.targetId==='WET_1').observed,false);
  const draws=[],context=new Proxy({measureText:text=>({width:text.length*8}),fill(){draws.push({background:this.fillStyle});},fillText(text){draws.push({text,color:this.fillStyle});}},{get:(target,key)=>key in target?target[key]:(()=>{})});
  renderer.renderEnvironmentLabels(context);
  assert.ok(draws.some(draw=>draw.background==='#dcfce7'));
  assert.ok(draws.some(draw=>draw.text==='✓ Dirt'&&draw.color==='#166534'));
});

test('only the active Environment walking renderer can record actual proximity observations',t=>{
  stateFixture(t);const world=new ApartmentWorld();
  assert.equal(typeof appState.configureEnvironment,'function');appState.configureEnvironment(world);
  const map=Object.create(Apartment3DMap.prototype);map.world=world;map.viewMode='fps';map.environmentObservation=false;map.keys={};map.fpsYaw=0;map.fpsPitch=0;map.camera=new THREE.PerspectiveCamera();
  map.updateFpsLocomotion(0);assert.equal(appState.observedEnvironmentTargets.size,0);
  map.environmentObservation=true;window.currentViewMode='3d';map.updateFpsLocomotion(0);assert.equal(appState.observedEnvironmentTargets.size,0);
  window.currentViewMode='fps';map.updateFpsLocomotion(0);assert.equal(appState.observedEnvironmentTargets.has('PERSON'),false,'FPS cannot see the controlled person');
  appState.observedEnvironmentTargets=new Set();
  const fallback=Object.create(HouseCanvasRenderer.prototype);fallback.world=world;fallback.keys={};fallback.environmentObservation=true;fallback.headingAngle=0;fallback.walkCycle=0;
  fallback.updateAvatar();assert.equal(appState.observedEnvironmentTargets.size,0,'hidden fallback renderer cannot observe during FPS');
  window.currentViewMode='fallback';fallback.updateAvatar();assert.equal(appState.observedEnvironmentTargets.has('PERSON'),true);
});

test('water has one clear kitchen target and one clear dining target while retaining the bathroom spill',()=>{
  const world=new ApartmentWorld();
  assert.deepEqual(world.wetCells.map(({id,x,y,radius})=>({id,x,y,radius})),[
    {id:'WET_1',x:350,y:900,radius:24},{id:'WET_2',x:520,y:900,radius:20},{id:'WET_3',x:920,y:520,radius:22}
  ]);
  for(const spill of world.wetCells)assert.equal(world.checkCollision(spill.x,spill.y,Math.max(20,spill.radius)),false,spill.id);
  const fd=openSync(new URL('../assets/Apartment.glb',import.meta.url),'r'),header=Buffer.alloc(20);readSync(fd,header,0,20,0);
  const json=Buffer.alloc(header.readUInt32LE(12));readSync(fd,json,0,json.length,20);closeSync(fd);const gltf=JSON.parse(json),boxes=[];
  function visit(index,parent){
    const node=gltf.nodes[index],matrix=new THREE.Matrix4();
    if(node.matrix)matrix.fromArray(node.matrix);else matrix.compose(new THREE.Vector3().fromArray(node.translation||[0,0,0]),new THREE.Quaternion().fromArray(node.rotation||[0,0,0,1]),new THREE.Vector3().fromArray(node.scale||[1,1,1]));
    matrix.premultiply(parent);
    if(node.mesh!==undefined)for(const primitive of gltf.meshes[node.mesh].primitives){const accessor=gltf.accessors[primitive.attributes.POSITION];boxes.push({name:node.name,box:new THREE.Box3(new THREE.Vector3().fromArray(accessor.min),new THREE.Vector3().fromArray(accessor.max)).applyMatrix4(matrix)});}
    for(const child of node.children||[])visit(child,matrix);
  }
  for(const node of gltf.scenes[gltf.scene||0].nodes)visit(node,new THREE.Matrix4());
  for(const spill of world.wetCells.slice(0,2)){
    const center=Apartment3DMap.prototype.to3D(spill.x,spill.y),margin=spill.radius*.024;
    const blocked=boxes.filter(({box})=>box.max.y>.2&&box.min.y<2&&box.min.x<=center.x+margin&&box.max.x>=center.x-margin&&box.min.z<=center.z+margin&&box.max.z>=center.z-margin);
    assert.deepEqual(blocked.map(item=>item.name),[],`${spill.id}: puddle footprint lies under model furniture`);
  }
});
