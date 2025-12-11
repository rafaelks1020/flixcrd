import { NextRequest, NextResponse } from "next/server";
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

// GET - Lista tokens e estatísticas com paginação
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as { role?: string } | undefined;

    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const pageSize = Math.min(Math.max(limit, 1), 200);
    const skip = (page - 1) * pageSize;

    // Buscar página de tokens com informações do usuário
    const tokens: PushTokenRecord[] = await prisma.pushToken.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    // Buscar informações dos usuários
    const userIds: string[] = [...new Set(tokens.map((t: PushTokenRecord) => t.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const tokensWithUsers = tokens.map((token: PushTokenRecord) => ({
      ...token,
      User: userMap.get(token.userId) || null,
    }));

    // Calcular estatísticas globais (não só da página atual)
    const [
      totalTokens,
      activeTokens,
      androidTokens,
      iosTokens,
      webTokens,
    ] = await Promise.all([
      prisma.pushToken.count(),
      prisma.pushToken.count({ where: { isActive: true } }),
      prisma.pushToken.count({ where: { platform: { equals: "android", mode: "insensitive" } } }),
      prisma.pushToken.count({ where: { platform: { equals: "ios", mode: "insensitive" } } }),
      prisma.pushToken.count({ where: { platform: { equals: "web", mode: "insensitive" } } }),
    ]);

    const stats = {
      totalTokens,
      activeTokens,
      androidTokens,
      iosTokens,
      webTokens,
    };

    const totalPages = Math.max(1, Math.ceil(totalTokens / pageSize));

    return NextResponse.json({
      tokens: tokensWithUsers,
      stats,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Erro ao carregar notificações" },
      { status: 500 }
    );
  }
}
