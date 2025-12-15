import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { calculatePeriodEnd } from "@/lib/asaas";
import { getInterPixCob } from "@/lib/inter";
import { sendMail } from "@/lib/mailjet";

type InterPixCallbackItem = {
  endToEndId?: string;
  txid?: string;
  txId?: string;
  chave?: string;
  valor?: string;
  horario?: string;
  infoPagador?: string;
  componentesValor?: unknown;
  devolucoes?: unknown;
};

function getHeader(request: NextRequest, names: string[]): string | null {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return value;
  }
  return null;
}

function parseMoney(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const normalized = input.replace(",", ".").trim();
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function almostEqualMoney(a: number, b: number): boolean {
  return Math.abs(a - b) <= 0.01;
}

function extractPixItems(payload: unknown): InterPixCallbackItem[] {
  if (Array.isArray(payload)) return payload as InterPixCallbackItem[];
  if (!payload || typeof payload !== "object") return [];

  const maybe = payload as any;
  if (Array.isArray(maybe.pix)) return maybe.pix as InterPixCallbackItem[];
  if (Array.isArray(maybe.pixRecebidos)) return maybe.pixRecebidos as InterPixCallbackItem[];

  return [];
}

function extractTxid(item: InterPixCallbackItem): string {
  const txid = String((item as any)?.txid || (item as any)?.txId || "").trim();
  return txid;
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.INTER_WEBHOOK_TOKEN || process.env.INTER_PIX_WEBHOOK_TOKEN;
    const mustValidate = process.env.NODE_ENV === "production" || Boolean(expectedToken);

    if (mustValidate) {
      if (!expectedToken) {
        return NextResponse.json(
          { error: "INTER_WEBHOOK_TOKEN não configurado" },
          { status: 500 },
        );
      }

      const receivedToken = getHeader(request, [
        "x-webhook-token",
        "x-inter-webhook-token",
        "inter-webhook-token",
      ]);

      if (!receivedToken || receivedToken !== expectedToken) {
        return NextResponse.json({ error: "Webhook não autorizado" }, { status: 401 });
      }
    }

    const payload = await request.json();

    const items = extractPixItems(payload);

    if (!items.length) {
      console.log("[Webhook Inter Pix] Payload inválido (sem itens pix)");
      return NextResponse.json({ received: true, message: "Invalid payload" }, { status: 200 });
    }

    const results: Array<{ txid: string; action: string }> = [];

    for (const item of items) {
      const txid = extractTxid(item);
      if (!txid) continue;

      const dbPixPayment = await prisma.pixPayment.findUnique({
        where: { txid },
        include: {
          Subscription: {
            include: {
              User: true,
            },
          },
        },
      });

      if (!dbPixPayment) {
        console.log(`[Webhook Inter Pix] txid não encontrado no banco: ${txid}`);
        results.push({ txid, action: "not_found" });
        continue;
      }

      if (dbPixPayment.status === "PAID") {
        await prisma.pixPayment.update({
          where: { id: dbPixPayment.id },
          data: { rawWebhookPayload: payload },
        });
        results.push({ txid, action: "already_paid" });
        continue;
      }

      let cob;
      try {
        cob = await getInterPixCob(txid);
      } catch (err) {
        console.error(`[Webhook Inter Pix] Falha ao consultar cobrança no Inter (txid=${txid})`, err);
        return NextResponse.json(
          { error: "Falha ao confirmar cobrança no Inter" },
          { status: 502 },
        );
      }

      const interStatus = String(cob?.status || "").toUpperCase();
      const cobValor = parseMoney(cob?.valor?.original);
      const callbackValor = parseMoney(item?.valor);

      const expectedValor = dbPixPayment.valor;
      const receivedValor = cobValor ?? callbackValor;

      if (receivedValor == null || !almostEqualMoney(receivedValor, expectedValor)) {
        console.error(
          `[Webhook Inter Pix] Valor divergente txid=${txid} esperado=${expectedValor} recebido=${receivedValor}`,
        );
        results.push({ txid, action: "value_mismatch" });
        continue;
      }

      if (interStatus === "CONCLUIDA") {
        const now = new Date();
        const periodEnd = calculatePeriodEnd(now);

        let activated = false;

        await prisma.$transaction(async (tx) => {
          const updatedPix = await tx.pixPayment.updateMany({
            where: {
              id: dbPixPayment.id,
              paidAt: null,
            },
            data: {
              status: "PAID",
              paidAt: now,
              rawWebhookPayload: payload,
            },
          });

          if (updatedPix.count === 0) {
            return;
          }

          activated = true;

          if (dbPixPayment.subscriptionId) {
            await tx.subscription.update({
              where: { id: dbPixPayment.subscriptionId },
              data: {
                status: "ACTIVE",
                asaasPaymentId: txid,
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
              },
            });
          }

          await tx.payment.updateMany({
            where: {
              asaasPaymentId: txid,
              paymentDate: null,
            },
            data: {
              status: "RECEIVED",
              paymentDate: now,
            },
          });
        });

        if (!activated) {
          results.push({ txid, action: "already_paid" });
          continue;
        }

        if (dbPixPayment.Subscription?.User) {
          const user = dbPixPayment.Subscription.User;
          const planName = dbPixPayment.Subscription.plan === "DUO" ? "Plano Duo" : "Plano Basic";

          try {
            await sendMail({
              to: user.email,
              subject: `✅ Pagamento Confirmado - ${planName}`,
              fromEmail: "financeiro@pflix.com.br",
              fromName: "Financeiro FlixCRD",
              meta: {
                reason: "payment-webhook",
                userId: dbPixPayment.Subscription.userId,
                subscriptionId: dbPixPayment.subscriptionId ?? undefined,
                paymentId: txid,
                event: "INTER_PIX_PAID",
              },
              context: {
                value: dbPixPayment.valor,
                status: "RECEIVED",
              },
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #00cc00;">✅ Pagamento Confirmado!</h2>
                  <p>Olá, ${user.name || "usuário"}!</p>
                  <p>Seu pagamento foi confirmado e sua assinatura está ativa! 🎉</p>
                  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Plano:</strong> ${planName}</p>
                    <p><strong>Valor pago:</strong> R$ ${Number(dbPixPayment.valor).toFixed(2).replace(".", ",")}</p>
                    <p><strong>Válido até:</strong> ${periodEnd.toLocaleDateString("pt-BR")}</p>
                  </div>
                  <p style="text-align: center;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://pflix.com.br"}"
                       style="background-color: #e50914; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; display: inline-block;">
                      🎬 Começar a assistir
                    </a>
                  </p>
                  <p style="color: #666; font-size: 14px;">Aproveite todo o conteúdo disponível na plataforma!</p>
                </div>
              `,
              text: `
✅ Pagamento Confirmado!

Olá, ${user.name || "usuário"}!

Seu pagamento foi confirmado e sua assinatura está ativa! 🎉

Plano: ${planName}
Valor pago: R$ ${Number(dbPixPayment.valor).toFixed(2).replace(".", ",")}
Válido até: ${periodEnd.toLocaleDateString("pt-BR")}

Acesse: ${process.env.NEXT_PUBLIC_APP_URL || "https://pflix.com.br"}
              `,
            });
          } catch (emailError) {
            console.error("[Webhook Inter Pix] Erro ao enviar email de confirmação:", emailError);
          }
        }

        results.push({ txid, action: "paid" });
        continue;
      }

      if (interStatus.startsWith("REMOVIDA")) {
        await prisma.pixPayment.updateMany({
          where: {
            id: dbPixPayment.id,
            status: "PENDING",
          },
          data: {
            status: "EXPIRED",
            rawWebhookPayload: payload,
          },
        });
        results.push({ txid, action: "expired" });
        continue;
      }

      await prisma.pixPayment.update({
        where: { id: dbPixPayment.id },
        data: {
          rawWebhookPayload: payload,
        },
      });

      results.push({ txid, action: "ignored" });
    }

    return NextResponse.json({ received: true, results }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook Inter Pix] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro no webhook" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook Inter Pix endpoint ativo",
    timestamp: new Date().toISOString(),
  });
}
