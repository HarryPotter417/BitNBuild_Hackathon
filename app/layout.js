import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PublicHeader } from "../components/public-header";
import { SiteFooter } from "../components/site-footer";
import { getCurrentUser } from "../server/data.js";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Fair Drop — Provably fair event allocation",
    template: "%s · Fair Drop",
  },
  description:
    "One entry per person, a participant set nobody can edit, and a draw anyone can re-run and verify. Fair event allocation for high-demand community events.",
};

export const viewport = {
  themeColor: "#3f45e0",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only-focusable fixed left-4 top-4 z-[100] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast"
        >
          Skip to content
        </a>
        <PublicHeader user={user} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
