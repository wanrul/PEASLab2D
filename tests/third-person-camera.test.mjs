import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three/three.module.js';
import {Apartment3DMap} from '../js/view/map-3d.js';
import {ApartmentWorld} from '../js/sim/world.js';

function map(){
  const m=Object.create(Apartment3DMap.prototype);
  m.world={avatar:{x:400,y:500,heading:0,speed:3.8,radius:18,targetX:null,targetY:null},robot:{x:480,y:320,heading:0}};
  m.camera=new THREE.PerspectiveCamera(48,1.5,.1,100);m.canvas={clientHeight:900};m.avatarGroup=new THREE.Group();m.robotGroup=new THREE.Group();
  m.controls={target:new THREE.Vector3(),enabled:true,autoRotate:true,maxDistance:35};m.viewMode='orbit';m.environmentLabels=[];m.environmentObservation=false;m.keys={};m.fpsYaw=0;m.fpsPitch=0;
  m.isFollowingRobot=true;m.isAutoSpinning=true;
  return m;
}

test('third-person entry shows the existing player avatar with a natural rear camera and releases orbit following',()=>{
  const m=map(),avatar=m.avatarGroup;m.setViewMode('thirdPerson');
  const pivot=m.to3D(m.world.avatar.x,m.world.avatar.y,1.1);
  assert.equal(m.avatarGroup,avatar);assert.equal(avatar.visible,true);
  assert.equal(m.camera.fov,68);assert.equal(m.controls.enabled,false);assert.equal(m.controls.autoRotate,false);
  assert.equal(m.isFollowingRobot,false);assert.equal(m.isAutoSpinning,false);
  assert.ok(Math.abs(m.camera.position.x-(pivot.x-3))<1e-10);
  assert.ok(Math.abs(m.camera.position.y-2.2)<1e-10);
  assert.ok(Math.abs(m.camera.position.z-pivot.z)<1e-10);
  const direction=m.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(direction.dot(pivot.clone().sub(m.camera.position).normalize())>.9999);
});

test('third-person camera follows avatar displacement and shared look angles rotate the boom',()=>{
  const m=map();m.setViewMode('thirdPerson');
  const before=m.camera.position.clone(),oldAvatar=m.to3D(m.world.avatar.x,m.world.avatar.y,0);
  m.world.avatar.x+=120;m.world.avatar.y+=40;m.updateThirdPersonCamera();
  const displacement=m.to3D(m.world.avatar.x,m.world.avatar.y,0).sub(oldAvatar);
  assert.ok(m.camera.position.clone().sub(before).distanceTo(displacement)<1e-10);
  m.fpsYaw=0;m.fpsPitch=0;m.updateThirdPersonCamera();
  const pivot=m.to3D(m.world.avatar.x,m.world.avatar.y,1.1);
  assert.ok(Math.abs(m.camera.position.x-pivot.x)<1e-10);assert.ok(m.camera.position.z<pivot.z-2.9);
  const level=m.camera.position.y;m.fpsPitch=.4;m.updateThirdPersonCamera();assert.ok(m.camera.position.y<level);
});

test('the camera boom stops before actual model wall or furniture geometry',()=>{
  const m=map();m.viewMode='thirdPerson';m.fpsYaw=0;
  const pivot=m.to3D(m.world.avatar.x,m.world.avatar.y,1.1),group=new THREE.Group();
  const obstruction=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2),new THREE.MeshBasicMaterial());
  obstruction.position.copy(pivot).add(new THREE.Vector3(0,.6,-1.5));group.add(obstruction);group.updateMatrixWorld(true);m.apartmentModel=group;
  assert.equal(typeof m.updateThirdPersonCamera,'function');m.updateThirdPersonCamera();
  const bounds=new THREE.Box3().setFromObject(obstruction);
  assert.equal(bounds.containsPoint(m.camera.position),false);
  assert.ok(m.camera.position.z>bounds.max.z+.1,'camera stays on the player side of the obstacle');
  assert.ok(m.camera.position.distanceTo(pivot)<2,'blocked boom shortens instead of passing through the model');
});

test('a nearby rear wall selects a clear higher camera instead of placing the camera inside the player',()=>{
  const m=map();m.viewMode='thirdPerson';m.fpsYaw=0;m.camera.fov=68;m.camera.updateProjectionMatrix();m.scene=new THREE.Scene();m.create3DAvatar();
  m.avatarGroup.position.copy(m.to3D(m.world.avatar.x,m.world.avatar.y,.1));
  const pivot=m.to3D(m.world.avatar.x,m.world.avatar.y,1.1),wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,.2),new THREE.MeshBasicMaterial());
  wall.position.copy(pivot).add(new THREE.Vector3(0,.6,-.5));m.apartmentModel=new THREE.Group();m.apartmentModel.add(wall);
  m.updateThirdPersonCamera();m.camera.updateMatrixWorld();
  const body=new THREE.Box3().setFromObject(m.avatarGroup),obstacle=new THREE.Box3().setFromObject(wall),projected=[];
  assert.equal(body.containsPoint(m.camera.position),false);assert.equal(obstacle.containsPoint(m.camera.position),false);
  assert.ok(m.camera.position.y>2.4,'close walls use the higher camera');
  for(const x of [body.min.x,body.max.x])for(const y of [body.min.y,body.max.y])for(const z of [body.min.z,body.max.z]) {
    const p=new THREE.Vector3(x,y,z).project(m.camera);projected.push(p);
    assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1,'the entire existing avatar fits within view');
  }
  assert.ok((Math.max(...projected.map(p=>p.y))-Math.min(...projected.map(p=>p.y)))/2<.7,'the avatar does not fill the viewport');
});

test('FPS and third-person walking use the same collision-safe player movement',()=>{
  const fps=map(),third=map();fps.world=new ApartmentWorld();third.world=new ApartmentWorld();
  for(const m of [fps,third]){Object.assign(m.world.avatar,{x:250,y:250,targetX:null,targetY:null});m.fpsYaw=-Math.PI/2;m.keys={w:true};}
  fps.viewMode='fps';third.viewMode='thirdPerson';
  for(let i=0;i<150;i++){fps.updateFpsLocomotion(1/60);third.updateFpsLocomotion(1/60);}
  assert.deepEqual({x:third.world.avatar.x,y:third.world.avatar.y},{x:fps.world.avatar.x,y:fps.world.avatar.y});
  assert.equal(third.world.checkCollision(third.world.avatar.x,third.world.avatar.y,third.world.avatar.radius),false);
  assert.ok(250-third.world.avatar.x<150*third.world.avatar.speed,'the wall blocks continued walking');
  assert.ok(third.camera.position.distanceTo(third.to3D(third.world.avatar.x,third.world.avatar.y,1.1))>2);
});

test('third-person mouse drag changes shared yaw/pitch and clicks do not assign floor paths',t=>{
  const m=map(),canvasEvents={},windowEvents={},oldWindow=globalThis.window,oldDocument=globalThis.document;
  m.canvas={clientHeight:900,addEventListener(name,fn){canvasEvents[name]=fn;},getBoundingClientRect:()=>({left:0,top:0,width:1000,height:900})};m.mouse=new THREE.Vector2();m.raycaster=new THREE.Raycaster();
  globalThis.window={addEventListener(name,fn){windowEvents[name]=fn;}};globalThis.document={getElementById:()=>null};
  t.after(()=>{globalThis.window=oldWindow;globalThis.document=oldDocument;});
  m.setViewMode('thirdPerson');m.bindEvents();
  canvasEvents.mousedown({clientX:100,clientY:100});const yaw=m.fpsYaw;
  canvasEvents.mousemove({clientX:120,clientY:110});
  assert.ok(Math.abs(m.fpsYaw-(yaw-.08))<1e-10);assert.ok(Math.abs(m.fpsPitch+.04)<1e-10);
  canvasEvents.click({clientX:120,clientY:110});assert.equal(m.world.avatar.targetX,null);assert.equal(m.world.avatar.targetY,null);
});

test('Robot POV restores the exact third-person camera and shared look angles',()=>{
  const m=map();m.setViewMode('thirdPerson');m.fpsYaw=.9;m.fpsPitch=-.2;m.updateThirdPersonCamera();
  const saved=m.captureViewState(),position=m.camera.position.clone(),quaternion=m.camera.quaternion.clone();
  m.setViewMode('robot');m.fpsYaw=0;m.fpsPitch=0;m.restoreViewState(saved);
  assert.equal(m.viewMode,'thirdPerson');assert.equal(m.camera.fov,68);assert.equal(m.avatarGroup.visible,true);assert.equal(m.controls.enabled,false);
  assert.deepEqual(m.camera.position,position);assert.deepEqual(m.camera.quaternion.toArray(),quaternion.toArray());
  assert.equal(m.fpsYaw,.9);assert.equal(m.fpsPitch,-.2);
});

test('FPS keeps its original first-person body visibility, field of view and eye position',()=>{
  const m=map();m.setViewMode('fps');
  assert.equal(m.camera.fov,78);assert.equal(m.avatarGroup.visible,false);
  assert.deepEqual(m.camera.position,m.to3D(m.world.avatar.x,m.world.avatar.y,1.65));
});

test('observed label repaint preserves the canvas dimensions used by its uploaded GPU texture',t=>{
  const previous=globalThis.document,context=new Proxy({measureText:text=>({width:text.length*18})},{get:(target,key)=>key in target?target[key]:(()=>{})});
  const canvas={width:0,height:0,getContext:()=>context};globalThis.document={createElement:()=>canvas};t.after(()=>{globalThis.document=previous;});
  const label=map().createWorldLabel('Person'),dimensions=[canvas.width,canvas.height],texture=label.material.map;
  label.userData.setObserved(true);
  assert.deepEqual([canvas.width,canvas.height],dimensions,'adding the check must not resize immutable WebGL texture storage');
  label.userData.setObserved(false);label.userData.repaintLabel();
  assert.deepEqual([canvas.width,canvas.height],dimensions);
  assert.equal(label.material.map,texture);
});
