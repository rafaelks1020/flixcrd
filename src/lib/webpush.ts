import webpush from "web-push";

import { prisma } from "@/lib/prisma";

export type WebPushPayload = {
  title: string;
  message: string;
  data?: Record<string, unknown>;
};

type WebPushSubscriptionRecord = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getVapidConfig() {
  const publicKey = process.env.WEBPUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEBPUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEBPUSH_VAPID_SUBJECT || process.env.NEXTAUTH_URL;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Web Push não configurado: defina WEBPUSH_VAPID_PUBLIC_KEY, WEBPUSH_VAPID_PRIVATE_KEY e WEBPUSH_VAPID_SUBJECT (ou NEXTAUTH_URL).",
    );
  }

  return { publicKey, privateKey, subject };
}

export function getWebPushPublicKey(): string {
  return getVapidConfig().publicKey;
}

function ensureWebPushConfigured() {
  const { subject, publicKey, privateKey } = getVapidConfig();
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function sendWebPushToSubscriptions(
  subs: WebPushSubscriptionRecord[],
  payload: WebPushPayload,
): Promise<{ total: number; sent: number; failed: number }> {
  if (!subs.length) {
    return { total: 0, sent: 0, failed: 0 };
  }

  ensureWebPushConfigured();

  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (err: any) {
      failed += 1;
      const statusCode = typeof err?.statusCode === "number" ? err.statusCode : null;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.webPushSubscription.updateMany({
          where: { endpoint: sub.endpoint },
          data: { isActive: false },
        });
      }
    }
  }

  return { total: subs.length, sent, failed };
}
