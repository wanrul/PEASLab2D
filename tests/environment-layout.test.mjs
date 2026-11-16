import test from 'node:test';
import assert from 'node:assert/strict';
import { ApartmentWorld } from '../js/sim/world.js';

test('dirt is spread across walkable apartment floor rather than clustered circles', () => {
  const world = new ApartmentWorld();
  const keptIds = [1,3,4,5,7,9,10,12,13,14,16].map(index => `DIRT_${index}`);
  assert.equal(world.dirtCells.length, keptIds.length);
  assert.deepEqual(world.dirtCells.map(cell => cell.id), keptIds);
  for (const cell of world.dirtCells) {
    assert.equal(world.checkCollision(cell.x,cell.y,20), false, cell.id);
    for (const other of world.dirtCells) if (cell !== other) {
      assert.ok(Math.hypot(cell.x-other.x,cell.y-other.y) >= 80, `${cell.id} and ${other.id} are too close`);
    }
    for (const spill of world.wetCells) assert.ok(Math.hypot(cell.x-spill.x,cell.y-spill.y) > spill.radius+50);
    assert.ok(Math.hypot(cell.x-world.dock.x,cell.y-world.dock.y) > 65);
  }
  const xs=world.dirtCells.map(cell=>cell.x),ys=world.dirtCells.map(cell=>cell.y);
  assert.ok(Math.max(...xs)-Math.min(...xs)>600);
  assert.ok(Math.max(...ys)-Math.min(...ys)>500);
});

test('dirt layout stays fixed across fresh worlds and test resets', () => {
  const first=new ApartmentWorld(),second=new ApartmentWorld();
  const positions=world=>world.dirtCells.map(({id,x,y})=>({id,x,y}));
  assert.deepEqual(positions(first),positions(second));
  first.dirtCells[0].cleaned=true;
  assert.equal(second.dirtCells[0].cleaned,false);
  first.reset();
  assert.deepEqual(positions(first),positions(second));
  assert.ok(first.dirtCells.every(cell=>!cell.cleaned));
});
