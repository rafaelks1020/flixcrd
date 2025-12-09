import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import RequestDetailClient from "./RequestDetailClient";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function SolicitacaoPage(context: RouteContext) {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const { id } = await context.params;
  const isAdmin = session?.user?.role === "ADMIN";

  return <RequestDetailClient id={id} isLoggedIn={true} isAdmin={isAdmin} />;
}
