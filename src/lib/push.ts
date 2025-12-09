import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type PushPayload = {
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
}

/**
 * Envia push notifications via Expo para todos os tokens dos usuários informados.
 * Não lança erro para não quebrar o fluxo principal; apenas loga.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  try {
    if (!userIds.length) return;

    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (!uniqueIds.length) return;

    const tokens = await prisma.pushToken.findMany({
      where: {
        userId: { in: uniqueIds },
        isActive: true,
      },
      select: { token: true },
    });

    if (!tokens.length) return;

    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.message,
      data: payload.data ?? {},
      sound: "default",
    }));

    // Enviar em pequenos lotes (100 por request)
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(chunk),
        });

        if (!res.ok) {
          // Não interrompe o fluxo; apenas loga
          // eslint-disable-next-line no-console
          console.error("Expo push error:", await res.text());
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Expo push network error:", err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("sendPushToUsers error:", err);
  }
}
