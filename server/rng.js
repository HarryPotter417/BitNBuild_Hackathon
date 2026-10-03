/**
 * Deterministic pseudo-randomness.
 *
 * Every simulated number in Fair Drop is produced by a seeded generator so the
 * same seed always yields the same dataset. That keeps demo runs, screenshots
 * and the adversarial lab reproducible — and it means a value on screen can
 * always be traced back to the parameters that produced it.
 */

/** mulberry32 — small, fast, good enough for simulation. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFrom(...parts) {
  return makeRng(hashSeed(parts.join("|")));
}

export function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Box–Muller, clamped, for latency-shaped series. */
export function gaussian(rng, mean, stdDev, min = -Infinity, max = Infinity) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(max, Math.max(min, mean + z * stdDev));
}

/** Power-law-ish request counts: most users are light, a few are extreme. */
export function longTail(rng, min, max, exponent = 2.4) {
  const u = rng();
  const shaped = Math.pow(u, exponent);
  return Math.round(min + shaped * (max - min));
}

export function sampleWeighted(rng, items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let r = rng() * total;
  for (const item of items) {
    r -= weightOf(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}
