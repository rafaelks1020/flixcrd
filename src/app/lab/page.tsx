import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { hasLabAccess } from "@/lib/lab-access";
import LabClient from "./LabClient";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const userId = session?.user?.id;
  const userRole = session?.user?.role;
  const isAdmin = userRole === "ADMIN";

  if (!userId) {
    redirect("/login");
  }

  const hasAccess = await hasLabAccess(userId, userRole);

  if (!hasAccess) {
    redirect("/");
  }

  return <LabClient isLoggedIn={true} isAdmin={isAdmin} />;
}
