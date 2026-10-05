const test = require('node:test');
const assert = require('node:assert/strict');
const { WindField } = require('./wind-field.js');
const { WindFlow } = require('./flow.js');
const { drawTrail } = require('./trail-renderer.js');

test('the shared field has negligible divergence across directions and curvature settings', () => {
  const field = new WindField(1200, 800);
  const h = 0.01;
  for (const direction of [0, 90, 225, 335]) {
    for (const curvature of [0, 1.25, 2]) {
      field.configure(direction, curvature);
      for (let x = 0; x <= 1200; x += 100) {
        for (let y = 0; y <= 800; y += 100) {
          const du = (field.sample(x + h, y).x - field.sample(x - h, y).x) / (2 * h);
          const dv = (field.sample(x, y + h).y - field.sample(x, y - h).y) / (2 * h);
          assert.ok(Math.abs(du + dv) < 1e-8, `divergence at ${x},${y}: ${du + dv}`);
        }
      }
    }
  }
});

test('zero curvature produces uniform wind and gusts preserve its direction', () => {
  const field = new WindField(1200, 800);
  field.configure(90, 0);
  for (const [x, y] of [[0, 0], [400, 900], [-200, 500]]) {
    const velocity = field.sample(x, y);
    assert.ok(Math.abs(velocity.x) < 1e-12);
    assert.equal(velocity.y, 1);
  }
  for (let t = 0; t < 200; t += 0.2) assert.ok(field.gust(t) >= 0.82 && field.gust(t) <= 1.18);
});

test('heads move at the local field speed, without individual random speeds', () => {
  const random = (a, b) => a + 0.5 * (b - a);
  const slow = new WindFlow(1200, 800, random, () => ({ x: 0.5, y: 0 }));
  const fast = new WindFlow(1200, 800, random, () => ({ x: 1, y: 0 }));
  const settings = { length: 180, density: 0 };
  assert.ok(slow.spawn(settings));
  assert.ok(fast.spawn(settings));
  slow.advance(0.1, settings);
  fast.advance(0.1, settings);
  assert.equal(fast.strands[0].head, slow.strands[0].head * 2);
});

test('a curved faded trail is one stroke with one move, no repeated caps or overlaid head', () => {
  let strokes = 0, moves = 0, lines = 0;
  const stops = [];
  const ctx = {
    createLinearGradient() { return { addColorStop(position, color) { stops.push({ position, color }); } }; },
    beginPath() {}, moveTo() { moves++; }, lineTo() { lines++; }, stroke() { strokes++; },
  };
  const points = Array.from({ length: 60 }, (_, i) => ({ x: i * 3, y: 20 * Math.sin(i / 35) }));
  drawTrail(ctx, points, 0.9, 1.3);
  assert.equal(strokes, 1);
  assert.equal(moves, 1);
  assert.equal(lines, points.length - 1);
  assert.equal(ctx.lineCap, 'butt');
  assert.equal(stops[0].color, 'rgba(255,255,255,0)');
  assert.equal(stops.at(-1).color, 'rgba(255,255,255,0.9)');
  for (let i = 1; i < stops.length; i++) assert.ok(stops[i].position > stops[i - 1].position);
});

test('tracing a vortex follows the field without looping back into its gradient', () => {
  const flow = new WindFlow(1200, 800, (a, b) => a + (b - a) * 0.5,
    (x, y) => ({ x: -(y - 350) / 200, y: (x - 400) / 200 }));
  assert.ok(flow.spawn({ length: 340 }));
  const points = flow.strands[0].points;
  const radius = Math.hypot(points[0].x - 400, points[0].y - 350);
  const a = points[0], b = points.at(-1);
  let last = -Infinity;
  for (const point of points) {
    assert.ok(Math.abs(Math.hypot(point.x - 400, point.y - 350) - radius) < 0.05, 'RK4 must preserve a circular streamline');
    const projection = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
    assert.ok(projection > last);
    last = projection;
  }
});
