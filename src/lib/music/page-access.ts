import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/subscription";

export async function requireMusicPage(callbackPath: string) {
  const session: any = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }

  const role = (session.user.role as string | undefined) ?? "USER";
  if (role !== "ADMIN") {
    const active = await hasActiveSubscription(userId);
    if (!active) redirect("/subscribe");
  }

  return {
    userId,
    role,
    name: (session.user.name as string | null | undefined) ?? null,
    email: (session.user.email as string | null | undefined) ?? null,
  };
}
