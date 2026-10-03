import Link from "next/link";
import { cn } from "../lib/cn";
import { tone } from "../lib/status";

/* ---------------------------------------------------------------------------
 * Surfaces
 * ------------------------------------------------------------------------ */

export function Card({ className, children, raised = false, ...rest }) {
  return (
    <div className={cn(raised ? "fd-card-raised" : "fd-card", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-4 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="fd-card-title text-ink">{title}</h3>
        {subtitle ? <p className="fd-caption text-ink-muted mt-0.5">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Section({ title, subtitle, action, children, className, id }) {
  return (
    <section id={id} className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-4">
          <div>
            {title ? <h2 className="fd-section-title text-ink">{title}</h2> : null}
            {subtitle ? <p className="fd-body-sm text-ink-muted mt-1 max-w-2xl">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Badges, dots, pills
 * ------------------------------------------------------------------------ */

export function Badge({ children, toneName = "neutral", dot = false, className, size = "md" }) {
  const t = tone(toneName);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs",
        t.chip,
        className
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", t.dot)} /> : null}
      {children}
    </span>
  );
}

export function Dot({ toneName = "neutral", pulse = false, className }) {
  const t = tone(toneName);
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      {pulse ? (
        <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-60", t.dot)} />
      ) : null}
      <span className={cn("relative inline-flex size-2 rounded-full", t.dot)} />
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Stats
 * ------------------------------------------------------------------------ */

export function Stat({ label, value, sub, toneName, mono = true, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="fd-eyebrow text-ink-muted">{label}</div>
      <div
        className={cn(
          "mt-2 text-ink",
          mono ? "fd-metric-sm" : "text-xl font-semibold tracking-tight"
        )}
        style={toneName ? { color: `var(--fd-${toneName})` } : undefined}
      >
        {value}
      </div>
      {sub ? <div className="fd-caption text-ink-muted mt-1.5">{sub}</div> : null}
    </div>
  );
}

export function StatGrid({ columns = 4, children, className }) {
  return (
    <div
      className={cn("grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-line", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

export function StatCell({ children, className }) {
  return <div className={cn("bg-surface px-5 py-4", className)}>{children}</div>;
}

/* ---------------------------------------------------------------------------
 * Buttons
 * ------------------------------------------------------------------------ */

const BUTTON_TONES = {
  primary: "bg-primary text-primary-contrast hover:bg-primary-hover shadow-fd-sm",
  secondary: "bg-surface text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-muted",
  soft: "bg-primary-soft text-primary ring-1 ring-inset ring-primary-line hover:bg-primary-soft/70",
  ghost: "text-ink-secondary hover:bg-surface-muted hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 shadow-fd-sm",
  success: "bg-success text-white hover:brightness-110 shadow-fd-sm",
  warning: "bg-warning text-white hover:brightness-110 shadow-fd-sm",
};

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-[0.9375rem] gap-2 rounded-xl",
};

const buttonClass = (variant = "primary", size = "md", className) =>
  cn(
    "inline-flex items-center justify-center font-semibold transition-all duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:opacity-45 disabled:pointer-events-none select-none",
    BUTTON_SIZES[size],
    BUTTON_TONES[variant],
    className
  );

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}) {
  if (rest.href) {
    const { href, ...linkRest } = rest;
    return (
      <Link href={href} className={buttonClass(variant, size, className)} {...linkRest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------------------
 * Data display
 * ------------------------------------------------------------------------ */

export function KeyValue({ items, columns = 2, className }) {
  return (
    <dl
      className={cn("grid gap-x-6 gap-y-3.5", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="fd-caption text-ink-muted">{label}</dt>
          <dd className="fd-body-sm text-ink mt-0.5 font-medium break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Hash({ value, head = 10, tail = 4, className, mono = true }) {
  if (!value) return <span className="text-ink-muted">—</span>;
  const short = value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
  return (
    <span
      className={cn(mono && "fd-hash", "text-ink-secondary", className)}
      title={value}
      data-full={value}
    >
      {short}
    </span>
  );
}

export function Table({ columns, rows, empty = "Nothing to show.", className, dense = false }) {
  if (!rows.length) {
    return (
      <div className="fd-body-sm text-ink-muted px-5 py-10 text-center">{empty}</div>
    );
  }
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "fd-eyebrow text-ink-muted whitespace-nowrap px-3 py-2.5 font-semibold",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  !col.align && "text-left"
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.key ?? i}
              className="border-b border-line last:border-0 hover:bg-surface-muted/70 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    dense ? "px-3 py-2" : "px-3 py-3",
                    "align-middle",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                >
                  {col.render ? col.render(row, i) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const FILL_TONES = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-ink-muted",
};

export function Progress({ value, toneName = "primary", className, height = "h-1.5", label }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-sunken", height, className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", FILL_TONES[toneName] || FILL_TONES.primary)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Thin usage bar that turns warning/danger as it approaches the cap. */
export function Meter({ value, max, toneName, className }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const auto = pct >= 100 ? "danger" : pct >= 85 ? "warning" : "success";
  return <Progress value={pct} toneName={toneName || auto} className={className} />;
}

export function EmptyState({ title, body, action, icon = null }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-ink-muted">{icon}</div> : null}
      <h3 className="fd-card-title text-ink">{title}</h3>
      {body ? <p className="fd-body-sm text-ink-muted mt-1.5 max-w-md">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Callout({ title, children, toneName = "info", className }) {
  const t = tone(toneName);
  return (
    <div className={cn("rounded-xl px-4 py-3.5 ring-1 ring-inset", t.chip, className)}>
      {title ? <div className="fd-eyebrow mb-1.5">{title}</div> : null}
      <div className="fd-body-sm text-ink leading-relaxed">{children}</div>
    </div>
  );
}

/** Page-level header used on every screen. */
export function PageHeader({ eyebrow, title, subtitle, actions, breadcrumb, className }) {
  return (
    <header className={cn("mb-7", className)}>
      {breadcrumb ? <div className="mb-3">{breadcrumb}</div> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <div className="fd-eyebrow text-primary mb-2.5">{eyebrow}</div> : null}
          <h1 className="fd-page-title text-ink">{title}</h1>
          {subtitle ? <p className="fd-lede mt-2.5 max-w-3xl">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Breadcrumb({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="fd-caption text-ink-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.label} className="flex items-center gap-1.5">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="hover:text-primary transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink-secondary">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
