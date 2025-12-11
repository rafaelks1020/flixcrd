import { EmailStatus } from "@/types/email";

import { recordEmailLog, type EmailLogMeta } from "@/lib/email-log";

type Recipient =
  | string
  | {
      email: string;
      name?: string;
    };

export type SendMailArgs = {
  to: Recipient | Recipient[];
  subject: string;
  text?: string;
  html?: string;
  fromEmail?: string;
  fromName?: string;
  meta?: EmailLogMeta;
  context?: unknown;
};

const RESEND_API_KEY = process.env.RESEND_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "no-reply@pflix.com.br";
const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Pflix";
const RESEND_API_URL = "https://api.resend.com/emails";

function normalizeRecipients(to: Recipient | Recipient[]) {
  const list = Array.isArray(to) ? to : [to];
  return list.map((item) =>
    typeof item === "string"
      ? { email: item }
      : { email: item.email, name: item.name },
  );
}

function safeParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  fromEmail,
  fromName,
  meta,
  context,
}: SendMailArgs) {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_KEY não configurado");
  }

  const senderEmail = fromEmail || RESEND_FROM_EMAIL;
  const senderName = fromName || RESEND_FROM_NAME;

  if (!senderEmail) {
    throw new Error("Remetente de email não configurado");
  }

  if (!text && !html) {
    throw new Error("Informe text ou html para o email");
  }

  const recipients = normalizeRecipients(to);
  const toEmails = recipients.map((r) => r.email);
  const toList = toEmails.join(", ");

  const from = `${senderName} <${senderEmail}>`;

  let providerResponse: unknown = undefined;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: toEmails,
        subject,
        html,
        text,
      }),
    });

    const bodyText = await res.text();
    providerResponse = safeParseJson(bodyText);

    if (!res.ok) {
      const message =
        (providerResponse as any)?.message ||
        (providerResponse as any)?.error ||
        `Resend error ${res.status}`;

      await recordEmailLog({
        status: EmailStatus.ERROR,
        to: toList,
        subject,
        fromEmail: senderEmail,
        fromName: senderName,
        meta,
        context,
        providerResponse,
        errorMessage: String(message),
      }).catch((logErr) => {
        console.error("[EmailLog] Falha ao registrar erro de email:", logErr);
      });

      throw new Error(String(message));
    }

    void recordEmailLog({
      status: EmailStatus.SUCCESS,
      to: toList,
      subject,
      fromEmail: senderEmail,
      fromName: senderName,
      meta,
      context,
      providerResponse,
    });

    return providerResponse;
  } catch (err: any) {
    const errorMessage =
      err instanceof Error ? err.message : String(err ?? "Erro desconhecido");

    await recordEmailLog({
      status: EmailStatus.ERROR,
      to: toList,
      subject,
      fromEmail: senderEmail,
      fromName: senderName,
      meta,
      context,
      providerResponse,
      errorMessage,
    }).catch((logErr) => {
      console.error("[EmailLog] Falha ao registrar erro de email:", logErr);
    });

    throw err;
  }
}

