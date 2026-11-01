import test from 'node:test';
import assert from 'node:assert/strict';
import {ApartmentWorld} from '../js/sim/world.js';
for(const radius of [18,20]) {
  test(`radius ${radius}: empty living-room aisle is not blocked by old sofa footprint`,()=>{
    const w=new ApartmentWorld();
    assert.equal(w.checkCollision(250,250,radius),false);
    let p={x:230,y:220};
    for(let i=0;i<40;i++)p=w.resolveMove(p.x,p.y,0,2,radius);
    assert.ok(p.y>290);
    for(let i=0;i<40;i++)p=w.resolveMove(p.x,p.y,0,-2,radius);
    assert.ok(Math.abs(p.y-220)<0.001);
  });
  test(`radius ${radius}: actual model sofa blocks movement`,()=>{
    const w=new ApartmentWorld();
    assert.equal(w.checkCollision(140,355,radius),true);
  });
}

import {Apartment3DMap} from '../js/view/map-3d.js';
import * as THREE from '../lib/three/three.module.js';
test('2D background projection maps model floor points to the same pixels as collision data',t=>{
  const oldDocument=globalThis.document;
  const canvas={getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})};
  globalThis.document={createElement:()=>canvas};
  t.after(()=>{globalThis.document=oldDocument;});
  const map=Object.create(Apartment3DMap.prototype);
  map.world={width:1326,height:1220};
  map.apartmentModel={visible:true};
  const actor={visible:true},hiddenActor={visible:false},light={visible:true,isLight:true};
  map.scene={children:[map.apartmentModel,actor,hiddenActor,light],background:'original'};
  let camera;
  map.renderer={getRenderTarget:()=>null,setRenderTarget(){},readRenderTargetPixels(){},render(scene,c){
    assert.equal(actor.visible,false);
    assert.equal(light.visible,true);
    c.updateMatrixWorld();camera=c;
  }};
  const image=map.createMapImage();
  assert.equal(image.width,1326);
  assert.equal(image.height,1220);
  for(const [x,y] of [[0,0],[1326,1220],[230,250],[140,355],[950,575]]) {
    const p=map.to3D(x,y,0).project(camera);
    assert.ok(Math.abs((p.x+1)/2*1326-x)<1e-6);
    assert.ok(Math.abs((1-p.y)/2*1220-y)<1e-6);
  }
  assert.equal(actor.visible,true);
  assert.equal(hiddenActor.visible,false);
  assert.equal(map.scene.background,'original');
});

test('round player/robot footprint can pass furniture corners without a square invisible margin',()=>{
  const w=new ApartmentWorld();
  w.obstacles=[{x:270,y:270,w:20,h:20}];
  assert.equal(w.checkCollision(255,255,20),false);
  assert.equal(w.checkCollision(260,260,20),true);
});
