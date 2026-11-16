import { apartmentCollision } from '../sim/apartment-collision-data.js';

export const ENVIRONMENT_ITEMS = Object.freeze([
  { id: 'dirt', label: 'Dirt', description: 'Dry dirt and crumbs are spread across the apartment floor.' },
  { id: 'spills', label: 'Spills', description: 'Notice where liquid has spilled onto the floor.' },
  { id: 'objects', label: 'Objects', description: 'Look for paper, cans and mugs.' },
  { id: 'dock', label: 'Charging dock', description: 'Find where the robot can return to charge.' },
  { id: 'cat', label: 'Cat', description: 'The cat moves through the apartment.' },
  { id: 'person', label: 'Person', description: 'Use Third person to see the person you control.' }
].map(item => Object.freeze(item)));

const observationWalls = [...apartmentCollision.walls, ...apartmentCollision.boundaries];
export const ENVIRONMENT_OBSERVATION_RADIUS = 80;

export function getEnvironmentTargets(world) {
  return [
    ...world.dirtCells.map(entity => ({ id: entity.id, category: 'dirt', entity })),
    ...world.wetCells.map(entity => ({ id: entity.id, category: 'spills', entity })),
    ...world.objects.map(entity => ({ id: entity.id, category: 'objects', entity })),
    { id: 'DOCK', category: 'dock', entity: world.dock },
    { id: 'CAT', category: 'cat', entity: world.cat },
    { id: 'PERSON', category: 'person', entity: world.avatar }
  ];
}

export function hasEnvironmentLineOfSight(from, to, walls = observationWalls) {
  if (from.x === to.x && from.y === to.y) return true;
  const cross = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  for (const [x0, y0, x1, y1] of walls) {
    if (Math.max(from.x, to.x) < Math.min(x0, x1) || Math.min(from.x, to.x) > Math.max(x0, x1) ||
        Math.max(from.y, to.y) < Math.min(y0, y1) || Math.min(from.y, to.y) > Math.max(y0, y1)) continue;
    if (cross(from.x, from.y, to.x, to.y, x0, y0) * cross(from.x, from.y, to.x, to.y, x1, y1) <= 0 &&
        cross(x0, y0, x1, y1, from.x, from.y) * cross(x0, y0, x1, y1, to.x, to.y) <= 0) return false;
  }
  return true;
}
