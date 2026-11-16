import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../lib/three/three.module.js';
import {Apartment3DMap} from '../js/view/map-3d.js';
import {HouseCanvasRenderer} from '../js/view/house-canvas.js';
import {appState} from '../js/state.js';
import {apartmentCollision} from '../js/sim/apartment-collision-data.js';

function world(){return {
  dirtCells:[{id:'DIRT_1',x:100,y:200,radius:12,cleaned:false}],wetCells:[{id:'WET_1',x:300,y:400,radius:24,cleaned:false}],
  objects:[{id:'TRASH_1',type:'TRASH',name:'Crumpled Paper',x:120,y:220},{id:'TRASH_2',type:'TRASH',name:'Soda Can',x:160,y:240},{id:'CUP_1',type:'CUP',name:'Ceramic Mug',x:200,y:260},{id:'FOOD_1',type:'FOOD',name:'Cat Food Bowl',x:240,y:280}],
  dock:{x:400,y:500},cat:{x:500,y:600,heading:0},avatar:{x:600,y:700,heading:0},robot:{x:700,y:800,heading:0},smartBin:{x:800,y:900,isOpen:false},depositTable:{x:900,y:1000}
};}
function canvasDocument(t){
  const previous=globalThis.document;
  const context=new Proxy({measureText:text=>({width:String(text).length*19})},{get:(target,key)=>key in target?target[key]:(()=>{})});
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
  t.after(()=>{globalThis.document=previous;});
}
function scene(){
  const map=Object.create(Apartment3DMap.prototype);
  map.world=world();map.scene=new THREE.Scene();map.viewMode='orbit';map.environmentObservation=false;map.environmentLabels=[];
  map.createWorldLabel=text=>{const label=new THREE.Sprite();label.userData.environmentLabel=text;return label;};
  return map;
}
const names=['Dirt','Spill','Paper','Can','Mug','Food bowl','Charging dock','Cat','Person'];

test('3D location labels are hidden by default and identify actual world entities only in Environment',()=>{
  const map=scene(),before=JSON.stringify(map.world);
  assert.equal(typeof map.setEnvironmentObservation,'function');
  map.createEnvironmentLabels();map.updateEnvironmentLabels();
  assert.deepEqual(map.environmentLabels.map(item=>item.label.userData.environmentLabel),names);
  assert.ok(map.environmentLabels.every(item=>!item.label.visible));
  map.setEnvironmentObservation(true);
  assert.ok(map.environmentLabels.every(item=>item.label.visible));
  assert.deepEqual(map.environmentLabels[0].label.position,map.to3D(100,200,map.environmentLabels[0].height));
  map.setEnvironmentObservation(false);
  assert.ok(map.environmentLabels.every(item=>!item.label.visible));
  assert.equal(JSON.stringify(map.world),before,'display labels do not mutate robot knowledge or scene entities');
});

test('3D cat and person labels follow their live entity coordinates',()=>{
  const map=scene();map.createEnvironmentLabels();map.setEnvironmentObservation(true);
  map.world.cat.x=850;map.world.cat.y=150;map.world.avatar.x=750;map.world.avatar.y=350;
  map.updateEnvironmentLabels();
  for(const name of ['Cat','Person']){
    const item=map.environmentLabels.find(item=>item.label.userData.environmentLabel===name);
    assert.deepEqual(item.label.position,map.to3D(item.entity.x,item.entity.y,item.height));
  }
});

test('3D Environment labels disappear for cleaned, carried and sorted targets and always hide in Robot POV',()=>{
  const map=scene();map.createEnvironmentLabels();map.setEnvironmentObservation(true);
  map.world.dirtCells[0].cleaned=true;map.world.wetCells[0].cleaned=true;map.world.objects[0].carried=true;map.world.objects[1].disposed=true;map.world.objects[2].sorted=true;
  map.updateEnvironmentLabels();
  assert.deepEqual(map.environmentLabels.filter(item=>item.label.visible).map(item=>item.label.userData.environmentLabel),['Food bowl','Charging dock','Cat','Person']);
  map.viewMode='robot';map.updateEnvironmentLabels();
  assert.ok(map.environmentLabels.every(item=>!item.label.visible));
  assert.equal(map.environmentObservation,true,'POV must not overwrite the Environment observation setting');
  map.viewMode='fps';map.updateEnvironmentLabels();
  assert.equal(map.environmentLabels.at(-1).label.visible,true);
});

test('physical scene contains identifiable household items and no workstation or robot billboard decorations',t=>{
  canvasDocument(t);const map=scene();
  Object.defineProperty(map.world,'inspectionTags',{get(){throw new Error('Legacy inspection markers must not render');}});
  map.initEntities();map.createInspectionObjects();
  assert.ok(map.robotGroup.children.every(child=>!child.isSprite));
  assert.equal(map.robotGroundBeacon,undefined);assert.equal(map.robotBeam,undefined);
  assert.ok(map.scene.children.every(child=>!child.userData.isStation));
  assert.deepEqual(map.scatteredObjects.map(item=>item.kind),['Paper','Can','Mug','Food bowl']);
  const geometryTypes=map.scatteredObjects.map(item=>item.mesh.children.map(child=>child.geometry?.type));
  assert.ok(geometryTypes[0].includes('BufferGeometry'),'paper is a folded sheet');
  assert.ok(geometryTypes[1].includes('CylinderGeometry'),'can has a cylindrical body');
  assert.ok(geometryTypes[2].includes('LatheGeometry')&&geometryTypes[2].includes('TorusGeometry'),'mug has a cup and handle');
  assert.ok(geometryTypes[3].includes('LatheGeometry'),'food bowl has an open rim');
  assert.deepEqual(map.chargingDock.position,map.to3D(map.world.dock.x,map.world.dock.y,.11));
});

test('dirt uses transparent scattered texture while water has an irregular puddle shape and highlights',t=>{
  canvasDocument(t);const map=scene();map.createFloorDecals();
  assert.equal(map.dirtDecals[0].mesh.geometry.type,'PlaneGeometry');
  assert.equal(map.dirtDecals[0].mesh.material.transparent,true);
  assert.ok(map.dirtDecals[0].mesh.material.map);
  const puddle=map.wetDecals[0].mesh;
  assert.equal(puddle.children[0].geometry.type,'ShapeGeometry');
  assert.ok(puddle.children.some(child=>child.isLine),'water includes a surface highlight');
});

test('2D Environment labels follow entities, hide completed objects, and never show outside observation or during POV',t=>{
  const renderer=Object.create(HouseCanvasRenderer.prototype);renderer.world=world();renderer.environmentObservation=false;
  assert.equal(typeof renderer.setEnvironmentObservation,'function');
  assert.deepEqual(renderer.getEnvironmentLabels(),[]);
  renderer.setEnvironmentObservation(true);
  assert.deepEqual(renderer.getEnvironmentLabels().map(item=>item.text),names);
  renderer.world.cat.x=777;
  assert.equal(renderer.getEnvironmentLabels().find(item=>item.text==='Cat').entity.x,777);
  renderer.world.objects[0].carried=true;renderer.world.objects[1].disposed=true;renderer.world.dirtCells[0].cleaned=true;
  assert.deepEqual(renderer.getEnvironmentLabels().map(item=>item.text),['Spill','Mug','Food bowl','Charging dock','Cat','Person']);
  const previous=appState.isRobotPovActive;t.after(()=>{appState.isRobotPovActive=previous;});
  appState.isRobotPovActive=true;assert.deepEqual(renderer.getEnvironmentLabels(),[]);
  appState.isRobotPovActive=false;renderer.setEnvironmentObservation(false);assert.deepEqual(renderer.getEnvironmentLabels(),[]);
});

test('View whole apartment frames every real floor-bound corner inside a half-width viewport',()=>{
  for(const aspect of [.64,.72,1.44]) {
    const map=scene();map.camera=new THREE.PerspectiveCamera(48,aspect,.1,100);map.canvas={clientHeight:1000};
    map.controls={target:new THREE.Vector3(),maxDistance:35,update(){map.camera.lookAt(this.target);map.camera.updateMatrixWorld();}};
    assert.equal(typeof map.viewWholeApartment,'function');
    map.viewWholeApartment();
    for(const [x,y,x1,y1] of apartmentCollision.floors)for(const height of [0,3.2])for(const [px,py] of [[x,y],[x1,y],[x1,y1],[x,y1]]) {
      const point=map.to3D(px,py,height).project(map.camera);
      assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&point.z>-1&&point.z<1,`floor corner clipped at aspect ${aspect}: ${point.toArray()}`);
    }
    assert.ok(map.camera.position.distanceTo(map.controls.target)<=map.controls.maxDistance);
    assert.equal(map.viewMode,'orbit');assert.equal(map.controls.autoRotate,false);
  }
});

test('View whole apartment uses the loaded model bounds when they extend beyond the floor outline',()=>{
  const map=scene();map.camera=new THREE.PerspectiveCamera(48,.72,.1,100);map.canvas={clientHeight:1000};
  map.apartmentModel=new THREE.Mesh(new THREE.BoxGeometry(26,4,19));map.apartmentModel.position.set(3,2,0);
  map.controls={target:new THREE.Vector3(),maxDistance:35,update(){map.camera.lookAt(this.target);map.camera.updateMatrixWorld();}};
  map.viewWholeApartment();
  for(const x of [-10,16])for(const y of [0,4])for(const z of [-9.5,9.5]) {
    const point=new THREE.Vector3(x,y,z).project(map.camera);
    assert.ok(Math.abs(point.x)<1&&Math.abs(point.y)<1&&point.z>-1&&point.z<1);
  }
});
