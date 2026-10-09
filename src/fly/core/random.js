// Serializable Mulberry32 streams. No wall clock or renderer state enters a run.
export function random(state) {
  state.value = (state.value + 0x6D2B79F5) >>> 0;
  let t = state.value;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function stream(seed, salt = 0) { return { value: (Number(seed) ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0 }; }
export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function angle(value) { return Math.atan2(Math.sin(value), Math.cos(value)); }
