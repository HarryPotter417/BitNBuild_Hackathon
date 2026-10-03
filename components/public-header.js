"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "../lib/cn";
import { Logo } from "./event-art";

const LINKS = [
  { href: "/events", label: "Events" },
  { href: "/me", label: "My Entries" },
  { href: "/me/history", label: "History" },
  { href: "/#how-it-works", label: "How It Works" },
];

export function PublicHeader({ user }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-200",
        scrolled
          ? "border-b border-line bg-bg/85 backdrop-blur-xl"
          : "border-b border-transparent bg-bg"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-5 sm:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Fair Drop home">
          <Logo size={30} />
          <span className="text-[0.95rem] font-bold tracking-[-0.02em] text-ink">Fair Drop</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((link) => {
            const active =
              pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-ink-secondary hover:bg-surface-muted hover:text-ink"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <div className="hidden items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 sm:flex">
              <span
                className="grid size-7 place-items-center rounded-full text-[0.6875rem] font-bold text-white"
                style={{ background: "linear-gradient(135deg, var(--fd-primary), var(--fd-brand-700))" }}
              >
                {user.initials}
              </span>
              <span className="flex flex-col leading-none">
                <span className="text-[0.8125rem] font-semibold text-ink">{user.name}</span>
                <span className="fd-caption text-ink-muted">{user.email}</span>
              </span>
            </div>
          ) : null}

          {!user ? (
            <Link href="/auth" className="hidden h-9 items-center rounded-lg px-3 text-sm font-semibold text-ink-secondary hover:bg-surface-muted sm:inline-flex">Sign in</Link>
          ) : null}

          <Link
            href="/events"
            className="hidden h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-contrast shadow-fd-sm transition-colors hover:bg-primary-hover sm:inline-flex"
          >
            Browse events
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-lg text-ink-secondary ring-1 ring-inset ring-line-strong md:hidden"
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                d={open ? "M4 4 L14 14 M14 4 L4 14" : "M2.5 5.5 H15.5 M2.5 12.5 H15.5"}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface md:hidden">
          <nav className="mx-auto flex max-w-[1240px] flex-col gap-1 px-5 py-4" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-secondary hover:bg-surface-muted hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
