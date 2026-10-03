import Link from "next/link";
import { Card, PageHeader } from "../../../components/ui.js";

export const metadata={title:"Email verified"};
export default function VerifiedPage(){return <div className="mx-auto max-w-2xl px-5 py-16 sm:px-7"><PageHeader eyebrow="Account verified" title="You’re ready to sign in" subtitle="Your verified email can now be used to enter events."/><Card className="p-5"><Link className="text-primary font-semibold" href="/auth">Continue to sign in →</Link></Card></div>;}
