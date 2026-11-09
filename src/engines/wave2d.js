// Two-dimensional time-dependent Schrödinger equation on the GPU.
//
// Each texel holds two complex wavefunctions (RG and BA) so that a pair of
// "which-path" branches can evolve side by side. Time stepping is Visscher's
// staggered leapfrog: the real part lives at whole time steps and the
// imaginary part at half steps, which makes the explicit scheme stable and
// norm-conserving for dt < dx^2 / 2 (hbar = m = dx = 1).
//
// The mask texture carries hard walls for each field (R, G) and an absorbing
// border (B) that lets waves leave the grid without reflecting.
(() => {
  const QL = (globalThis.QL ||= {});

  const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const STEP = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform sampler2D uMask;
uniform ivec2 uSize;
uniform int uPass;
uniform float uDt;
uniform int uSrcX;
uniform vec2 uSrcY;   // centre and sigma of the source profile, in cells
uniform vec2 uSrc;    // drive for field 1 and field 2, already multiplied by dt
uniform float uFade;
out vec4 o;
vec4 at(ivec2 p) { return texelFetch(uState, clamp(p, ivec2(0), uSize - 1), 0); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = at(p);
  vec4 lap = at(p + ivec2(1, 0)) + at(p - ivec2(1, 0)) + at(p + ivec2(0, 1)) + at(p - ivec2(0, 1)) - 4.0 * c;
  vec4 m = texelFetch(uMask, p, 0);
  float s = 0.0;
  if (p.x == uSrcX) { float u = (float(p.y) - uSrcY.x) / uSrcY.y; s = exp(-0.25 * u * u); }
  float keep = 1.0 - 0.06 * m.b;
  if (uPass == 0) {          // dR/dt =  H I - S sin(wt),  H = -laplacian / 2
    c.r = (c.r - 0.5 * uDt * lap.g - s * uSrc.x) * keep;
    c.b = (c.b - 0.5 * uDt * lap.a - s * uSrc.y) * keep;
  } else {                   // dI/dt = -H R - S cos(wt)
    c.g = (c.g + 0.5 * uDt * lap.r - s * uSrc.x) * keep;
    c.a = (c.a + 0.5 * uDt * lap.b - s * uSrc.y) * keep;
  }
  if (m.r > 0.5) c.rg = vec2(0.0);
  if (m.g > 0.5) c.ba = vec2(0.0);
  o = c * uFade;
}`;

  // Probability current through one column, per field, plus the densities.
  const FLUX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform int uX;
out vec4 o;
void main() {
  int y = int(gl_FragCoord.y);
  vec4 c = texelFetch(uState, ivec2(uX, y), 0);
  vec4 d = 0.5 * (texelFetch(uState, ivec2(uX + 1, y), 0) - texelFetch(uState, ivec2(uX - 1, y), 0));
  o = vec4(c.r * d.g - c.g * d.r, c.b * d.a - c.a * d.b, dot(c.rg, c.rg), dot(c.ba, c.ba));
}`;

  const SHOW = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uState;
uniform ivec2 uSize;
uniform vec4 uView;   // x0, y0, width, height of the visible window, in cells
uniform int uMode;    // 0 phase as hue, 1 probability only, 2 path-tagged
uniform vec2 uVis;    // which of the two fields are drawn
uniform float uGain;
in vec2 vUv;
out vec4 o;
vec4 tex(vec2 pos) {
  vec2 f = pos - 0.5, fl = floor(f), w = f - fl;
  ivec2 i = ivec2(fl), hi = uSize - 1;
  vec4 a = texelFetch(uState, clamp(i, ivec2(0), hi), 0);
  vec4 b = texelFetch(uState, clamp(i + ivec2(1, 0), ivec2(0), hi), 0);
  vec4 c = texelFetch(uState, clamp(i + ivec2(0, 1), ivec2(0), hi), 0);
  vec4 d = texelFetch(uState, clamp(i + ivec2(1, 1), ivec2(0), hi), 0);
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}
vec3 hue(float ph) { return 0.1 + 0.9 * (0.5 + 0.5 * cos(ph - vec3(0.0, 2.0944, 4.1888))); }
void main() {
  vec2 pos = uView.xy + vec2(vUv.x, 1.0 - vUv.y) * uView.zw;
  vec4 s = tex(pos);
  vec2 a = s.rg * uVis.x, b = s.ba * uVis.y;
  float da = dot(a, a), db = dot(b, b), d = da + db;
  // Compress the range so the faint far-field fringes stay visible.
  float v = pow(clamp(d * uGain * 1.6, 0.0, 12.0), 0.3);
  v = v / (1.0 + 0.22 * v);
  vec3 col;
  if (uMode == 1) {
    col = mix(vec3(0.20, 0.38, 0.95), vec3(0.80, 0.95, 1.0), smoothstep(0.0, 0.9, v)) * v;
  } else if (uMode == 2) {
    vec3 warm = vec3(1.0, 0.64, 0.28), cool = vec3(0.32, 0.68, 1.0);
    float ca = 0.62 + 0.38 * cos(atan(a.y, a.x)), cb = 0.62 + 0.38 * cos(atan(b.y, b.x));
    col = (warm * da * ca + cool * db * cb) / max(d, 1e-24) * v * 1.2;
  } else {
    vec2 z = a + b;
    float ph = atan(z.y, z.x);
    col = hue(ph) * v * (0.78 + 0.22 * cos(ph));
  }
  col += vec3(0.012, 0.016, 0.03);
  o = vec4(col, 1.0);
}`;

  const compile = (gl, type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader failed');
    return sh;
  };
  const program = (gl, frag, names) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link failed');
    const u = {};
    for (const n of names) u[n] = gl.getUniformLocation(p, n);
    return { p, u };
  };

  QL.Wave2D = class {
    constructor(gl, nx, ny) {
      if (!gl) throw new Error('WebGL2 is not available in this browser.');
      if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('This GPU cannot render to floating point textures.');
      this.gl = gl;
      this.nx = nx;
      this.ny = ny;
      this.dt = 0.4;
      this.t = 0;
      this.step_ = program(gl, STEP, ['uState', 'uMask', 'uSize', 'uPass', 'uDt', 'uSrcX', 'uSrcY', 'uSrc', 'uFade']);
      this.flux_ = program(gl, FLUX, ['uState', 'uX']);
      this.show_ = program(gl, SHOW, ['uState', 'uSize', 'uView', 'uMode', 'uVis', 'uGain']);

      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const tex = (w, h, internal, format, type) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      const fbo = (t) => {
        const f = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, f);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        return f;
      };
      this.texA = tex(nx, ny, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      this.texB = tex(nx, ny, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      this.texM = tex(nx, ny, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
      this.texF = tex(1, ny, gl.RGBA32F, gl.RGBA, gl.FLOAT);
      this.fboA = fbo(this.texA);
      this.fboB = fbo(this.texB);
      this.fboF = fbo(this.texF);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Float framebuffer is incomplete on this GPU.');
      this.line = new Float32Array(ny * 4);
      this.source = { x: 0, y: ny / 2, sigma: 60 };
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      this.clear();
    }

    clear() {
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      for (const f of [this.fboA, this.fboB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    setMask(bytes) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texM);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.nx, this.ny, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    }

    // Advance `count` steps. drive(time, pass) returns the source term for the
    // two fields at that instant, or null when the gun is off. `fade` scales
    // the whole field once, on the last pass (used to wipe it after a detection).
    step(count, drive, fade = 1) {
      const gl = this.gl, { p, u } = this.step_;
      gl.useProgram(p);
      gl.bindVertexArray(this.vao);
      gl.viewport(0, 0, this.nx, this.ny);
      gl.uniform1i(u.uState, 0);
      gl.uniform1i(u.uMask, 1);
      gl.uniform2i(u.uSize, this.nx, this.ny);
      gl.uniform1f(u.uDt, this.dt);
      gl.uniform1i(u.uSrcX, this.source.x);
      gl.uniform2f(u.uSrcY, this.source.y, this.source.sigma);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.texM);
      gl.activeTexture(gl.TEXTURE0);
      for (let i = 0; i < count; i++) {
        const a = drive ? drive(this.t + 0.5 * this.dt, 0) : null;
        gl.uniform1i(u.uPass, 0);
        gl.uniform2f(u.uSrc, a ? a[0] : 0, a ? a[1] : 0);
        gl.uniform1f(u.uFade, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.bindTexture(gl.TEXTURE_2D, this.texA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const b = drive ? drive(this.t + this.dt, 1) : null;
        gl.uniform1i(u.uPass, 1);
        gl.uniform2f(u.uSrc, b ? b[0] : 0, b ? b[1] : 0);
        gl.uniform1f(u.uFade, i === count - 1 ? fade : 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
        gl.bindTexture(gl.TEXTURE_2D, this.texB);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        this.t += this.dt;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // Returns [J1, J2, rho1, rho2] for every row of column x.
    readColumn(x) {
      const gl = this.gl, { p, u } = this.flux_;
      gl.useProgram(p);
      gl.bindVertexArray(this.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboF);
      gl.viewport(0, 0, 1, this.ny);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.uniform1i(u.uState, 0);
      gl.uniform1i(u.uX, x);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.readPixels(0, 0, 1, this.ny, gl.RGBA, gl.FLOAT, this.line);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return this.line;
    }

    // Whole field, for tests: Float32Array of nx * ny * 4.
    readField() {
      const gl = this.gl, out = new Float32Array(this.nx * this.ny * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
      gl.readPixels(0, 0, this.nx, this.ny, gl.RGBA, gl.FLOAT, out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return out;
    }

    // Draw the window `view` (cells) into the device-pixel rectangle `rect`
    // of the canvas, with y running downward to match the 2D overlay.
    render(rect, view, { mode = 0, vis = [1, 0], gain = 1 } = {}) {
      const gl = this.gl, { p, u } = this.show_;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0.0235, 0.0275, 0.043, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.viewport(rect.x, gl.drawingBufferHeight - rect.y - rect.h, rect.w, rect.h);
      gl.useProgram(p);
      gl.bindVertexArray(this.vao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texA);
      gl.uniform1i(u.uState, 0);
      gl.uniform2i(u.uSize, this.nx, this.ny);
      gl.uniform4f(u.uView, view.x, view.y, view.w, view.h);
      gl.uniform1i(u.uMode, mode);
      gl.uniform2f(u.uVis, vis[0], vis[1]);
      gl.uniform1f(u.uGain, gain);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };
})();
