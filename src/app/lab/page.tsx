import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import LabClient from "./LabClient";

export const dynamic = "force-dynamic";

export default async function LabPage() {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const enabled = isAdmin || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    redirect("/");
  }

  return <LabClient isLoggedIn={true} isAdmin={isAdmin} />;
}
