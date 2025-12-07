import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PushTokenRecord {
  id: string;
  userId: string;
  token: string;
  platform: string;
  deviceName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// GET - Lista todos os tokens e estatísticas
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Buscar todos os tokens com informações do usuário
    const tokens: PushTokenRecord[] = await prisma.pushToken.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Buscar informações dos usuários
    const userIds: string[] = [...new Set(tokens.map((t: PushTokenRecord) => t.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    const userMap = new Map(users.map(u => [u.id, u]));

    const tokensWithUsers = tokens.map((token: PushTokenRecord) => ({
      ...token,
      user: userMap.get(token.userId) || null,
    }));

    // Calcular estatísticas
    const stats = {
      totalTokens: tokens.length,
      activeTokens: tokens.filter((t: PushTokenRecord) => t.isActive).length,
      androidTokens: tokens.filter((t: PushTokenRecord) => t.platform.toLowerCase() === "android").length,
      iosTokens: tokens.filter((t: PushTokenRecord) => t.platform.toLowerCase() === "ios").length,
      webTokens: tokens.filter((t: PushTokenRecord) => t.platform.toLowerCase() === "web").length,
    };

    return NextResponse.json({ tokens: tokensWithUsers, stats });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Erro ao carregar notificações" },
      { status: 500 }
    );
  }
}
