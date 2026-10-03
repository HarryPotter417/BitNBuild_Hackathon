import { cn } from "../lib/cn";
import { formatCompact, formatNumber } from "../lib/format";

/* ---------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------ */

function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === Infinity) return [0, 1];
  if (min === max) return [min, min + 1];
  return [min, max];
}

function smoothPath(points, { width, height, pad = 0 }) {
  if (points.length < 2) return "";
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const xy = points.map((p, i) => [
    pad + (i / (points.length - 1)) * innerW,
    pad + (1 - p.t) * innerH,
  ]);
  let d = `M${xy[0][0].toFixed(2)},${xy[0][1].toFixed(2)}`;
  for (let i = 0; i < xy.length - 1; i += 1) {
    const [x0, y0] = xy[i];
    const [x1, y1] = xy[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(2)},${y0.toFixed(2)} ${cx.toFixed(2)},${y1.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

function normalise(series) {
  const all = series.flatMap((s) => s.values).filter((v) => v !== null && !Number.isNaN(v));
  const [min, max] = extent(all.length ? all : [0, 1]);
  return series.map((s) => ({
    ...s,
    points: s.values.map((v) => ({ t: (v - min) / (max - min), v })),
  }));
}

const AXIS_TEXT = "fill-[var(--fd-text-muted)] text-[10px] font-medium";

/* ---------------------------------------------------------------------------
 * Sparkline
 * ------------------------------------------------------------------------ */

export function Sparkline({ values, toneName = "primary", className, height = 36, fill = true }) {
  const width = 240;
  const points = normalise([{ values: values?.length ? values : [0] }])[0].points;
  const d = smoothPath(points, { width, height, pad: 3 });
  const area = `${d} L${width - 3},${height - 3} L3,${height - 3} Z`;
  const id = `spark-${toneName}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`var(--fd-${toneName})`} stopOpacity="0.28" />
          <stop offset="100%" stopColor={`var(--fd-${toneName})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill ? <path d={area} fill={`url(#${id})`} /> : null}
      <path d={d} fill="none" stroke={`var(--fd-${toneName})`} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------------------------------------------------------------------------
 * Multi-series area chart with gridlines and axis labels
 * ------------------------------------------------------------------------ */

export function AreaChart({
  series,
  labels = [],
  height = 220,
  className,
  yFormat = formatCompact,
  showLegend = true,
}) {
  const width = 720;
  const padL = 46;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const normalised = normalise(series);
  const gridLines = 4;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={series.map((s) => s.name).join(", ")}
      >
        <defs>
          {normalised.map((s, i) => (
            <linearGradient key={s.name} id={`area-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={`var(--fd-${s.toneName || "primary"})`} stopOpacity="0.22" />
              <stop offset="100%" stopColor={`var(--fd-${s.toneName || "primary"})`} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = padT + (i / gridLines) * (height - padT - padB);
          return (
            <line
              key={i}
              x1={padL}
              x2={width - padR}
              y1={y}
              y2={y}
              stroke="var(--fd-border)"
              strokeDasharray={i === gridLines ? "0" : "3 5"}
            />
          );
        })}

        {normalised.map((s, i) => {
          const d = smoothPath(s.points, { width, height, pad: 0 });
          const area = `${d} L${width - padR},${height - padB} L${padL},${height - padB} Z`;
          return (
            <g key={s.name}>
              <path d={area} fill={`url(#area-${i})`} />
              <path
                d={d}
                fill="none"
                stroke={`var(--fd-${s.toneName || "primary"})`}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {labels.map((label, i) => {
          if (labels.length > 6 && i % Math.ceil(labels.length / 6) !== 0 && i !== labels.length - 1) return null;
          const x = padL + (i / Math.max(1, labels.length - 1)) * (width - padL - padR);
          return (
            <text key={i} x={x} y={height - 6} textAnchor="middle" className={AXIS_TEXT}>
              {label}
            </text>
          );
        })}
      </svg>

      {showLegend ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: `var(--fd-${s.toneName || "primary"})` }}
              />
              <span className="fd-caption text-ink-secondary">{s.name}</span>
              {s.value !== undefined ? (
                <span className="fd-caption text-ink font-semibold fd-tabular">{s.value}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Vertical bars
 * ------------------------------------------------------------------------ */

export function BarChart({
  data,
  height = 200,
  className,
  format = formatNumber,
  showValues = true,
  maxBarPct = 100,
}) {
  const max = Math.max(...data.map((d) => d.value), 1) * (100 / maxBarPct);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d) => {
          const h = Math.max(2, (d.value / max) * 100);
          return (
            <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              {showValues ? (
                <span className="fd-caption text-ink-secondary fd-tabular">{format(d.value)}</span>
              ) : null}
              <div
                className="w-full rounded-t-md transition-[height] duration-500"
                style={{
                  height: `${h}%`,
                  background: d.color
                    ? `var(--fd-${d.color})`
                    : "linear-gradient(180deg, var(--fd-primary) 0%, var(--fd-brand-400) 100%)",
                }}
                title={`${d.label}: ${format(d.value)}`}
              />
              <span className="fd-caption text-ink-muted truncate text-center w-full">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Horizontal bars (better for long category labels)
 * ------------------------------------------------------------------------ */

export function HBarChart({ data, className, format = formatNumber, reference }) {
  const max = Math.max(...data.map((d) => d.value), reference || 0, 1);
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="fd-caption text-ink-secondary">{d.label}</span>
            <span className="fd-caption text-ink fd-tabular font-semibold">
              {format(d.value)}
              {d.suffix ? <span className="text-ink-muted font-normal"> {d.suffix}</span> : null}
            </span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color ? `var(--fd-${d.color})` : "var(--fd-primary)",
              }}
            />
            {reference ? (
              <div
                className="absolute inset-y-0 w-px bg-ink-muted"
                style={{ left: `${(reference / max) * 100}%` }}
                title={`Reference: ${format(reference)}`}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Donut
 * ------------------------------------------------------------------------ */

export function Donut({ segments, size = 132, thickness = 16, centerLabel, centerValue, className }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const positionedSegments = segments.reduce((acc, segment) => {
    const previousOffset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    const dash = (segment.value / total) * circumference;
    acc.push({ segment, dash, offset: previousOffset });
    return acc;
  }, []);

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--fd-surface-sunken)"
          strokeWidth={thickness}
        />
        {positionedSegments.map(({ segment: s, dash, offset }) => (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`var(--fd-${s.color || "primary"})`}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="fd-metric-sm text-ink leading-none">{centerValue}</span>
        {centerLabel ? <span className="fd-caption text-ink-muted mt-1">{centerLabel}</span> : null}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Latency gauge
 * ------------------------------------------------------------------------ */

export function Gauge({ value, max, threshold, label, unit = "ms", className }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const breached = threshold !== undefined && value >= threshold;
  const r = 52;
  const circumference = Math.PI * r; // half circle
  const dash = pct * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width="132" height="74" viewBox="0 0 132 74" role="img" aria-label={`${label}: ${value}${unit}`}>
        <path
          d="M 14 66 A 52 52 0 0 1 118 66"
          fill="none"
          stroke="var(--fd-surface-sunken)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 14 66 A 52 52 0 0 1 118 66"
          fill="none"
          stroke={`var(--fd-${breached ? "danger" : "success"})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="-mt-3 text-center">
        <div className="fd-metric-sm text-ink">
          {value}
          <span className="text-sm text-ink-muted font-normal">{unit}</span>
        </div>
        <div className="fd-caption text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Live traffic bar
 * ------------------------------------------------------------------------ */

export function MiniTraffic({ series, className, height = 40 }) {
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  return (
    <div className={cn("flex items-end gap-px", className)} style={{ height }} aria-hidden="true">
      {series.map((s) =>
        s.values.map((v, i) => (
          <div
            key={`${s.name}-${i}`}
            className="flex-1 rounded-t-[2px] min-w-[1px]"
            style={{
              height: `${Math.max(2, (v / max) * 100)}%`,
              background: `var(--fd-${s.toneName || "primary"})`,
              opacity: s.faint ? 0.4 : 0.85,
            }}
          />
        ))
      )}
    </div>
  );
}
