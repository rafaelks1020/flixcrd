import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";
import { getPayment, getPixQrCode } from "@/lib/asaas";

function normalizePixImageSrc(input: string) {
  const value = (input || "").trim();
  if (!value) return value;
  const compact = value.replace(/\s+/g, "");
  if (compact.startsWith("data:")) return compact;
  if (compact.startsWith("http://") || compact.startsWith("https://")) return compact;
  return `data:image/png;base64,${compact}`;
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ paymentId: string }> },
) {
  try {
    const params = await context.params;
    const user = await getAuthUser(request);
    if (!user?.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const paymentId = params.paymentId;
    if (!paymentId) {
      return NextResponse.json({ error: "paymentId inválido." }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        asaasPaymentId: true,
        billingType: true,
        invoiceUrl: true,
        pixQrCode: true,
        pixCopiaECola: true,
        status: true,
        dueDate: true,
        value: true,
        Subscription: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    }

    const isAdmin = user.role === "ADMIN";
    if (!isAdmin && payment.Subscription.userId !== user.id) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
    }

    if (payment.billingType === "PIX") {
      let qr = payment.pixQrCode ? normalizePixImageSrc(payment.pixQrCode) : payment.pixQrCode;
      let payload = payment.pixCopiaECola ? payment.pixCopiaECola.replace(/\s+/g, "") : payment.pixCopiaECola;

      if (!qr || !payload) {
        try {
          const pixData = await getPixQrCode(payment.asaasPaymentId);
          qr = pixData?.encodedImage ? normalizePixImageSrc(pixData.encodedImage) : qr;
          payload = pixData?.payload || payload;
        } catch {
          // ignore
        }
      }

      if (!qr && !payload) {
        return NextResponse.json(
          { error: "Pagamento PIX sem QR Code disponível." },
          { status: 404 },
        );
      }

      const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pagamento PIX</title>
  </head>
  <body style="font-family: Arial, sans-serif; background: #0b0b0b; color: #fff; padding: 24px;">
    <div style="max-width: 520px; margin: 0 auto; background: #151515; border: 1px solid #2a2a2a; border-radius: 12px; padding: 18px;">
      <h2 style="margin: 0 0 8px 0;">Pagamento via PIX</h2>
      <div style="opacity: 0.85; font-size: 14px; margin-bottom: 16px;">Valor: R$ ${Number(payment.value).toFixed(2).replace(".", ",")} • Status: ${payment.status}</div>
      ${qr ? `<div style="text-align:center; margin: 18px 0;"><img src="${qr}" style="max-width: 260px; width: 100%; background:#fff; padding: 10px; border-radius: 8px;" /></div>` : ""}
      ${payload ? `<div style="margin-top: 12px;">
        <div style="font-size: 14px; margin-bottom: 6px;">Pix Copia e Cola</div>
        <textarea readonly style="width: 100%; min-height: 90px; background: #0f0f0f; color: #fff; border: 1px solid #2a2a2a; border-radius: 8px; padding: 10px;">${escapeHtml(payload)}</textarea>
        <button id="copy" style="margin-top: 10px; background: #e50914; color: #fff; border: none; border-radius: 8px; padding: 10px 14px; font-weight: 700; cursor: pointer;">Copiar código PIX</button>
        <div id="msg" style="margin-top: 8px; font-size: 12px; opacity: 0.8;"></div>
      </div>` : ""}
    </div>
    <script>
      const btn = document.getElementById('copy');
      if (btn) {
        btn.addEventListener('click', async () => {
          const ta = document.querySelector('textarea');
          const msg = document.getElementById('msg');
          try {
            await navigator.clipboard.writeText(ta.value);
            if (msg) msg.textContent = 'Código PIX copiado.';
          } catch {
            if (msg) msg.textContent = 'Não foi possível copiar automaticamente. Copie manualmente.';
          }
        });
      }
    </script>
  </body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (payment.billingType === "CREDIT_CARD") {
      const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pagamento</title>
  </head>
  <body style="font-family: Arial, sans-serif; background: #0b0b0b; color: #fff; padding: 24px;">
    <div style="max-width: 520px; margin: 0 auto; background: #151515; border: 1px solid #2a2a2a; border-radius: 12px; padding: 18px;">
      <h2 style="margin: 0 0 8px 0;">Pagamento (Cartão)</h2>
      <div style="opacity: 0.85; font-size: 14px;">Valor: R$ ${Number(payment.value).toFixed(2).replace(".", ",")} • Status: ${payment.status}</div>
      <p style="margin-top: 14px; opacity: 0.9;">Este pagamento não possui boleto/fatura em PDF.</p>
    </div>
  </body>
</html>`;

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    let targetUrl: string | null = payment.invoiceUrl || null;

    try {
      const asaasPayment = await getPayment(payment.asaasPaymentId);
      targetUrl = asaasPayment.bankSlipUrl || targetUrl;
    } catch {
      // Se falhar consulta ao gateway, tenta usar o invoiceUrl salvo no banco
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Sem boleto/fatura disponível para este pagamento." },
        { status: 404 },
      );
    }

    const upstream = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "FlixCRD/1.0",
        Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Falha ao obter boleto/fatura." },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      return NextResponse.json(
        {
          error:
            "O boleto/fatura retornou HTML do gateway (pode falhar em localhost por restrição de domínio).",
        },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("GET /api/payments/[paymentId]/invoice error", error);
    return NextResponse.json(
      { error: "Erro ao obter boleto/fatura." },
      { status: 500 },
    );
  }
}
