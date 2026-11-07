import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/subscription";
import { MusicError } from "./errors";

export async function requireMusicAccess(): Promise<{ userId: string; role: string }> {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) throw new MusicError(401, "Autenticação necessária");
  const role = user.role ?? "USER";
  if (role !== "ADMIN" && !(await hasActiveSubscription(user.id))) throw new MusicError(403, "Assinatura ativa necessária");
  return { userId: user.id, role };
}
