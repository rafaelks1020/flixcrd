import { EmailStatus } from "@/types/email";
import Mailjet from "node-mailjet";

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

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const MAILJET_FROM_EMAIL = process.env.MAILJET_FROM_EMAIL;
const MAILJET_FROM_NAME = process.env.MAILJET_FROM_NAME || "Pflix";

let mailjetClient: ReturnType<typeof Mailjet.apiConnect> | null = null;

function getClient() {
  if (!mailjetClient) {
    if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
      throw new Error("MAILJET_API_KEY/MAILJET_SECRET_KEY não configurados");
    }
    mailjetClient = Mailjet.apiConnect(MAILJET_API_KEY, MAILJET_SECRET_KEY);
  }
  return mailjetClient;
}

function normalizeRecipients(to: Recipient | Recipient[]) {
  const list = Array.isArray(to) ? to : [to];
  return list.map((item) =>
    typeof item === "string"
      ? { Email: item }
      : { Email: item.email, Name: item.name },
  );
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
  const client = getClient();

  const senderEmail = fromEmail || MAILJET_FROM_EMAIL;
  const senderName = fromName || MAILJET_FROM_NAME;

  if (!senderEmail) {
    throw new Error("MAILJET_FROM_EMAIL não configurado");
  }

  if (!text && !html) {
    throw new Error("Informe text ou html para o email");
  }

  const recipients = normalizeRecipients(to);

  const payload = {
    Messages: [
      {
        From: {
          Email: senderEmail,
          Name: senderName,
        },
        To: recipients,
        Subject: subject,
        TextPart: text,
        HTMLPart: html,
      },
    ],
  };

  const toList = recipients.map((r) => r.Email).join(", ");

  try {
    const res = await client.post("send", { version: "v3.1" }).request(payload);

    // Registro de sucesso (não bloqueante)
    void recordEmailLog({
      status: EmailStatus.SUCCESS,
      to: toList,
      subject,
      fromEmail: senderEmail,
      fromName: senderName,
      meta,
      context,
      providerResponse: res.body,
    });

    return res.body;
  } catch (err: any) {
    const errorMessage =
      err instanceof Error ? err.message : String(err ?? "Erro desconhecido");
    const providerResponse = err?.response?.body ?? err;

    // Registro de erro (tentativa melhor-esforço)
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

