import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../lib/three/three.module.js';
import {applyApartmentLayout} from '../js/view/apartment-model-layout.js';

const east=11.25,northX=1.25,northZ=-6.25,epsilon=1e-4;
const retained=p=>p.x<=east+epsilon&&(p.x<=northX+epsilon||p.z>=northZ-epsilon);

function triangleGeometry(points) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(points.flatMap(()=>[0,2,0]),3));
  geometry.setAttribute('tangent',new THREE.Float32BufferAttribute(points.flatMap(()=>[2,0,0,1]),4));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(points.flatMap(([x,,z])=>[(x-10.25)/2,z/2]),2));
  geometry.setIndex(points.map((_,i)=>i));
  return geometry;
}

function vertices(mesh) {
  mesh.updateWorldMatrix(true,false);
  const position=mesh.geometry.attributes.position,points=[];
  for(let i=0;i<position.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld));
  return points;
}

function triangleArea(mesh) {
  const points=vertices(mesh),index=mesh.geometry.index;
  let area=0;
  for(let i=0;i<(index?index.count:points.length);i+=3) {
    const a=points[index?index.getX(i):i],b=points[index?index.getX(i+1):i+1],c=points[index?index.getX(i+2):i+2];
    const value=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
    assert.ok(value>1e-10,'no degenerate output triangles');area+=value;
  }
  return area;
}

test('crossing indexed triangles preserve their materials, interpolate UVs, and normalize vectors',()=>{
  const geometry=triangleGeometry([[10.25,0,0],[12.25,0,0],[10.25,0,2],[10.25,1,0],[12.25,1,0],[10.25,1,2]]);
  geometry.addGroup(0,3,0);geometry.addGroup(3,3,1);
  const materials=[new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial()],mesh=new THREE.Mesh(geometry,materials),model=new THREE.Group();model.add(mesh);
  assert.equal(applyApartmentLayout(model),model);
  assert.equal(mesh.material,materials);assert.notEqual(mesh.geometry,geometry);
  assert.deepEqual(mesh.geometry.groups.map(group=>group.materialIndex),[0,1]);
  assert.ok(Math.abs(triangleArea(mesh)-3)<1e-4,'two independently clipped triangles each retain area 1.5');
  const points=vertices(mesh),attrs=mesh.geometry.attributes;
  assert.ok(points.every(retained));assert.ok(points.some(p=>Math.abs(p.x-east)<epsilon));
  points.forEach((point,i)=>{
    assert.ok(Math.abs(attrs.uv.getX(i)-(point.x-10.25)/2)<1e-5);
    assert.ok(Math.abs(attrs.uv.getY(i)-point.z/2)<1e-5);
    assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(attrs.normal,i).length()-1)<1e-5);
    assert.ok(Math.abs(new THREE.Vector3().fromBufferAttribute(attrs.tangent,i).length()-1)<1e-5);
    assert.equal(attrs.tangent.getW(i),1);
  });
  assert.ok(mesh.geometry.boundingBox);assert.ok(mesh.geometry.boundingSphere);
});

test('the north notch clips the actual triangle to both retained arms without overlaps',()=>{
  const mesh=new THREE.Mesh(triangleGeometry([[.25,0,-7.25],[2.25,0,-7.25],[2.25,0,-5.25]]),new THREE.MeshBasicMaterial()),model=new THREE.Group();model.add(mesh);
  applyApartmentLayout(model);
  assert.ok(vertices(mesh).every(retained));assert.ok(Math.abs(triangleArea(mesh)-1)<1e-4);
});

test('retained furniture stays unchanged and closure walls join the model at full height',()=>{
  const model=new THREE.Group(),material=new THREE.MeshBasicMaterial(),inside=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material),outside=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  inside.position.set(-3,.5,2);outside.position.set(12.5,.5,0);model.add(inside,outside);const geometry=inside.geometry;
  applyApartmentLayout(model);model.updateMatrixWorld(true);
  assert.equal(inside.geometry,geometry);assert.equal(inside.material,material);assert.equal(inside.parent,model);assert.equal(outside.parent,null);
  const walls=model.children.filter(child=>child.userData.layoutClosure);
  assert.equal(walls.length,2);assert.equal(model.userData.apartmentLayoutId,'compact-v1');
  for(const wall of walls) {
    const bounds=new THREE.Box3().setFromObject(wall);
    assert.ok(Math.abs(bounds.min.y)<1e-6);assert.ok(Math.abs(bounds.max.y-4)<1e-6);assert.equal(wall.material.map,null);
    const center=bounds.getCenter(new THREE.Vector3()),ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(-1,0,0)),new THREE.Vector3(1,0,0));
    assert.ok(ray.intersectObject(model,true).some(hit=>hit.object===wall),'camera rays see closure geometry inside the model');
  }
});

// Decode only static geometry and transforms. Textures are irrelevant to the CPU trim.
function loadActualModel() {
  const bytes=readFileSync(new URL('../assets/Apartment.glb',import.meta.url)),jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength)),binary=bytes.subarray(28+jsonLength);
  const sizes={5121:1,5123:2,5125:4,5126:4},readers={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
  function attribute(id) {
    const accessor=gltf.accessors[id],view=gltf.bufferViews[accessor.bufferView],size=sizes[accessor.componentType],count=components[accessor.type],values=[];
    for(let i=0;i<accessor.count;i++)for(let j=0;j<count;j++)values.push(binary[readers[accessor.componentType]]((view.byteOffset||0)+(accessor.byteOffset||0)+i*(view.byteStride||size*count)+j*size));
    return new THREE.Float32BufferAttribute(values,count,accessor.normalized||false);
  }
  const material=new THREE.MeshBasicMaterial(),attributeNames={POSITION:'position',NORMAL:'normal',TANGENT:'tangent',TEXCOORD_0:'uv'};
  function node(id) {
    const source=gltf.nodes[id],group=new THREE.Group();group.name=source.name||'';
    if(source.matrix){group.matrix.fromArray(source.matrix);group.matrix.decompose(group.position,group.quaternion,group.scale);}
    else {if(source.translation)group.position.fromArray(source.translation);if(source.rotation)group.quaternion.fromArray(source.rotation);if(source.scale)group.scale.fromArray(source.scale);}
    if(source.mesh!==undefined)for(const primitive of gltf.meshes[source.mesh].primitives) {
      assert.ok(primitive.mode===undefined||primitive.mode===4);const geometry=new THREE.BufferGeometry();
      for(const [key,id] of Object.entries(primitive.attributes))if(attributeNames[key])geometry.setAttribute(attributeNames[key],attribute(id));
      if(primitive.indices!==undefined)geometry.setIndex(Array.from(attribute(primitive.indices).array));
      const mesh=new THREE.Mesh(geometry,material);mesh.name=group.name;group.add(mesh);
    }
    for(const child of source.children||[])group.add(node(child));return group;
  }
  const model=new THREE.Group();for(const id of gltf.scenes[gltf.scene||0].nodes)model.add(node(id));model.updateMatrixWorld(true);return model;
}

test('the actual apartment loses only the specified annexes and keeps all remaining triangle vertices in bounds',()=>{
  const model=loadActualModel(),before=new THREE.Box3().setFromObject(model),retainedFurniture=[];
  model.traverse(mesh=>{if(mesh.isMesh&&!/^Int_(?:Apt|RR)_01_(?:Wall|Floor|Pillar)/i.test(mesh.name))retainedFurniture.push({mesh,geometry:mesh.geometry,material:mesh.material});});
  const start=performance.now();applyApartmentLayout(model);const elapsed=performance.now()-start;model.updateMatrixWorld(true);
  let count=0;model.traverse(mesh=>{if(mesh.isMesh){assert.ok(vertices(mesh).every(retained),`outside vertices remain in ${mesh.name}`);count++;}});
  const after=new THREE.Box3().setFromObject(model);
  assert.ok(before.max.x>13.7);assert.ok(after.max.x<=east+epsilon,`model bounds exceed east cut: ${after.max.x}`);assert.ok(after.min.distanceTo(before.min)<1e-4);assert.ok(after.max.y>=4);
  assert.ok(count>300,'the original primary apartment remains');
  for(const {mesh,geometry,material} of retainedFurniture){assert.ok(mesh.parent,`furniture removed: ${mesh.name}`);assert.equal(mesh.geometry,geometry,`furniture clipped: ${mesh.name}`);assert.equal(mesh.material,material);}
  for(const z of [4.5,7.5]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(10.5,2,z),new THREE.Vector3(1,0,0)),hit=ray.intersectObject(model,true)[0];
    assert.ok(hit&&hit.distance<.8,'retained solid bedroom walls close the portion below the removed east rooms');
  }
  assert.ok(elapsed<3000,`static trim took ${elapsed.toFixed(1)} ms`);
});
