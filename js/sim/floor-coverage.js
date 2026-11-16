export const FLOOR_SAMPLE_SPACING = 8;
const offset = FLOOR_SAMPLE_SPACING / 2;
const keyOf = (x,y) => `${x},${y}`;

function clearSegment(world,from,to,radius) {
  const steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/2));
  for(let i=1;i<=steps;i++)if(world.checkCollision(from.x+(to.x-from.x)*i/steps,from.y+(to.y-from.y)*i/steps,radius))return false;
  return true;
}

export function buildFloorCoverageGrid(world) {
  const floor=new Map(),centers=new Map(),radius=world.robot.radius;
  const spawn=world.robotSpawn||world.robot;
  let seed,nearest=Infinity;
  for(let y=offset;y<world.height;y+=FLOOR_SAMPLE_SPACING)for(let x=offset;x<world.width;x+=FLOOR_SAMPLE_SPACING) {
    // Radius zero misses obstacle interiors because collision uses strict distances.
    if(world.checkCollision(x,y,.001))continue;
    const key=keyOf(x,y),point={x,y};
    floor.set(key,point);
    if(world.checkCollision(x,y,radius))continue;
    centers.set(key,point);
    const distance=Math.hypot(x-spawn.x,y-spawn.y);
    if(distance<nearest&&clearSegment(world,spawn,point,radius)){seed=point;nearest=distance;}
  }
  const result=new Map();
  if(!seed)return result;
  const queue=[seed],reachable=new Set([keyOf(seed.x,seed.y)]);
  const directions=[[FLOOR_SAMPLE_SPACING,0],[-FLOOR_SAMPLE_SPACING,0],[0,FLOOR_SAMPLE_SPACING],[0,-FLOOR_SAMPLE_SPACING]];
  for(let i=0;i<queue.length;i++) {
    const point=queue[i];
    for(const [dx,dy] of directions) {
      const key=keyOf(point.x+dx,point.y+dy),next=centers.get(key);
      if(!next||reachable.has(key)||!clearSegment(world,point,next,radius))continue;
      reachable.add(key);queue.push(next);
    }
    const cells=Math.floor(radius/FLOOR_SAMPLE_SPACING);
    for(let dy=-cells;dy<=cells;dy++)for(let dx=-cells;dx<=cells;dx++) {
      if((dx*dx+dy*dy)*FLOOR_SAMPLE_SPACING**2>radius*radius)continue;
      const key=keyOf(point.x+dx*FLOOR_SAMPLE_SPACING,point.y+dy*FLOOR_SAMPLE_SPACING);
      if(floor.has(key))result.set(key,floor.get(key));
    }
  }
  return result;
}

export function recordCleanedFloor(grid,cleanedSet,from,to,radius) {
  const dx=to.x-from.x,dy=to.y-from.y,lengthSquared=dx*dx+dy*dy;
  const minX=Math.ceil((Math.min(from.x,to.x)-radius-offset)/FLOOR_SAMPLE_SPACING)*FLOOR_SAMPLE_SPACING+offset;
  const minY=Math.ceil((Math.min(from.y,to.y)-radius-offset)/FLOOR_SAMPLE_SPACING)*FLOOR_SAMPLE_SPACING+offset;
  for(let y=minY;y<=Math.max(from.y,to.y)+radius;y+=FLOOR_SAMPLE_SPACING)for(let x=minX;x<=Math.max(from.x,to.x)+radius;x+=FLOOR_SAMPLE_SPACING) {
    const key=keyOf(x,y);
    if(!grid.has(key)||cleanedSet.has(key))continue;
    const t=lengthSquared?Math.max(0,Math.min(1,((x-from.x)*dx+(y-from.y)*dy)/lengthSquared)):0;
    if((x-from.x-t*dx)**2+(y-from.y-t*dy)**2<=radius*radius)cleanedSet.add(key);
  }
}
