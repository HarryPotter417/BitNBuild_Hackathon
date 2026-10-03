import { redirect } from "next/navigation";
import { databaseMode, getCurrentUser } from "../../server/data.js";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }) {
  if (databaseMode() && !(await getCurrentUser())) redirect("/auth?next=%2Fme");
  return children;
}
