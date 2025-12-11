import { prisma } from "@/lib/prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type NotificationCategory = "newContent" | "updates" | "recommendations";

type PushPayload = {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  category?: NotificationCategory;
  channelId?: string;
  sound?: "default" | null;
};

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  channelId?: string;
}

type PreferenceShape = {
  newContent: boolean;
  updates: boolean;
  recommendations: boolean;
};

export interface PushResult {
  total: number;
  sent: number;
  failed: number;
}

export function userAllowsCategory(
  preference: PreferenceShape | null,
  category: NotificationCategory | undefined,
): boolean {
  if (!category) return true;
  if (!preference) return true;
  return preference[category] ?? true;
}

type TokenWithPreference = {
  token: string;
  User?: {
    NotificationPreference?: PreferenceShape | null;
  } | null;
};

export function filterTokensByPreference<T extends TokenWithPreference>(
  records: T[],
  category?: NotificationCategory,
) {
  return records
    .filter((record) =>
      userAllowsCategory(record.User?.NotificationPreference ?? null, category),
    )
    .map((record) => record.token);
}

async function fetchTokensForUsers(userIds: string[], category?: NotificationCategory) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return [];
  }

  const tokenRecords = await prisma.pushToken.findMany({
    where: {
      userId: { in: uniqueIds },
      isActive: true,
    },
    select: {
      token: true,
      userId: true,
      User: {
        select: {
          NotificationPreference: true,
        },
      },
    },
  });

  return filterTokensByPreference(tokenRecords, category);
}

export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<PushResult> {
  if (!tokens.length) {
    return { total: 0, sent: 0, failed: 0 };
  }
  const messages: ExpoPushMessage[] = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.message,
    data: payload.data ?? {},
    sound: payload.sound ?? "default",
    channelId: payload.channelId,
  }));

  let sent = 0;
  let failed = 0;

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

      if (res.ok) {
        const result = await res.json();
        if (Array.isArray(result.data)) {
          for (let idx = 0; idx < result.data.length; idx++) {
            const item = result.data[idx];
            if (item.status === "ok") {
              sent += 1;
            } else {
              failed += 1;
              if (item.details?.error === "DeviceNotRegistered") {
                const failedToken = chunk[idx]?.to;
                if (failedToken) {
                  await prisma.pushToken.updateMany({
                    where: { token: failedToken },
                    data: { isActive: false },
                  });
                }
              }
            }
          }
        } else {
          sent += chunk.length;
        }
      } else {
        failed += chunk.length;
      }
    } catch (error) {
      console.error("Expo push network error:", error);
      failed += chunk.length;
    }
  }

  return { total: messages.length, sent, failed };
}

/**
 * Envia push notifications via Expo para todos os tokens dos usuários informados.
 * Não lança erro para não quebrar o fluxo principal; apenas loga.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
  try {
    if (!userIds.length) {
      return { total: 0, sent: 0, failed: 0 };
    }

    const tokens = await fetchTokensForUsers(userIds, payload.category);
    if (!tokens.length) {
      return { total: 0, sent: 0, failed: 0 };
    }

    return await sendPushToTokens(tokens, payload);
  } catch (err) {
    console.error("sendPushToUsers error:", err);
    return { total: 0, sent: 0, failed: 0 };
  }
}
