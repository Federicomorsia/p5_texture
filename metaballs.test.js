const test = require('node:test');
const assert = require('node:assert/strict');
const { MetaballField, MetaballsEffect, signedDistance, MAX_BALLS } = require('./metaballs.js');
const defaults = { count: 20, radius: 72, fusion: 1.15, motion: 1 };

test('nearby circles form a bridge and separate again with distance', () => {
  const near = [[150, 200, 40], [250, 200, 40]];
  assert.ok(signedDistance(200, 200, near, 800, 600, 0) > 0);
  assert.ok(signedDistance(200, 200, near, 800, 600, 60) < 0);
  const far = [[100, 200, 40], [300, 200, 40]];
  assert.ok(signedDistance(200, 200, far, 800, 600, 60) > 0);
});

test('isolated shapes stay circular on wide viewports and continue across edges', () => {
  const ball = [[500, 250, 50]];
  for (const [x, y] of [[550, 250], [450, 250], [500, 200], [500, 300]]) {
    assert.ok(Math.abs(signedDistance(x, y, ball, 1600, 600, 80)) < 1e-9);
  }
  assert.equal(signedDistance(799, 300, [[1, 300, 40]], 800, 600, 50), -38);
});

test('motion is smooth, paused state is stable, and regeneration gives a new arrangement', () => {
  const field = new MetaballField();
  const initial = field.balls(1200, 800, defaults);
  field.advance(0);
  assert.deepEqual(field.balls(1200, 800, defaults), initial);
  field.advance(1 / 60);
  const next = field.balls(1200, 800, defaults);
  assert.notDeepEqual(next, initial);
  for (let i = 0; i < next.length; i++) {
    let dx = Math.abs(next[i][0] - initial[i][0]), dy = Math.abs(next[i][1] - initial[i][1]);
    dx = Math.min(dx, 1200 - dx); dy = Math.min(dy, 800 - dy);
    assert.ok(Math.hypot(dx, dy) < 1);
    assert.equal(next[i][2], initial[i][2]);
  }
  field.setSeed(919);
  assert.notDeepEqual(field.balls(1200, 800, defaults), initial);
});

test('count, viewport and radius stay bounded at control extremes', () => {
  const field = new MetaballField(14);
  field.advance(10000);
  const balls = field.balls(240, 160, { ...defaults, count: 100, radius: 150, motion: 2 });
  assert.equal(balls.length, MAX_BALLS);
  for (const [x, y, radius] of balls) {
    assert.ok(x >= 0 && x < 240 && y >= 0 && y < 160);
    assert.ok(radius > 0 && radius < 80);
  }
});

test('the p5 shader buffer is lazy, reused, resized, and receives current circles', () => {
  let allocations = 0, draws = 0, density = 1;
  const uniforms = new Map();
  const graphics = {
    drawingContext: { drawingBufferWidth: 1200, drawingBufferHeight: 800 },
    setAttributes() {}, pixelDensity(value) { density = value; }, resizeCanvas() {},
    createShader() { return { setUniform: (name, value) => uniforms.set(name, value) }; },
    noStroke() {}, shader() {},
    rect() { uniforms.set('uViewport', [0, 0, 1200, 800]); },
  };
  const p = { WEBGL: 'webgl', createGraphics() { allocations++; return graphics; }, image() { draws++; } };
  const effect = new MetaballsEffect(p);
  assert.equal(allocations, 0);
  effect.draw(1200, 800, defaults);
  effect.advance(1 / 60);
  effect.draw(1200, 800, defaults);
  assert.equal(allocations, 1);
  assert.equal(draws, 2);
  assert.equal(uniforms.get('uMetaballCount'), 20);
  assert.equal(uniforms.get('uMetaballBalls').length, 96);
  assert.equal(uniforms.get('uMetaballFusion'), defaults.radius * defaults.fusion);
  assert.deepEqual(uniforms.get('uMetaballViewport'), [1200, 800], 'p5 viewport updates must not overwrite the effect size');
  effect.resize(3840, 2160);
  assert.ok(3840 * 2160 * density * density <= 2400000 + 1e-6);
});
