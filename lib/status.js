/**
 * Single source of truth for status → visual tone mapping.
 * Every badge, dot, chart series and table cell reads from here, so a status
 * looks identical on the public site and in the admin control centre.
 */

export const TONES = {
  neutral: {
    chip: "bg-surface-sunken text-ink-secondary ring-line",
    dot: "bg-ink-muted",
    solid: "bg-surface-sunken text-ink",
    text: "text-ink-secondary",
    accent: "var(--fd-text-muted)",
  },
  primary: {
    chip: "bg-primary-soft text-primary ring-primary-line",
    dot: "bg-primary",
    solid: "bg-primary text-primary-contrast",
    text: "text-primary",
    accent: "var(--fd-primary)",
  },
  success: {
    chip: "bg-success-soft text-success ring-success-line",
    dot: "bg-success",
    solid: "bg-success text-white",
    text: "text-success",
    accent: "var(--fd-success)",
  },
  warning: {
    chip: "bg-warning-soft text-warning ring-warning-line",
    dot: "bg-warning",
    solid: "bg-warning text-white",
    text: "text-warning",
    accent: "var(--fd-warning)",
  },
  danger: {
    chip: "bg-danger-soft text-danger ring-danger-line",
    dot: "bg-danger",
    solid: "bg-danger text-white",
    text: "text-danger",
    accent: "var(--fd-danger)",
  },
  info: {
    chip: "bg-info-soft text-info ring-info-line",
    dot: "bg-info",
    solid: "bg-info text-white",
    text: "text-info",
    accent: "var(--fd-info)",
  },
};

export const tone = (name) => TONES[name] || TONES.neutral;

/** Event lifecycle states. `*` marks states where the participant pool is frozen. */
export const EVENT_STATUS = {
  SCHEDULED: { label: "Scheduled", tone: "info", step: 0, joinable: false, frozen: false },
  OPEN: { label: "Open", tone: "success", step: 1, joinable: true, frozen: false },
  FROZEN: { label: "Frozen", tone: "info", step: 2, joinable: false, frozen: true },
  DRAWING: { label: "Drawing", tone: "primary", step: 3, joinable: false, frozen: true },
  CLAIMING: { label: "Claiming", tone: "warning", step: 4, joinable: false, frozen: true },
  CLOSED: { label: "Closed", tone: "neutral", step: 5, joinable: false, frozen: true },
  SOLD_OUT: { label: "Sold Out", tone: "neutral", step: 5, joinable: false, frozen: true },
  CANCELLED: { label: "Cancelled", tone: "danger", step: 5, joinable: false, frozen: true },
};

/** Valid lifecycle transitions, keyed by current state. */
export const EVENT_ACTIONS = {
  SCHEDULED: ["open", "cancel"],
  OPEN: ["freeze", "cancel"],
  FROZEN: ["draw", "cancel"],
  DRAWING: ["start_claiming"],
  CLAIMING: ["close"],
  CLOSED: [],
  SOLD_OUT: [],
  CANCELLED: [],
};

export const EVENT_ACTION_LABEL = {
  schedule: "Schedule",
  open: "Open",
  freeze: "Freeze",
  draw: "Draw",
  start_claiming: "Start Claiming",
  close: "Close",
  cancel: "Cancel",
};

export const EVENT_ACTION_TONE = {
  open: "primary",
  freeze: "warning",
  draw: "primary",
  start_claiming: "primary",
  close: "neutral",
  cancel: "danger",
};

/** A participant's outcome for one event. */
export const ENTRY_STATUS = {
  NONE: { label: "No Entry", tone: "neutral" },
  WAITING: { label: "In Draw", tone: "info" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  SELECTED: { label: "Selected", tone: "warning" },
  WAITLISTED: { label: "Waitlisted", tone: "info" },
  NOT_SELECTED: { label: "Not Selected", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "danger" },
};

export function eventStatus(status) {
  return EVENT_STATUS[status] || EVENT_STATUS.SCHEDULED;
}

export function entryStatus(status) {
  return ENTRY_STATUS[status] || ENTRY_STATUS.NONE;
}

/** Service health → tone, shared by HealthIndicator and System Health. */
export const HEALTH = {
  healthy: { label: "Healthy", tone: "success" },
  degraded: { label: "Degraded", tone: "warning" },
  down: { label: "Down", tone: "danger" },
  unknown: { label: "Unknown", tone: "neutral" },
};
