import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import LabWatchClient from "./LabWatchClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ type?: string; id?: string; season?: string; episode?: string; tmdb?: string }>;
}

export default async function LabWatchPage({ searchParams }: PageProps) {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const enabled = isAdmin || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    redirect("/");
  }

  const params = await searchParams;

  return (
    <LabWatchClient
      isLoggedIn={true}
      isAdmin={isAdmin}
      type={(params.type as "filme" | "serie") || "filme"}
      contentId={params.id || ""}
      initialSeason={params.season || "1"}
      initialEpisode={params.episode || "1"}
      tmdbId={params.tmdb || ""}
    />
  );
}
