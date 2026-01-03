import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { hasLabAccess } from "@/lib/lab-access";
import { getSuperflixUrl } from "@/lib/app-settings";
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

  const params = await searchParams;
  const superflixApiUrl = await getSuperflixUrl();

  return (
    <LabWatchClient
      isLoggedIn={true}
      isAdmin={isAdmin}
      type={(params.type as "filme" | "serie") || "filme"}
      contentId={params.id || ""}
      initialSeason={params.season || "1"}
      initialEpisode={params.episode || "1"}
      tmdbId={params.tmdb || ""}
      superflixApiUrl={superflixApiUrl}
    />
  );
}

