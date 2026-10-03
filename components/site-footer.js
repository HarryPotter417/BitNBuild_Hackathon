import Link from "next/link";
import { Logo } from "./event-art";

const COLUMNS = [
  {
    title: "Attend",
    links: [
      { href: "/events", label: "All events" },
      { href: "/events?state=OPEN", label: "Open for entries" },
      { href: "/me", label: "My entries" },
      { href: "/me/history", label: "Allocation history" },
    ],
  },
  {
    title: "Transparency",
    links: [
      { href: "/me/verify/tech-summit-2026", label: "Verify a draw" },
      { href: "/events/tech-summit-2026", label: "Fairness report" },
      { href: "/#how-it-works", label: "How it works" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-bg-alt">
      <div className="mx-auto max-w-[1240px] px-5 py-14 sm:px-7">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(2,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo size={28} />
              <span className="text-[0.9375rem] font-bold tracking-[-0.02em] text-ink">Fair Drop</span>
            </div>
            <p className="fd-body-sm text-ink-muted mt-3.5 max-w-xs">
              Provably fair event allocation. One entry per person, a participant set nobody can
              edit, and a draw anyone can re-run and check.
            </p>
            <p className="fd-caption text-ink-muted mt-5 max-w-xs">
              This build runs against a simulated backend. Participant counts and winners come out
              of a real HMAC-SHA256 draw; everything else is generated fixture data.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="fd-eyebrow text-ink-muted mb-3.5">{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="fd-body-sm text-ink-secondary transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <p className="fd-caption text-ink-muted">
            © {new Date().getFullYear()} Fair Drop. Built for GDG Cloud Summit.
          </p>
          <p className="fd-caption text-ink-muted">
            Draw algorithm <span className="font-mono text-ink-secondary">commit-reveal · HMAC-SHA256</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
