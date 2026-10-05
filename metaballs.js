/* p5 WEBGL shader: smooth unions of moving circular signed-distance fields. */
(() => {
  'use strict';
  const MAX_BALLS = 32;
  const VERTEX_SHADER = `
    precision highp float;
    attribute vec3 aPosition;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    void main() {
      gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
    }
  `;
  // Prefix custom uniforms: p5 overwrites built-ins such as uViewport while
  // drawing. Its vec4 viewport starts with (0, 0), invalidating our vec2 size.
  const FRAGMENT_SHADER = `
    precision highp float;
    uniform vec2 uMetaballResolution;
    uniform vec2 uMetaballViewport;
    uniform vec3 uMetaballBalls[${MAX_BALLS}];
    uniform int uMetaballCount;
    uniform float uMetaballFusion;

    float smoothUnion(float a, float b, float k) {
      if (k < 0.0001) return min(a, b);
      float h = max(k - abs(a - b), 0.0) / k;
      return min(a, b) - h * h * k * 0.25;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / uMetaballResolution;
      vec2 point = vec2(uv.x, 1.0 - uv.y) * uMetaballViewport;
      float distanceToShape = 100000.0;
      for (int i = 0; i < ${MAX_BALLS}; i++) {
        if (i < uMetaballCount) {
          // Periodic boundaries let circles enter/leave without teleporting.
          vec2 delta = abs(point - uMetaballBalls[i].xy);
          delta = min(delta, uMetaballViewport - delta);
          float circle = length(delta) - uMetaballBalls[i].z;
          distanceToShape = smoothUnion(distanceToShape, circle, uMetaballFusion);
        }
      }
      float edge = max(uMetaballViewport.x / uMetaballResolution.x, uMetaballViewport.y / uMetaballResolution.y) * 0.8;
      float inside = 1.0 - smoothstep(-edge, edge, distanceToShape);
      vec3 background = vec3(18.0, 18.0, 18.0) / 255.0;
      vec3 ivory = vec3(242.0, 239.0, 229.0) / 255.0;
      gl_FragColor = vec4(mix(background, ivory, inside), 1.0);
    }
  `;

  function smoothUnion(a, b, fusion) {
    if (fusion < 0.0001) return Math.min(a, b);
    const h = Math.max(fusion - Math.abs(a - b), 0) / fusion;
    return Math.min(a, b) - h * h * fusion * 0.25;
  }
  function signedDistance(x, y, balls, width, height, fusion) {
    let distance = 100000;
    for (const ball of balls) {
      const dx = Math.abs(x - ball[0]), dy = Math.abs(y - ball[1]);
      const circle = Math.hypot(Math.min(dx, width - dx), Math.min(dy, height - dy)) - ball[2];
      distance = smoothUnion(distance, circle, fusion);
    }
    return distance;
  }

  class MetaballField {
    constructor(seed = 137) {
      this.time = 0;
      this.setSeed(seed);
    }
    setSeed(seed) {
      let state = seed >>> 0;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      this.particles = Array.from({ length: MAX_BALLS }, () => {
        const angle = random() * Math.PI * 2;
        return { x: random(), y: random(), vx: Math.cos(angle), vy: Math.sin(angle),
          phase: random() * Math.PI * 2, frequency: 0.09 + random() * 0.08 };
      });
      this.time = 0;
    }
    advance(dt) { this.time += Math.max(0, dt); }
    balls(width, height, settings) {
      const wrap = (value, period) => ((value % period) + period) % period;
      const radius = Math.min(settings.radius, Math.min(width, height) * 0.24);
      return this.particles.slice(0, Math.min(MAX_BALLS, Math.max(0, Math.round(settings.count)))).map(particle => {
        const t = this.time;
        const bend = settings.motion * radius * 0.85;
        const x = particle.x * width + particle.vx * t * 24
          + Math.sin(t * particle.frequency + particle.phase) * bend;
        const y = particle.y * height + particle.vy * t * 24
          + Math.cos(t * particle.frequency * 0.83 + particle.phase) * bend;
        return [wrap(x, width), wrap(y, height), radius];
      });
    }
  }

  class MetaballsEffect {
    constructor(p) {
      this.p = p;
      this.field = new MetaballField();
      this.graphics = null;
      this.shader = null;
      this.width = 0;
      this.height = 0;
      this.uniforms = new Float32Array(MAX_BALLS * 3);
    }
    setSeed(seed) { this.field.setSeed(seed); }
    advance(dt) { this.field.advance(dt); }
    resize(width, height) {
      if (!this.graphics || (this.width === width && this.height === height)) return;
      this.configureSize(width, height);
    }
    configureSize(width, height) {
      this.width = width;
      this.height = height;
      // Keep the fragment workload bounded; shader edge AA works at any density.
      const density = Math.min(2, Math.sqrt(2400000 / (width * height)));
      this.graphics.pixelDensity(density);
      this.graphics.resizeCanvas(width, height);
    }
    ensureGraphics(width, height) {
      if (this.graphics) { this.resize(width, height); return; }
      // Allocate the WEBGL context only when this effect is selected.
      this.graphics = this.p.createGraphics(1, 1, this.p.WEBGL);
      this.graphics.setAttributes({ alpha: false, depth: false, antialias: false });
      this.configureSize(width, height);
      this.shader = this.graphics.createShader(VERTEX_SHADER, FRAGMENT_SHADER);
      this.graphics.noStroke();
    }
    draw(width, height, settings) {
      this.ensureGraphics(width, height);
      const g = this.graphics;
      const balls = this.field.balls(width, height, settings);
      this.uniforms.fill(0);
      balls.forEach((ball, i) => this.uniforms.set(ball, i * 3));
      g.shader(this.shader);
      this.shader.setUniform('uMetaballResolution', [g.drawingContext.drawingBufferWidth, g.drawingContext.drawingBufferHeight]);
      this.shader.setUniform('uMetaballViewport', [width, height]);
      this.shader.setUniform('uMetaballBalls', this.uniforms);
      this.shader.setUniform('uMetaballCount', balls.length);
      this.shader.setUniform('uMetaballFusion', settings.fusion * (balls[0]?.[2] || settings.radius));
      g.rect(-width / 2, -height / 2, width, height);
      this.p.image(g, 0, 0, width, height);
    }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MetaballField, MetaballsEffect, smoothUnion, signedDistance, VERTEX_SHADER, FRAGMENT_SHADER, MAX_BALLS };
  } else globalThis.MetaballsEffect = MetaballsEffect;
})();
