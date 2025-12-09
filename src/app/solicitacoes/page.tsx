import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import SolicitacoesClient from "./SolicitacoesClient";

export const dynamic = "force-dynamic";

export default async function SolicitacoesPage() {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return <SolicitacoesClient isLoggedIn={true} isAdmin={isAdmin} />;
}
