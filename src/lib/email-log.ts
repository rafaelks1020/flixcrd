import { randomUUID } from "crypto";

import { EmailStatus } from "@/types/email";

import { prisma } from "@/lib/prisma";

export type EmailLogMeta = {
  reason?: string;
  userId?: string;
  requestId?: string;
  paymentId?: string;
  subscriptionId?: string;
  event?: string;
  extra?: Record<string, unknown>;
};

function serializeForJson(value: unknown, maxLength = 8000) {
  if (value === undefined) return undefined;

  try {
    const str = JSON.stringify(value, (_key, val) => val ?? null);
    if (!str) return undefined;

    if (str.length > maxLength) {
      return {
        truncated: true,
        preview: str.slice(0, maxLength),
      };
    }

    return JSON.parse(str);
  } catch (err) {
    return {
      raw: String(err instanceof Error ? err.message : value),
    };
  }
}

export async function recordEmailLog({
  status,
  to,
  subject,
  fromEmail,
  fromName,
  meta,
  context,
  providerResponse,
  errorMessage,
}: {
  status: EmailStatus;
  to: string;
  subject: string;
  fromEmail?: string;
  fromName?: string;
  meta?: EmailLogMeta;
  context?: unknown;
  providerResponse?: unknown;
  errorMessage?: string;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        id: randomUUID(),
        status,
        to,
        subject,
        fromEmail,
        fromName,
        reason: meta?.reason,
        context: serializeForJson({
          ...meta,
          extra: meta?.extra,
          context,
        }),
        providerResponse: serializeForJson(providerResponse),
        errorMessage,
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[EmailLog] Falha ao registrar log:", err);
  }
}




