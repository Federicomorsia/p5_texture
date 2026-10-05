/* Geometry and lifecycle are independent of rendering, so separation is testable. */
(() => {
  'use strict';
  const pathStep = 3;

  function pointDistanceSquared(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
    return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
  }

  function segmentDistanceSquared(a, b, c, d) {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const abC = cross(a, b, c), abD = cross(a, b, d);
    const cdA = cross(c, d, a), cdB = cross(c, d, b);
    if (((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
        ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))) return 0;
    return Math.min(pointDistanceSquared(a, c, d), pointDistanceSquared(b, c, d),
      pointDistanceSquared(c, a, b), pointDistanceSquared(d, a, b));
  }

  class SegmentIndex {
    constructor(clearance = 6) {
      this.clearance = clearance;
      this.cell = 24;
      this.buckets = new Map();
    }
    keys(a, b, padding = 0) {
      const keys = [];
      for (let y = Math.floor((Math.min(a.y, b.y) - padding) / this.cell); y <= Math.floor((Math.max(a.y, b.y) + padding) / this.cell); y++) {
        for (let x = Math.floor((Math.min(a.x, b.x) - padding) / this.cell); x <= Math.floor((Math.max(a.x, b.x) + padding) / this.cell); x++) keys.push(`${x},${y}`);
      }
      return keys;
    }
    add(segment) {
      segment.keys = this.keys(segment.a, segment.b);
      for (const key of segment.keys) {
        if (!this.buckets.has(key)) this.buckets.set(key, new Set());
        this.buckets.get(key).add(segment);
      }
    }
    remove(segment) {
      for (const key of segment.keys) {
        const bucket = this.buckets.get(key);
        bucket.delete(segment);
        if (!bucket.size) this.buckets.delete(key);
      }
    }
    blocked(a, b, owner = null, ordinal = Infinity) {
      const seen = new Set();
      for (const key of this.keys(a, b, this.clearance)) {
        for (const segment of this.buckets.get(key) || []) {
          if (seen.has(segment)) continue;
          seen.add(segment);
          // Connected neighbours share an endpoint; all other segments are checked.
          if (owner !== null && segment.owner === owner && segment.ordinal >= ordinal - 2) continue;
          if (segmentDistanceSquared(a, b, segment.a, segment.b) < this.clearance ** 2) return true;
        }
      }
      return false;
    }
  }

  class WindFlow {
    constructor(width, height, random, sample) {
      this.random = random;
      this.sample = sample;
      this.nextId = 0;
      this.reset(width, height);
    }
    reset(width, height) {
      this.width = width;
      this.height = height;
      this.strands = [];
      // Even at the maximum 2 px stroke, adjacent trails remain separate.
      this.index = new SegmentIndex(2.6);
    }
    spawn(settings) {
      const owner = this.nextId++;
      const x = this.random(-24, this.width + 24);
      const y = this.random(0, 1) < 0.55
        ? this.height * (0.6 + 0.13 * Math.sin(x * 0.004)) + this.random(-0.27, 0.27) * this.height
        : this.random(-24, this.height + 24);
      let a = { x, y, distance: 0 };
      if (this.index.blocked(a, a)) return false;
      const points = [a], segments = [];
      const lengthFactor = this.random(0.4, 1.4);
      const requested = settings.length * lengthFactor * 1.6;
      let previous = null, turning = 0;
      const direction = (x, y) => {
        const v = this.sample(x, y);
        const speed = Math.hypot(v.x, v.y);
        if (speed < 0.02) return null;
        return { x: v.x / speed, y: v.y / speed, speed };
      };
      for (let distance = pathStep; distance <= requested; distance += pathStep) {
        // RK4 integrates the shared field without per-particle steering/inertia.
        const k1 = direction(a.x, a.y);
        if (!k1) break;
        const k2 = direction(a.x + k1.x * pathStep / 2, a.y + k1.y * pathStep / 2);
        if (!k2) break;
        const k3 = direction(a.x + k2.x * pathStep / 2, a.y + k2.y * pathStep / 2);
        if (!k3) break;
        const k4 = direction(a.x + k3.x * pathStep, a.y + k3.y * pathStep);
        if (!k4) break;
        let vx = (k1.x + 2 * k2.x + 2 * k3.x + k4.x) / 6;
        let vy = (k1.y + 2 * k2.y + 2 * k3.y + k4.y) / 6;
        const magnitude = Math.hypot(vx, vy);
        if (magnitude < 0.02) break;
        vx /= magnitude;
        vy /= magnitude;
        if (previous) turning += Math.acos(Math.max(-1, Math.min(1, previous.x * vx + previous.y * vy)));
        // Short traces reveal vortices collectively, avoiding hairpins whose
        // heads fold back onto their own fade in screen-space projection.
        if (turning > 1.3) break;
        const b = { x: a.x + vx * pathStep, y: a.y + vy * pathStep, distance, speed: k4.speed };
        if (b.x < -40 || b.x > this.width + 40 || b.y < -40 || b.y > this.height + 40) break;
        if (this.index.blocked(a, b, owner, segments.length)) break;
        a.speed = k1.speed;
        const segment = { a, b, owner, ordinal: segments.length };
        this.index.add(segment);
        segments.push(segment);
        points.push(b);
        a = b;
        previous = { x: vx, y: vy };
      }
      if (a.distance < Math.min(24, requested * 0.4)) {
        for (const segment of segments) this.index.remove(segment);
        return false;
      }
      this.strands.push({ points, segments, head: 0, tail: 0, total: a.distance,
        lengthFactor, fade: 1, alpha: this.random(0.7, 1) });
      return true;
    }
    advance(dt, settings) {
      if (dt <= 0) return;
      for (let i = this.strands.length - 1; i >= 0; i--) {
        const strand = this.strands[i];
        const currentSpeed = this.pointAt(strand, strand.head).speed;
        const middle = Math.min(strand.total, strand.head + currentSpeed * 42 * dt / 2);
        const travel = 42 * this.pointAt(strand, middle).speed * dt;
        strand.head = Math.min(strand.total, strand.head + travel);
        const target = Math.min(settings.length * strand.lengthFactor, strand.total * 0.72);
        strand.tail = Math.min(strand.head, strand.tail + Math.min(travel * 1.8, Math.max(0, strand.head - target - strand.tail)));
        const fadeDistance = Math.min(45, strand.total * 0.25);
        const remaining = Math.min(1, (strand.total - strand.head) / fadeDistance);
        strand.fade = remaining * remaining * (3 - 2 * remaining);
        // Fade while still moving; a finished head must never hang motionless.
        if (strand.head >= strand.total) {
          strand.tail = strand.head;
          for (const segment of strand.segments) this.index.remove(segment);
          this.strands.splice(i, 1);
        }
      }
      const desired = Math.min(2800, Math.round(this.width * this.height / 650 * settings.density));
      // A bounded number of attempts keeps crowded frames responsive. Existing
      // paths finish naturally when density is lowered instead of disappearing.
      for (let attempt = 0; attempt < 24 && this.strands.length < desired; attempt++) this.spawn(settings);
    }
    pointAt(strand, distance) {
      const i = Math.min(strand.points.length - 2, Math.floor(distance / pathStep));
      const a = strand.points[i], b = strand.points[i + 1];
      const t = (distance - a.distance) / (b.distance - a.distance);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
        speed: a.speed + (b.speed - a.speed) * t };
    }
    visiblePoints(strand) {
      if (strand.head <= strand.tail) return [];
      const points = [this.pointAt(strand, strand.tail)];
      for (let i = Math.floor(strand.tail / pathStep) + 1; i * pathStep < strand.head; i++) points.push(strand.points[i]);
      points.push(this.pointAt(strand, strand.head));
      return points;
    }

  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { WindFlow, SegmentIndex, segmentDistanceSquared };
  else globalThis.WindFlow = WindFlow;
})();
