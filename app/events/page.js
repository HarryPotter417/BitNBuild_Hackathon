import Link from "next/link";
import { getUserEntries, listEvents } from "../../server/data.js";
import { eventStatus } from "../../lib/status";
import { formatCompact, formatNumber } from "../../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Stat,
  StatCell,
  StatGrid,
} from "../../components/ui";
import { EventCard } from "../../components/event-card";

export const dynamic = "force-dynamic";

const STATES = ["OPEN", "DRAWING", "CLAIMING", "CLOSED", "SOLD_OUT", "SCHEDULED", "FROZEN"];
const CATEGORIES = [
  "Conference",
  "Summit",
  "Workshop",
  "Forum",
  "Meetup",
  "Festival",
  "Hackathon",
  "Symposium",
  "Open Day",
];

const SORTS = {
  soonest: { label: "Starting soonest", fn: (a, b) => new Date(a.startsAt) - new Date(b.startsAt) },
  demand: { label: "Most demanded", fn: (a, b) => b.participants / b.capacity - a.participants / a.capacity },
  entries: { label: "Most entries", fn: (a, b) => b.participants - a.participants },
  seats: { label: "Most seats", fn: (a, b) => b.capacity - a.capacity },
};

export default async function EventsPage({ searchParams }) {
  const params = await searchParams;
  const state = STATES.includes(params?.state) ? params.state : null;
  const category = CATEGORIES.includes(params?.category) ? params.category : null;
  const city = params?.city || null;
  const q = (params?.q || "").trim().toLowerCase();
  const sort = SORTS[params?.sort] ? params.sort : "soonest";

  const [all,entries] = await Promise.all([listEvents(),getUserEntries()]);
  const outcomes = Object.fromEntries(entries.map(({ event, outcome }) => [event.id, outcome]));
  const cities = [...new Set(all.map((e) => e.city))].sort();

  let events = all.filter((event) => {
    if (state && event.state !== state) return false;
    if (category && event.category !== category) return false;
    if (city && event.city !== city) return false;
    if (q) {
      const haystack = `${event.title} ${event.tagline} ${event.venue} ${event.city} ${event.category}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
  events = [...events].sort(SORTS[sort].fn);

  const buildHref = (next) => {
    const merged = { state, category, city, q: params?.q, sort, ...next };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value && !(key === "sort" && value === "soonest") && !(key === "state" && value === "OPEN")) {
        search.set(key, String(value));
      }
    }
    const qs = search.toString();
    return qs ? `/events?${qs}` : "/events";
  };

  const activeFilters = [
    state ? { key: "state", label: eventStatus(state).label } : null,
    category ? { key: "category", label: category } : null,
    city ? { key: "city", label: city } : null,
    q ? { key: "q", label: `“${params.q}”` } : null,
  ].filter(Boolean);

  const openNow = all.filter((e) => eventStatus(e.state).joinable).length;

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-7">
      <PageHeader
        eyebrow="Catalog"
        title="Events"
        subtitle="Twelve events across five cities, each one allocated by the same provable draw. Filter by state, city or category."
        actions={<Button href="/me">My entries</Button>}
      />

      <StatGrid columns={4} className="mb-8">
        <StatCell>
          <Stat label="Events listed" value={all.length} sub={`${openNow} accepting entries`} />
        </StatCell>
        <StatCell>
          <Stat
            label="Seats on offer"
            value={formatNumber(all.reduce((s, e) => s + e.capacity, 0))}
            sub="across the whole catalog"
          />
        </StatCell>
        <StatCell>
          <Stat
            label="Entries recorded"
            value={formatCompact(all.reduce((s, e) => s + e.participants, 0))}
            sub="one per verified account"
          />
        </StatCell>
        <StatCell>
          <Stat
            label="Join attempts"
            value={formatCompact(all.reduce((s, e) => s + e.joinRequests, 0))}
            sub="most were duplicates"
          />
        </StatCell>
      </StatGrid>

      <div className="grid gap-8 lg:grid-cols-[232px_1fr]">
        {/* ---------------------------------------------------------- */}
        {/* Filters                                                   */}
        {/* ---------------------------------------------------------- */}
        <aside className="space-y-6">
          <div>
            <h2 className="fd-eyebrow text-ink-muted mb-3">Status</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildHref({ state: null })}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    !state ? "bg-primary-soft font-semibold text-primary" : "text-ink-secondary hover:bg-surface-muted"
                  }`}
                >
                  All states
                  <span className="fd-caption text-ink-muted">{all.length}</span>
                </Link>
              </li>
              {STATES.filter((s) => all.some((e) => e.state === s)).map((s) => {
                const count = all.filter((e) => e.state === s).length;
                const active = state === s;
                return (
                  <li key={s}>
                    <Link
                      href={buildHref({ state: s })}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-primary-soft font-semibold text-primary" : "text-ink-secondary hover:bg-surface-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: `var(--fd-${eventStatus(s).tone})` }}
                          aria-hidden="true"
                        />
                        {eventStatus(s).label}
                      </span>
                      <span className="fd-caption text-ink-muted">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <h2 className="fd-eyebrow text-ink-muted mb-3">City</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildHref({ city: null })}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !city ? "bg-primary-soft font-semibold text-primary" : "text-ink-secondary hover:bg-surface-muted"
                  }`}
                >
                  Everywhere
                </Link>
              </li>
              {cities.map((c) => (
                <li key={c}>
                  <Link
                    href={buildHref({ city: c })}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      city === c ? "bg-primary-soft font-semibold text-primary" : "text-ink-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="fd-eyebrow text-ink-muted mb-3">Category</h2>
            <ul className="space-y-1">
              <li>
                <Link
                  href={buildHref({ category: null })}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    !category ? "bg-primary-soft font-semibold text-primary" : "text-ink-secondary hover:bg-surface-muted"
                  }`}
                >
                  All types
                </Link>
              </li>
              {CATEGORIES.filter((c) => all.some((e) => e.category === c)).map((c) => (
                <li key={c}>
                  <Link
                    href={buildHref({ category: c })}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      category === c ? "bg-primary-soft font-semibold text-primary" : "text-ink-secondary hover:bg-surface-muted"
                    }`}
                  >
                    {c}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ---------------------------------------------------------- */}
        {/* Results                                                   */}
        {/* ---------------------------------------------------------- */}
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <form className="flex flex-wrap items-center gap-2" action="/events" method="get">
              {state ? <input type="hidden" name="state" value={state} /> : null}
              {category ? <input type="hidden" name="category" value={category} /> : null}
              {city ? <input type="hidden" name="city" value={city} /> : null}
              <div className="relative">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                >
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  type="search"
                  name="q"
                  defaultValue={params?.q || ""}
                  placeholder="Search events or venues"
                  className="h-9 w-56 rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
                />
              </div>
              <select
                name="sort"
                defaultValue={sort}
                className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink-secondary focus:border-primary focus:outline-none"
              >
                {Object.entries(SORTS).map(([key, { label }]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <Button type="submit" size="sm" variant="secondary">
                Apply
              </Button>
            </form>

            <p className="fd-caption text-ink-muted">
              Showing {events.length} of {all.length}
            </p>
          </div>

          {activeFilters.length ? (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="fd-caption text-ink-muted">Filtered by</span>
              {activeFilters.map((f) => (
                <Link key={f.key} href={buildHref({ [f.key]: null })}>
                  <Badge toneName="primary" size="sm">
                    {f.label}
                    <span aria-hidden="true">×</span>
                  </Badge>
                </Link>
              ))}
              <Link href="/events" className="fd-caption text-ink-muted hover:text-primary">
                Clear all
              </Link>
            </div>
          ) : null}

          {events.length === 0 ? (
            <Card>
              <EmptyState
                title="No events match those filters"
                body="Try widening the status filter, or clear the search."
                action={<Button href="/events">Reset filters</Button>}
              />
            </Card>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} outcome={outcomes[event.id]} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
