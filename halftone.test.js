const test = require('node:test');
const assert = require('node:assert/strict');
const { HalftoneEffect } = require('./halftone.js');

const settings = { spacing: 20, size: 0.9, scale: 300, coverage: 0.55, contrast: 1.35 };
const noise = (x, y, z) => 0.44 + 0.2 * Math.sin(x * 1.3 + z) * Math.cos(y - z * 0.7);
function dots(effect, options = settings, width = 320, height = 240) {
  const points = [];
  effect.forEachDot(width, height, options, (x, y, radius) => points.push({ x, y, radius }));
  return points;
}

test('dot centres stay on the exact same square grid through time and regeneration', () => {
  const effect = new HalftoneEffect(noise);
  const first = dots(effect);
  effect.advance(12);
  const moved = dots(effect);
  effect.setSeed(999);
  const regenerated = dots(effect);
  assert.equal(first.length, 16 * 12);
  for (let i = 0; i < first.length; i++) {
    assert.equal(first[i].x, moved[i].x);
    assert.equal(first[i].y, moved[i].y);
    assert.equal(first[i].x, regenerated[i].x);
    assert.equal(first[i].y, regenerated[i].y);
    assert.equal((first[i].x - 10) % 20, 0);
    assert.equal((first[i].y - 10) % 20, 0);
  }
  assert.ok(first.some((p, i) => Math.abs(p.radius - moved[i].radius) > 0.2));
  assert.ok(moved.some((p, i) => Math.abs(p.radius - regenerated[i].radius) > 0.2));
});

test('diameters remain non-negative and smaller than grid spacing at slider extremes', () => {
  const effect = new HalftoneEffect(noise, 312);
  for (const spacing of [8, 40]) for (const coverage of [0.1, 0.9]) for (const contrast of [0.4, 2.5]) {
    for (const dot of dots(effect, { ...settings, spacing, coverage, contrast, size: 0.98, scale: 100 })) {
      assert.ok(Number.isFinite(dot.radius) && dot.radius >= 0);
      assert.ok(dot.radius * 2 < spacing);
    }
  }
});

test('paused frames are identical and neighbouring animation frames change smoothly', () => {
  const effect = new HalftoneEffect(noise);
  const before = dots(effect);
  effect.advance(0);
  assert.deepEqual(dots(effect), before);
  effect.advance(1 / 60);
  const after = dots(effect);
  assert.ok(after.some((point, i) => point.radius !== before[i].radius));
  for (let i = 0; i < before.length; i++) assert.ok(Math.abs(before[i].radius - after[i].radius) < 0.1);
});

test('resize preserves existing grid coordinates and rendering uses solid black circles', () => {
  const effect = new HalftoneEffect(noise);
  const original = dots(effect);
  const larger = dots(effect, settings, 640, 480);
  for (const point of original) assert.ok(larger.some(p => p.x === point.x && p.y === point.y && p.radius === point.radius));
  let fills = 0, arcs = 0;
  const ctx = { beginPath() {}, moveTo() {}, arc(x, y, radius, start, end) {
    assert.ok(radius > 0 && radius < 10);
    assert.equal(start, 0); assert.equal(end, Math.PI * 2); arcs++;
  }, fill() { fills++; } };
  effect.draw(ctx, 320, 240, settings);
  assert.equal(ctx.fillStyle, '#000000');
  assert.equal(fills, 1);
  assert.ok(arcs > 0);
});
