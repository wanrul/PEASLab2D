import * as THREE from '../../lib/three/three.module.js';
import {APARTMENT_LAYOUT} from '../sim/apartment-layout.js';

const modelX=x=>-5+((x-130)/950)*17.5;
const modelZ=y=>-7.5+((y-90)/920)*15;
const east=modelX(APARTMENT_LAYOUT.maxX),northX=modelX(APARTMENT_LAYOUT.northCutX),northZ=modelZ(APARTMENT_LAYOUT.northCutY);
const epsilon=1e-5;

function interpolate(a,b,t) {
  return {
    point:a.point.clone().lerp(b.point,t),
    attributes:Object.fromEntries(Object.keys(a.attributes).map(name=>[name,a.attributes[name].map((value,i)=>value+(b.attributes[name][i]-value)*t)]))
  };
}

function clip(polygon,axis,limit,keepBelow) {
  const output=[],distance=vertex=>(vertex.point[axis]-limit)*(keepBelow?1:-1);
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=distance(a),db=distance(b),insideA=da<=epsilon,insideB=db<=epsilon;
    if(insideA)output.push(a);
    if(insideA!==insideB)output.push(interpolate(a,b,da/(da-db)));
  }
  return output;
}

function trimGeometry(geometry,matrix) {
  const attributes=Object.entries(geometry.attributes),output=Object.fromEntries(attributes.map(([name])=>[name,[]])),groups=[];
  const index=geometry.index,sourceGroups=geometry.groups.length?geometry.groups:[{start:0,count:index?index.count:geometry.attributes.position.count,materialIndex:0}];
  let count=0;
  function vertex(i) {
    const values=Object.fromEntries(attributes.map(([name,attribute])=>[name,Array.from({length:attribute.itemSize},(_,component)=>attribute.getComponent?attribute.getComponent(i,component):attribute[['getX','getY','getZ','getW'][component]](i))]));
    return {point:new THREE.Vector3().fromArray(values.position).applyMatrix4(matrix),attributes:values};
  }
  function emit(polygon) {
    for(let i=1;i<polygon.length-1;i++) {
      const triangle=[polygon[0],polygon[i],polygon[i+1]];
      const points=triangle.map(vertex=>new THREE.Vector3().fromArray(vertex.attributes.position.map(Math.fround)).applyMatrix4(matrix));
      if(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).lengthSq()<1e-18)continue;
      for(const vertex of triangle)for(const [name] of attributes) {
        const values=vertex.attributes[name].slice();
        if(name==='normal'||name==='tangent') {
          const length=Math.hypot(...values.slice(0,3));
          if(length>0)for(let component=0;component<3;component++)values[component]/=length;
        }
        output[name].push(...values);
      }
      count+=3;
    }
  }
  for(const group of sourceGroups) {
    const start=count;
    for(let i=group.start;i<group.start+group.count;i+=3) {
      const triangle=[0,1,2].map(offset=>vertex(index?index.getX(i+offset):i+offset)),polygon=clip(triangle,'x',east,true);
      if(polygon.length<3)continue;
      if(polygon.every(v=>v.point.x<=northX+epsilon)||polygon.every(v=>v.point.z>=northZ-epsilon))emit(polygon);
      else if(polygon.every(v=>v.point.x>=northX-epsilon))emit(clip(polygon,'z',northZ,false));
      else {
        // Partition the L-shaped floor into disjoint west and southeast pieces.
        emit(clip(polygon,'x',northX,true));
        emit(clip(clip(polygon,'x',northX,false),'z',northZ,false));
      }
    }
    if(count>start&&geometry.groups.length)groups.push({start,count:count-start,materialIndex:group.materialIndex});
  }
  const trimmed=new THREE.BufferGeometry();trimmed.name=geometry.name;
  for(const [name,attribute] of attributes)trimmed.setAttribute(name,new THREE.Float32BufferAttribute(output[name],attribute.itemSize));
  for(const group of groups)trimmed.addGroup(group.start,group.count,group.materialIndex);
  trimmed.computeBoundingBox();trimmed.computeBoundingSphere();
  return trimmed;
}

export function applyApartmentLayout(model) {
  model.updateMatrixWorld(true);
  const inverseRoot=model.matrixWorld.clone().invert(),meshes=[];
  model.traverse(child=>{if(child.isMesh)meshes.push(child);});
  for(const mesh of meshes) {
    const geometry=mesh.geometry,matrix=new THREE.Matrix4().multiplyMatrices(inverseRoot,mesh.matrixWorld);
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    const bounds=geometry.boundingBox.clone().applyMatrix4(matrix);
    if(bounds.max.x<=east+epsilon&&(bounds.max.x<=northX+epsilon||bounds.min.z>=northZ-epsilon))continue;
    const outsideEast=bounds.min.x>=east-epsilon&&bounds.max.x>east+epsilon;
    const outsideNorth=bounds.min.x>=northX-epsilon&&bounds.max.z<=northZ+epsilon&&(bounds.max.x>northX+epsilon||bounds.min.z<northZ-epsilon);
    if(outsideEast||outsideNorth){mesh.removeFromParent();continue;}
    const trimmed=trimGeometry(geometry,matrix);
    if(trimmed.attributes.position.count)mesh.geometry=trimmed;
    else mesh.removeFromParent();
  }
  const material=new THREE.MeshStandardMaterial({color:0xd8ceb9,roughness:.9,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
  APARTMENT_LAYOUT.closureWalls.forEach((wall,index)=>{
    const x0=modelX(wall.x0),x1=modelX(wall.x1),z0=modelZ(wall.y0),z1=modelZ(wall.y1);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,wall.height,z1-z0),material);
    mesh.position.set((x0+x1)/2,wall.height/2,(z0+z1)/2);
    mesh.name=index===0?'CompactApartmentClosureNorth':'CompactApartmentClosureEast';mesh.userData.layoutClosure=true;
    mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);
  });
  model.userData.apartmentLayoutId=APARTMENT_LAYOUT.id;
  model.updateMatrixWorld(true);
  return model;
}
