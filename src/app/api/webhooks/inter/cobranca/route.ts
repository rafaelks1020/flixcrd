import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { calculatePeriodEnd } from "@/lib/asaas";
import { getInterCobrancaDetalhe } from "@/lib/inter";
import { sendMail } from "@/lib/mailjet";

function getHeader(request: NextRequest, names: string[]): string | null {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) return value;
  }
  return null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (!UUID_RE.test(v)) return null;
  return v;
}

function extractCodigoSolicitacaoCandidates(payload: any): string[] {
  const out = new Set<string>();

  const push = (v: unknown) => {
    const uuid = normalizeUuid(v);
    if (uuid) out.add(uuid);
  };

  push(payload?.codigoSolicitacao);
  push(payload?.cobranca?.codigoSolicitacao);
  push(payload?.data?.codigoSolicitacao);
  push(payload?.resource?.codigoSolicitacao);
  push(payload?.boleto?.codigoSolicitacao);

  if (Array.isArray(payload)) {
    for (const item of payload) {
      push(item?.codigoSolicitacao);
      push(item?.cobranca?.codigoSolicitacao);
      push(item?.data?.codigoSolicitacao);
      push(item?.resource?.codigoSolicitacao);
    }
  }

  if (out.size > 0) return Array.from(out);

  // fallback: varre o objeto e coleta uuids
  const queue: any[] = [payload];
  let steps = 0;

  while (queue.length && steps < 500) {
    steps += 1;
    const node = queue.shift();

    if (typeof node === "string") {
      push(node);
      continue;
    }

    if (!node || typeof node !== "object") continue;

    if (Array.isArray(node)) {
      for (const v of node) queue.push(v);
      continue;
    }

    for (const v of Object.values(node)) {
      queue.push(v);
    }
  }

  return Array.from(out);
}

function shouldActivateFromSituacao(situacaoRaw: string | null | undefined): boolean {
  const s = String(situacaoRaw || "").toUpperCase().trim();
  if (!s) return false;

  // Valores comuns no Inter para cobrança paga variam entre ambientes/versões.
  // Aqui aceitamos padrões robustos.
  if (s.includes("RECEB")) return true;
  if (s.includes("LIQUID")) return true;
  if (s === "PAGO" || s.includes("PAG")) return true;
  if (s.includes("BAIXA")) return true;

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken =
      process.env.INTER_WEBHOOK_TOKEN ||
      process.env.INTER_BOLETO_WEBHOOK_TOKEN ||
      process.env.INTER_COBRANCA_WEBHOOK_TOKEN;

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
    const codigoSolicitacoes = extractCodigoSolicitacaoCandidates(payload);

    if (!codigoSolicitacoes.length) {
      console.log("[Webhook Inter Cobrança] Payload sem codigoSolicitacao reconhecido");
      return NextResponse.json({ received: true, message: "No codigoSolicitacao" }, { status: 200 });
    }

    const results: Array<{ codigoSolicitacao: string; action: string; situacao?: string }> = [];

    for (const codigoSolicitacao of codigoSolicitacoes) {
      const dbPayment = await prisma.payment.findUnique({
        where: { asaasPaymentId: codigoSolicitacao },
        include: {
          Subscription: {
            include: {
              User: true,
            },
          },
        },
      });

      if (!dbPayment) {
        console.log(`[Webhook Inter Cobrança] codigoSolicitacao não encontrado no banco: ${codigoSolicitacao}`);
        results.push({ codigoSolicitacao, action: "not_found" });
        continue;
      }

      if (dbPayment.billingType !== "BOLETO") {
        results.push({ codigoSolicitacao, action: "ignored_not_boleto" });
        continue;
      }

      const alreadyPaid = Boolean(dbPayment.paymentDate) || ["RECEIVED", "CONFIRMED", "PAID"].includes(String(dbPayment.status || "").toUpperCase());
      if (alreadyPaid) {
        results.push({ codigoSolicitacao, action: "already_paid" });
        continue;
      }

      let detalhe;
      try {
        detalhe = await getInterCobrancaDetalhe(codigoSolicitacao);
      } catch (err) {
        console.error(`[Webhook Inter Cobrança] Falha ao consultar cobrança no Inter (codigoSolicitacao=${codigoSolicitacao})`, err);
        return NextResponse.json(
          { error: "Falha ao confirmar cobrança no Inter" },
          { status: 502 },
        );
      }

      const situacao = String(detalhe?.cobranca?.situacao || "").toUpperCase();

      if (!shouldActivateFromSituacao(situacao)) {
        results.push({ codigoSolicitacao, action: "ignored", situacao });
        continue;
      }

      const now = new Date();
      const periodEnd = calculatePeriodEnd(now);

      let activated = false;

      await prisma.$transaction(async (tx) => {
        const updated = await tx.payment.updateMany({
          where: {
            id: dbPayment.id,
            paymentDate: null,
          },
          data: {
            status: "RECEIVED",
            paymentDate: now,
          },
        });

        if (updated.count === 0) {
          return;
        }

        activated = true;

        await tx.subscription.update({
          where: { id: dbPayment.subscriptionId },
          data: {
            status: "ACTIVE",
            asaasPaymentId: codigoSolicitacao,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      });

      if (!activated) {
        results.push({ codigoSolicitacao, action: "already_paid" });
        continue;
      }

      if (dbPayment.Subscription?.User) {
        const user = dbPayment.Subscription.User;
        const planName = dbPayment.Subscription.plan === "DUO" ? "Plano Duo" : "Plano Basic";

        try {
          await sendMail({
            to: user.email,
            subject: `✅ Pagamento Confirmado - ${planName}`,
            fromEmail: "financeiro@pflix.com.br",
            fromName: "Financeiro FlixCRD",
            meta: {
              reason: "payment-webhook",
              userId: dbPayment.Subscription.userId,
              subscriptionId: dbPayment.subscriptionId,
              paymentId: codigoSolicitacao,
              event: "INTER_COBRANCA_PAID",
            },
            context: {
              value: dbPayment.value,
              status: "RECEIVED",
            },
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00cc00;">✅ Pagamento Confirmado!</h2>
                <p>Olá, ${user.name || "usuário"}!</p>
                <p>Seu pagamento foi confirmado e sua assinatura está ativa! 🎉</p>
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Plano:</strong> ${planName}</p>
                  <p><strong>Valor pago:</strong> R$ ${Number(dbPayment.value).toFixed(2).replace(".", ",")}</p>
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
Valor pago: R$ ${Number(dbPayment.value).toFixed(2).replace(".", ",")}
Válido até: ${periodEnd.toLocaleDateString("pt-BR")}

Acesse: ${process.env.NEXT_PUBLIC_APP_URL || "https://pflix.com.br"}

Aproveite todo o conteúdo disponível na plataforma!
            `,
          });
        } catch (emailError) {
          console.error("[Webhook Inter Cobrança] Erro ao enviar email de confirmação:", emailError);
        }
      }

      results.push({ codigoSolicitacao, action: "paid", situacao });
    }

    return NextResponse.json({ received: true, results }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook Inter Cobrança] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro no webhook" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Webhook Inter Cobrança endpoint ativo",
    timestamp: new Date().toISOString(),
  });
}
