// Bake floor coverage and horizontal wall sections from the shipped GLB.
// Run from PEASLab2D with: node scripts/extract-apartment-collision.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../lib/three/three.module.js';
const source = new URL('../assets/Apartment.glb', import.meta.url);
const bytes = fs.readFileSync(source);
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength);
const round = value => Math.round(value * 1000) / 1000;
const project = v => [round(130 + (v.x + 5) / 17.5 * 950), round(90 + (v.z + 7.5) / 15 * 920)];
const floors = [], walls = [], furniture = [];
const furnitureNames = new Set(['Sofa_Apt_02','Table_Coffee_01','Table_Media_01','Table_Computer_01_Setup','Table_Dining_Apt_01_Setup','Bed_Apt_01_02','BathTub','BR_Cabinet_01','Counter_01','Counter_02','Counter_Sink_01','Fridge_01']);
function furnitureBounds(index, matrix) {
  const node = gltf.nodes[index], box = new T.Box3();
  if (node.mesh !== undefined) for (const p of gltf.meshes[node.mesh].primitives) {
    const a = gltf.accessors[p.attributes.POSITION];
    box.union(new T.Box3(new T.Vector3().fromArray(a.min),new T.Vector3().fromArray(a.max)).applyMatrix4(matrix));
  }
  for (const child of node.children || []) {
    const n=gltf.nodes[child],local=new T.Matrix4();
    if(n.matrix)local.fromArray(n.matrix);
    else local.compose(new T.Vector3().fromArray(n.translation||[0,0,0]),new T.Quaternion().fromArray(n.rotation||[0,0,0,1]),new T.Vector3().fromArray(n.scale||[1,1,1]));
    box.union(furnitureBounds(child,matrix.clone().multiply(local)));
  }
  return box;
}
function accessor(index, item) {
  const a = gltf.accessors[index], view = gltf.bufferViews[a.bufferView];
  const size = {5121:1,5123:2,5125:4,5126:4}[a.componentType];
  const count = a.type === 'VEC3' ? 3 : 1;
  const offset = (view.byteOffset || 0) + (a.byteOffset || 0) + item * (view.byteStride || size * count);
  const read = {5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
  return Array.from({length:count}, (_, i) => binary[read](offset + i * size));
}
function visit(index, parent) {
  const node = gltf.nodes[index], matrix = new T.Matrix4();
  if (node.matrix) matrix.fromArray(node.matrix);
  else matrix.compose(new T.Vector3().fromArray(node.translation || [0,0,0]), new T.Quaternion().fromArray(node.rotation || [0,0,0,1]), new T.Vector3().fromArray(node.scale || [1,1,1]));
  matrix.premultiply(parent);
  if (furnitureNames.has(node.name)) {
    const box = furnitureBounds(index,matrix);
    if (!box.isEmpty()) {
      const [x,y] = project(box.min),[x1,y1] = project(box.max);
      furniture.push({name:node.name,x,y,w:round(x1-x),h:round(y1-y),type:'furniture'});
    }
  }
  if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
    const a = gltf.accessors[primitive.attributes.POSITION];
    if (/^Int_(apt|RR)_01_Floor_01/i.test(node.name)) {
      const box = new T.Box3(new T.Vector3().fromArray(a.min), new T.Vector3().fromArray(a.max)).applyMatrix4(matrix);
      floors.push([...project(box.min), ...project(box.max)]);
    }
    if (!/^Int_Apt_01_Wall_/i.test(node.name)) continue;
    const count = primitive.indices === undefined ? a.count : gltf.accessors[primitive.indices].count;
    for (let i = 0; i < count; i += 3) {
      const triangle = [0,1,2].map(j => new T.Vector3().fromArray(accessor(primitive.attributes.POSITION, primitive.indices === undefined ? i+j : accessor(primitive.indices,i+j)[0])).applyMatrix4(matrix));
      // Sections at robot and player body height preserve real doorway gaps.
      for (const height of [0.35, 1.0]) {
        const hits = [];
        for (let j = 0; j < 3; j++) {
          const p = triangle[j], q = triangle[(j+1)%3];
          if ((p.y <= height && q.y > height) || (q.y <= height && p.y > height)) hits.push(p.clone().lerp(q, (height-p.y)/(q.y-p.y)));
        }
        if (hits.length === 2) {
          const segment = [...project(hits[0]), ...project(hits[1])];
          if (Math.hypot(segment[2]-segment[0],segment[3]-segment[1]) > 0.001) walls.push(segment);
        }
      }
    }
  }
  for (const child of node.children || []) visit(child, matrix);
}
for (const root of gltf.scenes[gltf.scene || 0].nodes) visit(root, new T.Matrix4());
// Only exposed tile edges are boundaries; shared floor seams stay walkable.
const xs = [...new Set(floors.flatMap(r => [r[0],r[2]]))].sort((a,b)=>a-b);
const ys = [...new Set(floors.flatMap(r => [r[1],r[3]]))].sort((a,b)=>a-b);
const inside = (x,y) => floors.some(r => x>=r[0] && x<=r[2] && y>=r[1] && y<=r[3]);
const boundaries = [];
for (let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++) {
  const [x0,x1,y0,y1]=[xs[i],xs[i+1],ys[j],ys[j+1]], x=(x0+x1)/2,y=(y0+y1)/2;
  if (!inside(x,y)) continue;
  if (!inside(x0-0.01,y)) boundaries.push([x0,y0,x0,y1]);
  if (!inside(x1+0.01,y)) boundaries.push([x1,y0,x1,y1]);
  if (!inside(x,y0-0.01)) boundaries.push([x0,y0,x1,y0]);
  if (!inside(x,y1+0.01)) boundaries.push([x0,y1,x1,y1]);
}
const unique = rows => [...new Map(rows.map(r=>[JSON.stringify(r),r])).values()];
// Merge collinear sections from adjacent triangles to keep runtime checks small.
function mergeSegments(rows) {
  const groups = new Map(), other = [];
  for (const [x0,y0,x1,y1] of rows) {
    const vertical = Math.abs(x1-x0) < 0.01, horizontal = Math.abs(y1-y0) < 0.01;
    if (!vertical && !horizontal) { other.push([x0,y0,x1,y1]); continue; }
    const fixed = round(vertical ? (x0+x1)/2 : (y0+y1)/2);
    const key = `${vertical?'v':'h'}:${fixed}`;
    if (!groups.has(key)) groups.set(key, {vertical,fixed,spans:[]});
    groups.get(key).spans.push(vertical ? [Math.min(y0,y1),Math.max(y0,y1)] : [Math.min(x0,x1),Math.max(x0,x1)]);
  }
  for (const {vertical,fixed,spans} of groups.values()) {
    spans.sort((a,b)=>a[0]-b[0]);
    const merged=[];
    for(const span of spans) {
      const previous=merged.at(-1);
      if(previous && span[0]<=previous[1]+0.01) previous[1]=Math.max(previous[1],span[1]);
      else merged.push([...span]);
    }
    for(const [a,b] of merged) other.push(vertical?[fixed,a,fixed,b]:[a,fixed,b,fixed]);
  }
  return other;
}
const data = {sourceSha256:crypto.createHash('sha256').update(bytes).digest('hex'),furniture,floors:unique(floors),walls:mergeSegments(unique(walls)),boundaries:mergeSegments(unique(boundaries))};
fs.writeFileSync(new URL('../js/sim/apartment-collision-data.js', import.meta.url), '// Generated from assets/Apartment.glb by scripts/extract-apartment-collision.mjs.\nexport const apartmentCollision = '+JSON.stringify(data)+';\n');
console.log({floors:data.floors.length,walls:data.walls.length,boundaries:data.boundaries.length});
