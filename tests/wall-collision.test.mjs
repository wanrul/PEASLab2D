import test from 'node:test';
import assert from 'node:assert/strict';
import { ApartmentWorld } from '../js/sim/world.js';
const point = (x,z) => ({x:130+(x+5)/17.5*950,y:90+(z+7.5)/15*920});
for (const radius of [18,20]) {
  test(`radius ${radius}: model wall and concave exterior block ordinary movement`, () => {
    const world=new ApartmentWorld();
    const outside=point(4,-2);
    assert.equal(world.checkCollision(outside.x,outside.y,radius),true);
    let p=point(0,-2);
    for(let i=0;i<150;i++) p=world.resolveMove(p.x,p.y,2,0,radius);
    assert.ok(p.x < point(1.25,-2).x-radius);
  });
  test(`radius ${radius}: a large displacement cannot tunnel through a wall`, () => {
    const world=new ApartmentWorld(),p={x:950.224,y:665.533};
    // Both endpoints are free; a solid bathroom wall lies between them.
    assert.equal(world.checkCollision(p.x,575.533,radius),false);
    const result=world.resolveMove(p.x,p.y,0,-90,radius);
    assert.ok(result.y >= 620.533+radius);
  });
  test(`radius ${radius}: initial positions and teleport destinations are valid`, () => {
    const world=new ApartmentWorld();
    for(const p of [world.robot,world.avatar,world.dock,...world.teleportMarkers])
      assert.equal(world.checkCollision(p.x,p.y,radius),false,JSON.stringify(p));
  });
}

import { apartmentCollision } from '../js/sim/apartment-collision-data.js';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { HouseCanvasRenderer } from '../js/view/house-canvas.js';

test('baked collision matches the actual shipped model', () => {
  const bytes=fs.readFileSync(new URL('../assets/Apartment.glb',import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),apartmentCollision.sourceSha256);
});

for(const radius of [18,20]) {
  test(`radius ${radius}: every extracted wall and exposed floor edge blocks contact`, () => {
    const world=new ApartmentWorld();
    for(const [x0,y0,x1,y1] of [...apartmentCollision.walls,...apartmentCollision.boundaries])
      assert.equal(world.checkCollision((x0+x1)/2,(y0+y1)/2,radius),true);
  });
  test(`radius ${radius}: doorways connect living room, kitchen, dining, bedroom, bathroom and dock`, () => {
    const world=new ApartmentWorld(),size=8;
    const valid=new Set();
    for(let x=0;x<1200;x+=size) for(let y=0;y<1150;y+=size)
      if(!world.checkCollision(x,y,radius)) valid.add(`${x},${y}`);
    const seed=[...valid].sort((a,b)=>distance(a,world.robot)-distance(b,world.robot))[0];
    const queue=[seed],reachable=new Set([seed]);
    for(let i=0;i<queue.length;i++) {
      const [x,y]=queue[i].split(',').map(Number);
      for(const [dx,dy] of [[8,0],[-8,0],[0,8],[0,-8]]) {
        const key=`${x+dx},${y+dy}`;
        if(!valid.has(key)||reachable.has(key)) continue;
        const result=world.resolveMove(x,y,dx,dy,radius);
        if(Math.hypot(result.x-x-dx,result.y-y-dy)>0.001) continue;
        reachable.add(key);queue.push(key);
      }
    }
    for(const destination of [world.avatar,...world.teleportMarkers])
      assert.ok([...reachable].some(key=>distance(key,destination)<12),destination.name||'player spawn');
    function distance(key,p) {const [x,y]=key.split(',').map(Number);return Math.hypot(x-p.x,y-p.y);}
  });
}

test('teleport cannot bypass walls or place player outside; reset uses safe robot spawn', () => {
  const world=new ApartmentWorld(),renderer=Object.create(HouseCanvasRenderer.prototype);
  renderer.world=world;
  const before={x:world.avatar.x,y:world.avatar.y};
  const outside=point(4,-2);
  renderer.teleportAvatar(outside.x,outside.y);
  assert.equal(world.avatar.x,before.x);
  assert.equal(world.avatar.y,before.y);
  world.robot.x=outside.x;world.robot.y=outside.y;world.reset();
  assert.equal(world.checkCollision(world.robot.x,world.robot.y,world.robot.radius),false);
});
