import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session: any = await getServerSession(authOptions as any);

  if (!session || !session.user || !session.user.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id as string },
    select: { useCloudflareProxy: true },
  });

  return <SettingsClient initialUseCloudflareProxy={user?.useCloudflareProxy ?? false} />;
}
