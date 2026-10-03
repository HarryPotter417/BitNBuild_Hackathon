import { AuthForm } from "../../components/auth-form.js";
import { PageHeader } from "../../components/ui.js";

export const metadata={title:"Account"};
export const dynamic="force-dynamic";

export default function AuthPage() {
  return <div className="mx-auto max-w-3xl px-5 py-14 sm:px-7"><PageHeader eyebrow="Account" title="Join a draw on fair terms" subtitle="Verified accounts get one entry per event. Your entry and any allocation are stored server-side."/><AuthForm /></div>;
}
