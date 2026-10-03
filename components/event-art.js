import { cn } from "../lib/cn";

/**
 * Deterministic generative poster for an event.
 *
 * Every event renders a unique, stable composition derived from its id — no
 * stock photography, no network requests, and the same event always looks the
 * same. Each event's `accent` token drives the palette so the artwork stays in
 * step with the rest of the design system.
 */

const FALLBACK = ["#5c63ec", "#3336c2", "#7f88f3"];

/** Pull 1–3 usable colours out of an event's `accent` field. */
function accentColors(accent) {
  const list = Array.isArray(accent) ? accent.filter((c) => typeof c === "string") : [accent];
  if (!list.length) return FALLBACK;
  const [a, b = a, c = b] = list;
  return [a, b, c];
}

function hashCode(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Concentric arcs + a scatter field: reads as "audience around a stage". */
export function EventArt({ event, className, rounded = "rounded-t-[var(--radius-card)]" }) {
  const seed = hashCode(event?.id || "fairdrop");
  const rand = mulberry(seed);
  const [a, b, c] = accentColors(event?.accent);
  const cx = 120 + rand() * 160;
  const cy = 60 + rand() * 60;

  const rings = Array.from({ length: 5 }, (_, i) => ({
    r: 26 + i * (14 + rand() * 10),
    o: 0.5 - i * 0.075,
    w: 1 + rand() * 1.6,
  }));

  const dots = Array.from({ length: 34 }, () => ({
    x: rand() * 400,
    y: 70 + rand() * 130,
    r: 0.9 + rand() * 2.6,
    o: 0.18 + rand() * 0.6,
    fill: rand() > 0.66 ? b : c,
  }));

  const bars = Array.from({ length: 11 }, (_, i) => ({
    x: 16 + i * 34,
    h: 12 + rand() * 78,
    o: 0.1 + rand() * 0.26,
  }));

  return (
    <div className={cn("relative overflow-hidden bg-n-900", rounded, className)}>
      <svg viewBox="0 0 400 200" className="block h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={a} stopOpacity="0.95" />
            <stop offset="55%" stopColor={b} stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0a0f1e" stopOpacity="0.95" />
          </linearGradient>
          <radialGradient id={`glow-${seed}`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor={c} stopOpacity="0.55" />
            <stop offset="100%" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <pattern id={`grid-${seed}`} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0 L0 0 0 28" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="400" height="200" fill={`url(#bg-${seed})`} />
        <rect width="400" height="200" fill={`url(#grid-${seed})`} />
        <circle cx={cx} cy={cy} r="120" fill={`url(#glow-${seed})`} />

        {bars.map((bar, i) => (
          <rect
            key={`bar-${i}`}
            x={bar.x}
            y={200 - bar.h}
            width="16"
            height={bar.h}
            rx="3"
            fill="#ffffff"
            opacity={bar.o}
          />
        ))}

        {rings.map((ring, i) => (
          <circle
            key={`ring-${i}`}
            cx={cx}
            cy={cy}
            r={ring.r}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={ring.o}
            strokeWidth={ring.w}
          />
        ))}

        {dots.map((dot, i) => (
          <circle key={`dot-${i}`} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.fill} opacity={dot.o} />
        ))}
      </svg>
    </div>
  );
}

/** Wordmark glyph used in the header and on auth-less "signed in as" chips. */
export function Logo({ className, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7f88f3" />
          <stop offset="100%" stopColor="#3336c2" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-grad)" />
      <path d="M16 6.5 L24.5 24.5 H20.2 L16 15.6 L11.8 24.5 H7.5 Z" fill="#fff" opacity="0.96" />
      <circle cx="16" cy="20.4" r="2.5" fill="#fff" />
    </svg>
  );
}
