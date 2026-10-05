const test = require('node:test');
const assert = require('node:assert/strict');
const { WindFlow, SegmentIndex, segmentDistanceSquared } = require('./flow.js');

function random(seed = 83) {
  return (a, b) => {
    seed = seed * 16807 % 2147483647;
    return a + seed / 2147483647 * (b - a);
  };
}
const defaults = { length: 240, density: 1 };

function verifySeparation(flow) {
  const segments = flow.strands.flatMap(s => s.segments);
  for (let i = 0; i < segments.length; i++) {
    const a = segments[i];
    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j];
      if (a.owner === b.owner && Math.abs(a.ordinal - b.ordinal) <= 2) continue;
      assert.ok(segmentDistanceSquared(a.a, a.b, b.a, b.b) >= flow.index.clearance ** 2 - 1e-8,
        `Paths ${a.owner}/${a.ordinal} and ${b.owner}/${b.ordinal} are too close`);
    }
  }
  for (const strand of flow.strands) {
    const visible = flow.visiblePoints(strand);
    for (const point of visible) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(strand.tail <= strand.head && strand.head <= strand.total);
  }
}

test('collision geometry catches crossings, touching, parallel overlap and short segments', () => {
  const a = { x: 0, y: 0 }, b = { x: 10, y: 0 };
  assert.equal(segmentDistanceSquared(a, b, { x: 5, y: -5 }, { x: 5, y: 5 }), 0);
  assert.equal(segmentDistanceSquared(a, b, b, { x: 20, y: 0 }), 0);
  assert.equal(segmentDistanceSquared(a, b, { x: 5, y: 0 }, { x: 15, y: 0 }), 0);
  assert.equal(segmentDistanceSquared(a, b, { x: 0, y: 6 }, { x: 10, y: 6 }), 36);
  assert.equal(segmentDistanceSquared(a, a, { x: 3, y: 4 }, { x: 3, y: 4 }), 25);
  const index = new SegmentIndex(6);
  const segment = { a, b, owner: 1, ordinal: 0 };
  index.add(segment);
  assert.ok(index.blocked({ x: 5, y: -20 }, { x: 5, y: 20 }));
  assert.ok(index.blocked({ x: 5, y: 5 }, { x: 6, y: 5 }));
  assert.equal(index.blocked({ x: 5, y: 6 }, { x: 6, y: 6 }), false);
  index.remove(segment);
  assert.equal(index.buckets.size, 0);
});

test('each filament starts at zero, grows, and fades while moving before retirement', () => {
  const flow = new WindFlow(1000, 600, random(), () => ({ x: 1, y: 0 }));
  assert.ok(flow.spawn(defaults));
  const s = flow.strands[0];
  const original = structuredClone(s.points);
  assert.equal(s.head, 0);
  assert.equal(s.tail, 0);
  assert.deepEqual(flow.visiblePoints(s), []);
  flow.advance(0, defaults);
  assert.equal(s.head, 0);
  flow.advance(0.1, { ...defaults, density: 0 });
  assert.ok(s.head > 0 && s.head < 6);
  assert.equal(s.tail, 0);
  let lastHead = s.head, lastTail = s.tail;
  for (let frame = 0; frame < 3000 && flow.strands.length; frame++) {
    flow.advance(1 / 30, { ...defaults, density: 0 });
    assert.ok(s.head >= lastHead && s.tail >= lastTail);
    if (flow.strands.length) assert.ok(s.head > lastHead, 'a live head must keep moving');
    assert.ok(s.fade >= 0 && s.fade <= 1);
    lastHead = s.head; lastTail = s.tail;
  }
  assert.deepEqual(s.points, original, 'existing geometry must never morph');
  assert.equal(s.tail, s.total);
  assert.equal(s.fade, 0);
  assert.equal(flow.strands.length, 0);
  assert.equal(flow.index.buckets.size, 0, 'retired paths must free their reservations');
});

test('dense evolving flow stays separated through control changes, retirement and resize', () => {
  let phase = 0;
  const flow = new WindFlow(640, 480, random(214), (x, y) => {
    const angle = Math.sin(x / 160 + phase) * 2 + Math.cos(y / 190) + phase;
    return { x: Math.cos(angle), y: Math.sin(angle) };
  });
  for (const length of [480, 60, 240]) {
    for (let frame = 0; frame < 360; frame++) {
      phase += 0.004;
      flow.advance(1 / 30, { length, density: 2.5 });
    }
    assert.ok(flow.strands.length > 10);
    verifySeparation(flow);
  }
  flow.reset(320, 240);
  assert.equal(flow.strands.length, 0);
  assert.equal(flow.index.buckets.size, 0);
  for (let frame = 0; frame < 120; frame++) flow.advance(1 / 30, { length: 480, density: 2.5 });
  verifySeparation(flow);
});
