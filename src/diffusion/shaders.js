// Diffusion Lab display shader: enclosed room, reflective wall glow, leak holes.
// Avoid GLSL bitwise ops (not in ES 1.00 / WebGL1).

export const VERT_FULLSCREEN = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FRAG_DIFFUSION = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uGamma;
uniform sampler2D uTex;
uniform float uMedium; // 0 gas 1 liquid
uniform vec2 uSource;
uniform float uShowSource;
uniform float uContour;
uniform float uShowReflection;
uniform float uShowLeaks;
uniform float uHoleSize;
uniform float uHoleCenter;
uniform float uHoleLeft;
uniform float uHoleRight;
uniform float uHoleBottom;
uniform float uHoleTop;
uniform float uEnclosed;

vec3 tonemap(vec3 c) {
  c *= uExposure;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = c * (1.0 + luma * 0.35) / (1.0 + luma);
  return pow(max(c, 0.0), vec3(1.0 / uGamma));
}

vec3 mediumTint(float c) {
  if (uMedium > 0.5) {
    vec3 lo = vec3(0.02, 0.08, 0.12);
    vec3 mid = vec3(0.08, 0.45, 0.55);
    vec3 hi = vec3(0.95, 0.75, 0.35);
    return mix(mix(lo, mid, smoothstep(0.0, 0.45, c)), hi, smoothstep(0.45, 1.0, c));
  }
  vec3 lo = vec3(0.03, 0.05, 0.1);
  vec3 mid = vec3(0.25, 0.55, 0.85);
  vec3 hi = vec3(0.92, 0.97, 1.0);
  return mix(mix(lo, mid, smoothstep(0.0, 0.4, c)), hi, smoothstep(0.4, 1.0, c));
}

float inHoleSpan(float along) {
  float halfSz = uHoleSize * 0.5;
  return step(uHoleCenter - halfSz, along) * step(along, uHoleCenter + halfSz);
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 frag = gl_FragCoord.xy / uResolution.xy;
  vec2 uv = frag;
  if (aspect > 1.0) uv.x = (frag.x - 0.5) * aspect + 0.5;
  else uv.y = (frag.y - 0.5) / aspect + 0.5;

  vec3 roomBg = vec3(0.045, 0.055, 0.075);
  vec3 wallCol = vec3(0.18, 0.22, 0.30);
  float wall = 0.038;
  float outside = step(uv.x, 0.0) + step(1.0, uv.x) + step(uv.y, 0.0) + step(1.0, uv.y);
  float onWall = (1.0 - step(0.5, outside)) * step(0.5, uEnclosed) *
    max(max(step(uv.x, wall), step(1.0 - wall, uv.x)),
        max(step(uv.y, wall), step(1.0 - wall, uv.y)));

  float isHole = 0.0;
  if (uShowLeaks > 0.5 && onWall > 0.5) {
    isHole = max(max(
      uHoleLeft * step(uv.x, wall) * inHoleSpan(uv.y),
      uHoleRight * step(1.0 - wall, uv.x) * inHoleSpan(uv.y)),
      max(
      uHoleBottom * step(uv.y, wall) * inHoleSpan(uv.x),
      uHoleTop * step(1.0 - wall, uv.y) * inHoleSpan(uv.x)));
  }

  vec3 col = roomBg;
  if (outside > 0.5) {
    col = vec3(0.012, 0.015, 0.022);
  } else if (onWall > 0.5 && isHole < 0.5) {
    col = wallCol;
    float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    col += vec3(0.25, 0.35, 0.5) * (1.0 - smoothstep(0.0, wall, edge)) * 0.35;
  } else {
    vec4 s = texture2D(uTex, clamp(uv, 0.0, 1.0));
    float c = s.r;
    float g = s.g;
    float refl = s.b;
    vec3 tint = mediumTint(c);
    col = tint * (0.55 + 1.4 * g);
    col += vec3(1.0, 0.98, 0.95) * pow(c, 3.5) * 0.8;

    if (uShowReflection > 0.5) {
      vec3 flash = vec3(1.0, 0.75, 0.35) * refl * 1.4;
      flash += vec3(0.4, 0.7, 1.0) * pow(refl, 2.0) * 0.8;
      col += flash;
    }

    if (uContour > 0.5) {
      float bands = abs(fract(c * 6.0) - 0.5);
      float line = smoothstep(0.08, 0.02, bands) * smoothstep(0.05, 0.15, c);
      col += vec3(0.55, 0.75, 1.0) * line * 0.35;
    }

    float gx = abs(fract(uv.x * 8.0) - 0.5);
    float gy = abs(fract(uv.y * 8.0) - 0.5);
    float grid = (1.0 - smoothstep(0.0, 0.03, min(gx, gy))) * 0.05;
    col += vec3(0.3, 0.4, 0.55) * grid;

    if (isHole > 0.5) {
      col = mix(col, vec3(0.02, 0.03, 0.05), 0.55);
      float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
      col += vec3(1.0, 0.35, 0.2) * 0.15 * pulse;
    }
  }

  if (uShowSource > 0.5 && outside < 0.5) {
    float d = length(uv - uSource);
    float ring = smoothstep(0.028, 0.018, d) - smoothstep(0.014, 0.008, d);
    col = mix(col, vec3(1.0, 0.85, 0.4), ring * 0.85);
  }

  float vig = smoothstep(1.2, 0.3, length((frag - 0.5) * vec2(aspect, 1.0)));
  col *= 0.55 + 0.45 * vig;
  gl_FragColor = vec4(tonemap(col), 1.0);
}
`;

export function holeWallFlags(walls) {
  const set = new Set(walls || []);
  return {
    left: set.has('left') ? 1 : 0,
    right: set.has('right') ? 1 : 0,
    bottom: set.has('bottom') ? 1 : 0,
    top: set.has('top') ? 1 : 0,
  };
}
