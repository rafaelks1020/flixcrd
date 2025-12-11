# Envio de E-mail com Resend – FlixCRD / pflix.com.br

Este documento descreve como o sistema envia e-mails usando **Resend** com o domínio `pflix.com.br`, e como isso está plugado no código do FlixCRD.

---

## 1. Resumo

- **Provider atual**: Resend (Mailjet foi abandonado – conta bloqueada).
- **Domínio autenticado**: `pflix.com.br` (DKIM + SPF verificados no Resend).
- **Remetentes permitidos**:
  - `financeiro@pflix.com.br`
  - `suporte@pflix.com.br`
  - `contato@pflix.com.br`
  - `no-reply@pflix.com.br`
  - (qualquer endereço `*@pflix.com.br`)
- **Interface no código**: continua usando `sendMail({...})` de `src/lib/mailjet.ts`.
- **Logs**: continuam em `EmailLog` e `/admin/email-logs` (sucesso/erro).

---

## 2. Variáveis de ambiente

No `.env` (dev) e no ambiente de homol/prod, configurar:

```env
RESEND_KEY="re_xxx"                 # API Key privada da Resend
RESEND_FROM_EMAIL="no-reply@pflix.com.br"  # Remetente padrão (opcional)
RESEND_FROM_NAME="Pflix"                    # Nome exibido (opcional)
```

Notas:

- `RESEND_KEY` é **obrigatório**. Sem isso, `sendMail` lança erro.
- Se `RESEND_FROM_EMAIL` não for definido, o código usa `no-reply@pflix.com.br` por padrão.
- Para usar remetentes diferentes (financeiro, suporte, etc.), basta passar `fromEmail` e `fromName` em cada chamada de `sendMail`.

As variáveis antigas do Mailjet (`MAILJET_API_KEY`, etc.) podem ser removidas ou ignoradas – não são mais usadas.

---

## 3. Implementação no código

### 3.1. Arquivo principal

- `src/lib/mailjet.ts`
  - Define o tipo `SendMailArgs`:

    ```ts
    export type SendMailArgs = {
      to: Recipient | Recipient[]; // string ou { email, name? }
      subject: string;
      text?: string;
      html?: string;
      fromEmail?: string;
      fromName?: string;
      meta?: EmailLogMeta;   // usado para logs (reason, userId, etc.)
      context?: unknown;     // contexto adicional para logs
    };
    ```

  - Usa as envs do Resend:

    ```ts
    const RESEND_API_KEY = process.env.RESEND_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "no-reply@pflix.com.br";
    const RESEND_FROM_NAME = process.env.RESEND_FROM_NAME || "Pflix";
    const RESEND_API_URL = "https://api.resend.com/emails";
    ```

  - Normaliza destinatários e monta o `from`:

    ```ts
    const recipients = normalizeRecipients(to); // array de { email, name? }
    const toEmails = recipients.map((r) => r.email);
    const from = `${senderName} <${senderEmail}>`;
    ```

  - Faz o POST para a API do Resend:

    ```ts
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
    ```

  - Em caso de sucesso, registra log:

    ```ts
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
    ```

  - Em caso de erro (HTTP != 2xx), registra log com `status: ERROR` e levanta exceção.

### 3.2. Onde `sendMail` é usado

- `src/app/api/auth/forgot-password/route.ts`
  - Recuperação de senha.
- `src/app/api/auth/register/route.ts` (se enviar email de boas‑vindas, futuramente).
- `src/app/api/subscription/create/route.ts`
  - Emails de pagamento (PIX, boleto, cartão).
- `src/app/api/webhook/route.ts`
  - Notificações de pagamento confirmado/vencido.
- `src/app/api/solicitacoes/route.ts`
  - Notificações para admin sobre novas solicitações.

Qualquer lugar que antes usava `sendMail` com Mailjet agora usa **Resend**, sem mudar a assinatura.

---

## 4. Como testar envio com Resend

### 4.1. Pré-requisitos

- `RESEND_KEY` configurado no `.env` (dev/homol/prod).
- Domínio `pflix.com.br` já autenticado no painel do Resend (DKIM/SPF ok).

### 4.2. Teste rápido (Forgot Password)

1. Garanta que existe um usuário com email real (por ex. `seuemail@dominio.com`).
2. Acesse `/login`.
3. Clique em **"Esqueceu sua senha?"** → `/forgot-password`.
4. Preencha o email desse usuário e envie.
5. Verifique na sua caixa de entrada se chegou o email de **"Recuperação de senha - FlixCRD"**.
6. Confira também `/admin/email-logs` para ver o registro:
   - `status: SUCCESS` se o Resend aceitou.
   - `status: ERROR` se houve erro (detalhes em `errorMessage` e `providerResponse`).

### 4.3. Teste de outro fluxo (pagamento, etc.)

1. Execute o fluxo que dispara o email (ex.: criação de assinatura, webhook de pagamento).
2. Verifique se o email chegou.
3. Verifique `/admin/email-logs` com filtro `reason` adequado (ex.: `payment-webhook`, `forgot-password`).

---

## 5. Erros comuns com Resend

- **`RESEND_KEY não configurado`**
  - Env faltando → configurar a chave privada no `.env` e no ambiente de deploy.

- **Erro HTTP do Resend (4xx/5xx)**
  - Ver detalhes em `/admin/email-logs`:
    - `errorMessage` e `providerResponse` trazem a mensagem retornada pela API do Resend.

- **Email não chega mesmo com SUCCESS**
  - Verificar pasta de spam.
  - Conferir configurações do domínio no painel do Resend (DKIM/SPF).

---

## 6. Migração a partir do Mailjet

- O arquivo `src/lib/mailjet.ts` agora usa Resend por baixo dos panos.
- Dependências e envs antigos do Mailjet podem ser removidos aos poucos:
  - Remover `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`, `MAILJET_FROM_EMAIL`, `MAILJET_FROM_NAME` quando não forem mais necessários.
  - Opcionalmente, remover `node-mailjet` de `package.json` em um commit futuro.

---

**Última atualização**: 2025-12-11
