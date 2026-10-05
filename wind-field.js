/* A 2D stream function: velocity = (dψ/dy, -dψ/dx).
 * Its analytic divergence is zero; this is a procedural incompressible field,
 * not a weather model or a Navier–Stokes solver.
 */
(() => {
  'use strict';
  class WindField {
    constructor(width, height) {
      this.resize(width, height);
      this.configure(335, 1.25);
    }
    resize(width, height) {
      this.width = width;
      this.height = height;
      this.scale = Math.max(400, Math.min(width, height));
      this.vortices = [
        [width * 0.28, height * 0.38, this.scale * 0.27, 1.2],
        [width * 0.76, height * 0.63, this.scale * 0.34, -1.45],
      ];
    }
    configure(direction, curvature) {
      const angle = direction * Math.PI / 180;
      this.cos = Math.cos(angle);
      this.sin = Math.sin(angle);
      this.curvature = curvature;
    }
    sample(x, y) {
      const c = this.cos, s = this.sin;
      const u = (x * c + y * s) / this.scale;
      const v = (-x * s + y * c) / this.scale;
      // Analytic derivatives of two broad stream-function waves.
      let along = 0.48 * Math.sin(u * 5.1 + 0.7) * Math.cos(v * 3.2 - 0.8)
        + 0.14 * Math.sin(u * 9.3 - 1.4) * Math.cos(v * 5.2 + 1.1);
      let across = -0.48 * 5.1 / 3.2 * Math.cos(u * 5.1 + 0.7) * Math.sin(v * 3.2 - 0.8)
        - 0.14 * 9.3 / 5.2 * Math.cos(u * 9.3 - 1.4) * Math.sin(v * 5.2 + 1.1);
      let vx = along * c - across * s;
      let vy = along * s + across * c;
      // Smooth vortices from Gaussian stream functions, without singular cores.
      for (const [cx, cy, radius, strength] of this.vortices) {
        const dx = (x - cx) / radius, dy = (y - cy) / radius;
        const weight = strength * Math.exp(-(dx * dx + dy * dy) / 2);
        vx -= dy * weight;
        vy += dx * weight;
      }
      return { x: c + this.curvature * vx, y: s + this.curvature * vy };
    }
    gust(time) {
      return 1 + 0.12 * Math.sin(time * 0.23) + 0.06 * Math.sin(time * 0.51);
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { WindField };
  else globalThis.WindField = WindField;
})();
