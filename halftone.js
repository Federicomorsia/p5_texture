/* Fixed dot centres. Only radius changes, driven by smooth 3D p5 noise. */
(() => {
  'use strict';
  class HalftoneEffect {
    constructor(noise, seed = 42) {
      this.noise = noise;
      this.time = 0;
      this.setSeed(seed);
    }
    setSeed(seed) {
      this.seed = seed >>> 0;
      let state = this.seed;
      const next = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return 20 + state / 4294967296 * 500;
      };
      this.offsetX = next();
      this.offsetY = next();
    }
    advance(dt) {
      this.time += Math.max(0, dt);
    }
    radius(x, y, settings) {
      const nx = x / settings.scale + this.offsetX;
      const ny = y / settings.scale + this.offsetY;
      const z = this.time * 0.16;
      // Domain warping bends the shapes while the physical grid stays fixed.
      const warpX = this.noise(nx * 0.55 + 71, ny * 0.55, z * 0.6) - 0.44;
      const warpY = this.noise(nx * 0.55, ny * 0.55 + 119, z * 0.6) - 0.44;
      const broad = this.noise(nx + warpX * 1.7, ny + warpY * 1.7, z);
      const detail = this.noise(nx * 1.8 + 53, ny * 1.8 + 29, z * 0.8);
      const signal = broad * 0.85 + detail * 0.15;
      const threshold = 0.72 - settings.coverage * 0.5;
      const transition = 0.16 / settings.contrast;
      let value = (signal - threshold + transition) / (2 * transition);
      value = Math.max(0, Math.min(1, value));
      value = value * value * (3 - 2 * value);
      return settings.spacing * settings.size * 0.5 * value;
    }
    forEachDot(width, height, settings, visit) {
      const spacing = settings.spacing;
      // Origin and pitch never depend on time, seed, or the sampled noise.
      for (let row = 0; row < Math.ceil(height / spacing); row++) {
        const y = (row + 0.5) * spacing;
        for (let column = 0; column < Math.ceil(width / spacing); column++) {
          const x = (column + 0.5) * spacing;
          visit(x, y, this.radius(x, y, settings));
        }
      }
    }
    draw(ctx, width, height, settings) {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      this.forEachDot(width, height, settings, (x, y, radius) => {
        if (radius <= 0) return;
        ctx.moveTo(x + radius, y);
        ctx.arc(x, y, radius, 0, Math.PI * 2);
      });
      ctx.fill();
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { HalftoneEffect };
  else globalThis.HalftoneEffect = HalftoneEffect;
})();
