import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import LabExploreClient from "./LabExploreClient";

export const dynamic = "force-dynamic";

export default async function LabExplorePage() {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const enabled = isAdmin || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    redirect("/");
  }

  return <LabExploreClient isLoggedIn={true} isAdmin={isAdmin} />;
}
