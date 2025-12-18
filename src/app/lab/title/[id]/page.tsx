import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import LabTitleClient from "./LabTitleClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function LabTitlePage({ params, searchParams }: PageProps) {
  const session: any = await getServerSession(authOptions as any);

  if (!session) {
    redirect("/login");
  }

  const isAdmin = session?.user?.role === "ADMIN";
  const enabled = isAdmin || process.env.NEXT_PUBLIC_LAB_ENABLED === "true";

  if (!enabled) {
    redirect("/");
  }

  const { id } = await params;
  const { type } = await searchParams;

  return (
    <LabTitleClient
      isLoggedIn={true}
      isAdmin={isAdmin}
      tmdbId={id}
      mediaType={(type as "movie" | "tv") || "movie"}
    />
  );
}
