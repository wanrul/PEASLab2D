import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { ApartmentWorld } from '../js/sim/world.js';
import * as baked from '../js/sim/apartment-collision-data.js';
import { buildFloorCoverageGrid } from '../js/sim/floor-coverage.js';
import { getEnvironmentTargets, hasEnvironmentLineOfSight } from '../js/data/environment.js';
const layout = await import('../js/sim/apartment-layout.js').catch(() => ({}));

for (const radius of [0, 18, 20]) {
  test(`radius ${radius}: removed north alcove and east rooms are outside the apartment`, () => {
    const world = new ApartmentWorld();
    for (const [x, y] of [[550, 90], [1100, 550], [1100, 700]]) assert.equal(world.checkCollision(x, y, radius), true);
    for (const [x, y] of [[466.5, 90], [1009, 550]]) assert.equal(world.checkCollision(x, y, radius), true, 'closure interiors are solid');
  });
}

test('shared compact layout clips floors and wall sections without modifying raw model data', () => {
  assert.equal(typeof layout.compactCollision, 'function');
  assert.equal(layout.APARTMENT_LAYOUT.id, 'compact-v1');
  const raw = baked.rawApartmentCollision;
  assert.ok(raw);
  const before = JSON.stringify(raw), compact = layout.compactCollision(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(compact.sourceSha256, raw.sourceSha256);
  for (const [x0, y0, x1, y1] of compact.floors) for (const [x, y] of [[x0, y0], [x0, y1], [x1, y0], [x1, y1]]) {
    assert.equal(layout.isRetainedPoint(x, y), true);
  }
  for (const [x0, y0, x1, y1] of compact.walls) {
    assert.equal(layout.isRetainedPoint((x0 + x1) / 2, (y0 + y1) / 2), true);
  }
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../assets/Apartment.glb', import.meta.url))).digest('hex'), raw.sourceSha256);
});

test('exposed floor boundaries omit shared tile seams and cover both closure footprints', () => {
  assert.equal(typeof layout.compactCollision, 'function');
  const compact = layout.compactCollision({ sourceSha256: 'fixture', furniture: [], floors: [[0, 0, 8, 8], [8, 0, 16, 8]], walls: [], boundaries: [] });
  assert.ok(!compact.boundaries.some(([x0, y0, x1, y1]) => x0 === 8 && x1 === 8 && y0 !== y1));
  for (const closure of layout.APARTMENT_LAYOUT.closureWalls) {
    assert.equal(closure.height, 4);
    assert.ok(baked.apartmentCollision.walls.some(([x0, y0, x1, y1]) => x0 === closure.x0 && x1 === closure.x0 && Math.min(y0, y1) <= closure.y0 && Math.max(y0, y1) >= closure.y1));
  }
});

test('removed targets are filtered with retained IDs and poses preserved, and dock is relocated explicitly', () => {
  const world = new ApartmentWorld();
  const ids = [1, 3, 4, 5, 7, 9, 10, 12, 13, 14, 16].map(i => `DIRT_${i}`);
  assert.deepEqual(world.dirtCells.map(cell => cell.id), ids);
  assert.deepEqual(world.dirtCells.find(cell => cell.id === 'DIRT_1'), { id: 'DIRT_1', x: 980, y: 1020, radius: 12, cleaned: false });
  assert.deepEqual(world.dirtCells.find(cell => cell.id === 'DIRT_16'), { id: 'DIRT_16', x: 532, y: 820, radius: 12, cleaned: false });
  assert.deepEqual(world.objects.map(object => object.id), ['TRASH_1', 'TRASH_2', 'CUP_1']);
  assert.deepEqual(world.wetCells.map(cell => cell.id), ['WET_1', 'WET_2', 'WET_3']);
  assert.equal(getEnvironmentTargets(world).length, 20);
  assert.equal(world.dock.x, 410); assert.equal(world.dock.y, 50);
  for (const target of [world.teleportMarkers.find(marker => marker.id === 'TP_DOCK'), world.inspectionTags.find(tag => tag.id === 'TAG_CHARGING_DOCK')]) {
    assert.equal(target.x, world.dock.x); assert.equal(target.y, world.dock.y);
  }
  assert.equal(world.checkCollision(world.dock.x, world.dock.y, 30), false);
});

for (const radius of [18, 20]) {
  test(`radius ${radius}: closure walls stop long moves while normal doorways remain open`, () => {
    const world = new ApartmentWorld();
    const north = world.resolveMove(430, 90, 160, 0, radius);
    const east = world.resolveMove(960, 550, 160, 0, radius);
    assert.ok(north.x <= 463.857 - radius + .001);
    assert.ok(east.x <= 1006.714 - radius + .001);
    for (const [x, y, dx, dy] of [[400, 740, 0, 70], [700, 550, 90, 0], [940, 740, 0, 100]]) {
      const end = world.resolveMove(x, y, dx, dy, radius);
      assert.ok(Math.hypot(end.x - x - dx, end.y - y - dy) < .001, `normal door at ${x},${y}`);
    }
  });

  test(`radius ${radius}: every retained target is reachable from the original robot spawn`, () => {
    const world = new ApartmentWorld(), size = 8, valid = new Map();
    for (let x = 4; x < 1200; x += size) for (let y = 4; y < 1120; y += size) {
      if (!world.checkCollision(x, y, radius)) valid.set(`${x},${y}`, { x, y });
    }
    const seed = [...valid.values()].sort((a, b) => Math.hypot(a.x - world.robot.x, a.y - world.robot.y) - Math.hypot(b.x - world.robot.x, b.y - world.robot.y))[0];
    const queue = [seed], reachable = new Set([`${seed.x},${seed.y}`]);
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i];
      for (const [dx, dy] of [[8, 0], [-8, 0], [0, 8], [0, -8]]) {
        const key = `${point.x + dx},${point.y + dy}`, next = valid.get(key);
        if (!next || reachable.has(key)) continue;
        const moved = world.resolveMove(point.x, point.y, dx, dy, radius);
        if (Math.hypot(moved.x - next.x, moved.y - next.y) > .001) continue;
        reachable.add(key); queue.push(next);
      }
    }
    for (const target of getEnvironmentTargets(world)) {
      assert.ok(queue.some(point => Math.hypot(point.x - target.entity.x, point.y - target.entity.y) < 12), target.id);
    }
  });
}

test('cleanable floor excludes removed rooms, shrinks its denominator and resets retain the compact layout', () => {
  const world = new ApartmentWorld(), floor = buildFloorCoverageGrid(world);
  assert.ok(floor.size < 8945);
  for (const point of floor.values()) assert.equal(layout.isRetainedPoint(point.x, point.y), true);
  const before = world.dirtCells.map(({ id, x, y }) => ({ id, x, y }));
  world.dirtCells[0].cleaned = true; world.reset();
  assert.deepEqual(world.dirtCells.map(({ id, x, y }) => ({ id, x, y })), before);
  assert.ok(world.dirtCells.every(cell => !cell.cleaned));
  assert.equal(hasEnvironmentLineOfSight({ x: 440, y: 90 }, { x: 500, y: 90 }), false);
});
