import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { hasLabAccess } from "@/lib/lab-access";
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
