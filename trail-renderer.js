/* One continuous stroke per trail. No per-segment caps, brightness buckets,
 * additive highlights or overlapping tips at the internal joins.
 */
(() => {
  'use strict';
  function drawTrail(ctx, points, opacity, width) {
    if (points.length < 2) return;
    const tail = points[0], head = points[points.length - 1];
    const dx = head.x - tail.x, dy = head.y - tail.y;
    const chordSquared = dx * dx + dy * dy;
    if (chordSquared < 0.01) return;
    const distances = [0];
    for (let i = 1; i < points.length; i++) {
      distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    }
    const length = distances[distances.length - 1];
    // Sub-pixel newborn/retiring trails fade in/out instead of becoming dots.
    const appearance = Math.min(1, length / 12);
    const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    let lastStop = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      const projection = ((point.x - tail.x) * dx + (point.y - tail.y) * dy) / chordSquared;
      // Paths are turn-limited by the tracer, so the fade advances tail to head.
      if (projection <= lastStop + 0.06 || projection >= 0.98) continue;
      gradient.addColorStop(projection, `rgba(255,255,255,${opacity * appearance * (distances[i] / length) ** 1.25})`);
      lastStop = projection;
    }
    gradient.addColorStop(1, `rgba(255,255,255,${opacity * appearance})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { drawTrail };
  else globalThis.drawWindTrail = drawTrail;
})();
