import test from 'node:test';
import assert from 'node:assert/strict';
const coverage = await import('../js/sim/floor-coverage.js').catch(() => ({}));

function world({width=32,height=24,radius=4,spawn={x:4,y:4},floors=[[0,0,width,height]],obstacles=[]}={}) {
  return {
    width,height,robot:{...spawn,radius},robotSpawn:{...spawn},
    checkCollision(x,y,r) {
      if(!floors.some(([left,top,right,bottom])=>x-r>=left&&x+r<=right&&y-r>=top&&y+r<=bottom))return true;
      return obstacles.some(({x:left,y:top,w,h})=>Math.hypot(x-Math.max(left,Math.min(x,left+w)),y-Math.max(top,Math.min(y,top+h)))<r);
    }
  };
}
const keys = grid => [...grid.keys()].sort();
const expected = points => points.map(([x,y])=>`${x},${y}`).sort();

test('an open 32 by 24 floor has twelve half-cell-offset samples',()=>{
  assert.equal(coverage.FLOOR_SAMPLE_SPACING,8);
  const grid=coverage.buildFloorCoverageGrid(world());
  assert.deepEqual(keys(grid),expected([[4,4],[12,4],[20,4],[28,4],[4,12],[12,12],[20,12],[28,12],[4,20],[12,20],[20,20],[28,20]]));
  assert.deepEqual(grid.get('12,20'),{x:12,y:20});
});

test('furniture interiors never count as floor even when zero-radius collision misses them',()=>{
  const fixture=world({obstacles:[{x:8,y:8,w:16,h:8}]});
  assert.equal(fixture.checkCollision(12,12,0),false);
  const grid=coverage.buildFloorCoverageGrid(fixture);
  assert.deepEqual(keys(grid),expected([[4,4],[12,4],[20,4],[28,4],[4,12],[28,12],[4,20],[12,20],[20,20],[28,20]]));
});

test('disconnected floor is excluded and the fixed spawn keeps totals stable as the robot moves',()=>{
  const fixture=world({width:56,floors:[[0,0,24,24],[32,0,56,24]]});
  const left=expected([[4,4],[12,4],[20,4],[4,12],[12,12],[20,12],[4,20],[12,20],[20,20]]);
  assert.deepEqual(keys(coverage.buildFloorCoverageGrid(fixture)),left);
  Object.assign(fixture.robot,{x:44,y:12});
  assert.deepEqual(keys(coverage.buildFloorCoverageGrid(fixture)),left);
});

test('a world without a fixed spawn starts reachability at its robot pose',()=>{
  const fixture=world({width:56,floors:[[0,0,24,24],[32,0,56,24]],spawn:{x:44,y:12}});
  delete fixture.robotSpawn;
  assert.deepEqual(keys(coverage.buildFloorCoverageGrid(fixture)),expected([[36,4],[44,4],[52,4],[36,12],[44,12],[52,12],[36,20],[44,20],[52,20]]));
});

test('cardinal reachability checks the movement segment and cannot jump a thin wall',()=>{
  const fixture=world({width:24,height:16,radius:1,obstacles:[{x:7.5,y:0,w:1,h:16}]});
  assert.equal(fixture.checkCollision(4,4,1),false);
  assert.equal(fixture.checkCollision(12,4,1),false);
  assert.deepEqual(keys(coverage.buildFloorCoverageGrid(fixture)),expected([[4,4],[4,12]]));
});

test('the cleaning footprint includes reachable floor edges beyond valid robot centers',()=>{
  const fixture=world({width:40,height:40,radius:10,spawn:{x:12,y:12}});
  const points=[];
  for(const y of [4,12,20,28,36])for(const x of [4,12,20,28,36])if(!([4,36].includes(x)&&[4,36].includes(y)))points.push([x,y]);
  const grid=coverage.buildFloorCoverageGrid(fixture);
  assert.equal(grid.size,21);
  assert.deepEqual(keys(grid),expected(points));
});

test('floor totals do not inspect tasks, dirt, entities or installed sensors',()=>{
  const fixture=world();
  for(const name of ['dirtCells','wetCells','objects','cat','avatar','selectedTasks','installedSensors'])Object.defineProperty(fixture,name,{get(){throw new Error(`Coverage inspected ${name}`);}});
  assert.equal(coverage.buildFloorCoverageGrid(fixture).size,12);
});

test('stationary cleaning marks the actual disk once without double-counting repeat passes',()=>{
  const grid=coverage.buildFloorCoverageGrid(world()),cleaned=new Set();
  coverage.recordCleanedFloor(grid,cleaned,{x:4,y:4},{x:4,y:4},8);
  assert.deepEqual([...cleaned].sort(),expected([[4,4],[12,4],[4,12]]));
  coverage.recordCleanedFloor(grid,cleaned,{x:4,y:4},{x:4,y:4},8);
  assert.equal(cleaned.size,3);
});

test('swept cleaning fills intermediate valid samples and never invents missing grid keys',()=>{
  const grid=new Map([[4,4],[12,4],[20,4],[12,12],[100,100]].map(([x,y])=>[`${x},${y}`,{x,y}])),cleaned=new Set();
  coverage.recordCleanedFloor(grid,cleaned,{x:-12,y:4},{x:36,y:4},1);
  assert.deepEqual([...cleaned].sort(),expected([[4,4],[12,4],[20,4]]));
  coverage.recordCleanedFloor(grid,cleaned,{x:4,y:4},{x:20,y:20},1);
  assert.deepEqual([...cleaned].sort(),expected([[4,4],[12,4],[20,4],[12,12]]));
});
