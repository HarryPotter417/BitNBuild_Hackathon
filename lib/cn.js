/**
 * Tiny class-name joiner (no runtime dependency).
 * Accepts strings, arrays and `{ class: boolean }` maps.
 */
export function cn(...parts) {
  const out = [];
  const walk = (p) => {
    if (!p) return;
    if (typeof p === "string" || typeof p === "number") {
      out.push(String(p));
      return;
    }
    if (Array.isArray(p)) {
      p.forEach(walk);
      return;
    }
    if (typeof p === "object") {
      for (const key of Object.keys(p)) {
        if (p[key]) out.push(key);
      }
    }
  };
  parts.forEach(walk);
  return out.join(" ");
}
