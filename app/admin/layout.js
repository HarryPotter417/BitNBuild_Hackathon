import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "../../server/data.js";

const navigation=[
  ["/admin","Overview"],["/admin/events","Events"],["/admin/fairness","Fairness"],
  ["/admin/adversarial","Adversarial lab"],["/admin/audit","Audit log"],["/admin/system","System health"],
];

export const dynamic="force-dynamic";

export default async function AdminLayout({children}){
  const user=await getCurrentUser();
  if(!user)redirect("/auth");
  if(user.role!=="admin")notFound();
  return <div className="theme-dark -mt-16 min-h-screen bg-bg pt-16 text-ink">
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[1600px]">
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface px-4 py-7 lg:block">
        <p className="fd-eyebrow px-3 text-ink-muted">Fair Drop Admin</p>
        <nav aria-label="Admin navigation" className="mt-5 space-y-1">{navigation.map(([href,label])=><Link key={href} href={href} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink">{label}</Link>)}</nav>
        <div className="mt-8 border-t border-line pt-4"><Link href="/" className="fd-caption px-3 text-ink-muted hover:text-ink">← Public site</Link></div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-10">{children}</main>
    </div>
    <nav aria-label="Admin mobile navigation" className="fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-line bg-surface px-2 py-2 lg:hidden">{navigation.map(([href,label])=><Link key={href} href={href} className="shrink-0 rounded-md px-3 py-2 text-xs font-medium text-ink-secondary">{label}</Link>)}</nav>
  </div>;
}
