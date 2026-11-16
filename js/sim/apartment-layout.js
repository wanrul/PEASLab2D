export const APARTMENT_LAYOUT = Object.freeze({
  id: 'compact-v1', maxX: 1012.143, northCutX: 469.286, northCutY: 166.667,
  closureWalls: Object.freeze([
    Object.freeze({ x0: 463.857, y0: 13.333, x1: 469.286, y1: 166.667, height: 4 }),
    Object.freeze({ x0: 1006.714, y0: 320, x1: 1012.143, y1: 780, height: 4 })
  ])
});

export function isRetainedPoint(x, y) {
  return x <= APARTMENT_LAYOUT.maxX && (x <= APARTMENT_LAYOUT.northCutX || y >= APARTMENT_LAYOUT.northCutY);
}

const nonempty = rectangles => rectangles.filter(([x0, y0, x1, y1]) => x1 - x0 > 1e-8 && y1 - y0 > 1e-8);
function clipRectangle([x0, y0, x1, y1]) {
  x1 = Math.min(x1, APARTMENT_LAYOUT.maxX);
  return nonempty([
    [x0, y0, Math.min(x1, APARTMENT_LAYOUT.northCutX), y1],
    [Math.max(x0, APARTMENT_LAYOUT.northCutX), Math.max(y0, APARTMENT_LAYOUT.northCutY), x1, y1]
  ]);
}

function subtractRectangle(rectangle, cut) {
  const [x0, y0, x1, y1] = rectangle;
  const left = Math.max(x0, cut.x0), right = Math.min(x1, cut.x1);
  const top = Math.max(y0, cut.y0), bottom = Math.min(y1, cut.y1);
  if (left >= right || top >= bottom) return [rectangle];
  return nonempty([[x0, y0, x1, top], [x0, bottom, x1, y1], [x0, top, left, bottom], [right, top, x1, bottom]]);
}

function clipSegment([x0, y0, x1, y1]) {
  const dx = x1 - x0, dy = y1 - y0, splits = [0, 1];
  if (dx) for (const x of [APARTMENT_LAYOUT.maxX, APARTMENT_LAYOUT.northCutX]) {
    const t = (x - x0) / dx; if (t > 0 && t < 1) splits.push(t);
  }
  if (dy) { const t = (APARTMENT_LAYOUT.northCutY - y0) / dy; if (t > 0 && t < 1) splits.push(t); }
  splits.sort((a, b) => a - b);
  const result = [];
  for (let i = 1; i < splits.length; i++) {
    const a = splits[i - 1], b = splits[i], middle = (a + b) / 2;
    if (b - a > 1e-8 && isRetainedPoint(x0 + dx * middle, y0 + dy * middle)) result.push([x0 + dx * a, y0 + dy * a, x0 + dx * b, y0 + dy * b]);
  }
  return result;
}

function mergeSegments(segments) {
  const groups = new Map(), result = [], round = value => Math.round(value * 1000) / 1000;
  for (const [x0, y0, x1, y1] of segments) {
    const vertical = Math.abs(x1 - x0) < .01, horizontal = Math.abs(y1 - y0) < .01;
    if (!vertical && !horizontal) { result.push([x0, y0, x1, y1]); continue; }
    const fixed = round(vertical ? (x0 + x1) / 2 : (y0 + y1) / 2), key = `${vertical ? 'v' : 'h'}:${fixed}`;
    if (!groups.has(key)) groups.set(key, { vertical, fixed, spans: [] });
    groups.get(key).spans.push(vertical ? [Math.min(y0, y1), Math.max(y0, y1)] : [Math.min(x0, x1), Math.max(x0, x1)]);
  }
  for (const { vertical, fixed, spans } of groups.values()) {
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [a, b] of spans) {
      const previous = merged.at(-1);
      if (previous && a <= previous[1] + .01) previous[1] = Math.max(previous[1], b);
      else merged.push([a, b]);
    }
    for (const [a, b] of merged) result.push(vertical ? [fixed, round(a), fixed, round(b)] : [round(a), fixed, round(b), fixed]);
  }
  return result;
}

function floorBoundaries(floors) {
  const xs = [...new Set(floors.flatMap(rect => [rect[0], rect[2]]))].sort((a, b) => a - b);
  const ys = [...new Set(floors.flatMap(rect => [rect[1], rect[3]]))].sort((a, b) => a - b);
  const inside = (x, y) => floors.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const edges = [];
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < ys.length; j++) {
    const [x0, x1, y0, y1] = [xs[i - 1], xs[i], ys[j - 1], ys[j]], x = (x0 + x1) / 2, y = (y0 + y1) / 2;
    if (!inside(x, y)) continue;
    if (!inside(x0 - .01, y)) edges.push([x0, y0, x0, y1]);
    if (!inside(x1 + .01, y)) edges.push([x1, y0, x1, y1]);
    if (!inside(x, y0 - .01)) edges.push([x0, y0, x1, y0]);
    if (!inside(x, y1 + .01)) edges.push([x0, y1, x1, y1]);
  }
  return mergeSegments(edges);
}

export function compactCollision(source) {
  let floors = source.floors.flatMap(clipRectangle);
  for (const closure of APARTMENT_LAYOUT.closureWalls) floors = floors.flatMap(rect => subtractRectangle(rect, closure));
  const closures = APARTMENT_LAYOUT.closureWalls.flatMap(({ x0, y0, x1, y1 }) => [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, y0]]);
  const furniture = source.furniture.flatMap(item => clipRectangle([item.x, item.y, item.x + item.w, item.y + item.h]).map(([x0, y0, x1, y1]) => ({ ...item, x: x0, y: y0, w: x1 - x0, h: y1 - y0 })));
  return { ...source, floors, furniture, walls: mergeSegments([...source.walls.flatMap(clipSegment), ...closures]), boundaries: floorBoundaries(floors) };
}
