# Fluxo de Recuperação de Senha (Forgot / Reset)

Este documento explica como funciona o fluxo de **recuperação de senha** do FlixCRD, como usar e como testar o envio de email.

---

## 1. Telas e rotas envolvidas

- **/login** – Tela de login normal
  - Agora contém o link **"Esqueceu sua senha?"**, abaixo do campo de senha.
- **/forgot-password** – Tela para pedir o link de recuperação
  - Envia `POST /api/auth/forgot-password` com o email informado.
- **/reset-password?token=...** – Tela para definir nova senha
  - Envia `POST /api/auth/reset-password` com `{ token, password }`.
- **APIs usadas**
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`

---

## 2. Como o fluxo funciona (passo a passo)

### 2.1. Usuário esqueceu a senha

1. Usuário acessa `/login`.
2. Clica em **"Esqueceu sua senha?"**.
3. É redirecionado para `/forgot-password`.
4. Informa o email da conta e envia o formulário.
5. O frontend chama:

   ```http
   POST /api/auth/forgot-password
   Content-Type: application/json

   {
     "email": "usuario@exemplo.com"
   }
   ```

6. A rota `forgot-password` faz:
   - Busca o usuário pelo email.
   - Gera um `token` aleatório (32 bytes).
   - Salva em `PasswordResetToken` com validade de **1 hora**.
   - Envia um email com link:

     ```text
     https://SEU_DOMINIO/reset-password?token=TOKEN_AQUI
     ```

7. A resposta da API **sempre** é genérica, por segurança:

   ```json
   {
     "success": true,
     "message": "Se o email existir, você receberá um link de recuperação."
   }
   ```

### 2.2. Usuário clicou no link do email

1. Clica no link recebido:

   ```text
   https://SEU_DOMINIO/reset-password?token=TOKEN_AQUI
   ```

2. A página `/reset-password` lê o `token` da query string.
3. Usuário informa **nova senha** + **confirmação** e envia.
4. O frontend chama:

   ```http
   POST /api/auth/reset-password
   Content-Type: application/json

   {
     "token": "TOKEN_AQUI",
     "password": "nova-senha"
   }
   ```

5. A rota `reset-password` faz:
   - Valida o token (`PasswordResetToken`):
     - Se não existir → `400 Token inválido ou expirado`.
     - Se expirado → deleta e retorna `400 Token expirado`.
   - Faz hash da nova senha com `bcrypt`.
   - Atualiza `User.passwordHash`.
   - Deleta o token usado e os demais tokens do usuário.

6. Em caso de sucesso, retorna:

   ```json
   {
     "success": true,
     "message": "Senha redefinida com sucesso!"
   }
   ```

7. O frontend mostra mensagem de sucesso e redireciona para `/login` após alguns segundos.

---

## 3. Como testar o envio de email

### 3.1. Pré-requisitos (env de email)

No ambiente que você está testando (dev/homol/prod) precisam estar configuradas as vars:

- `MAILJET_API_KEY`
- `MAILJET_SECRET_KEY`
- (opcional) `MAILJET_FROM_EMAIL` – se não passar `fromEmail` no código.

O fluxo de forgot-password usa:

- `sendMail` com:
  - `fromEmail: "suporte@pflix.com.br"`
  - `subject: "Recuperação de senha - FlixCRD"`
  - HTML e texto com link de reset.

### 3.2. Teste completo em homol/dev

1. Crie/garanta um usuário com email real (ex.: `seuemail@dominio.com`).
2. Acesse `/login`.
3. Clique em **"Esqueceu sua senha?"** → vai para `/forgot-password`.
4. Digite o email desse usuário e envie.
5. Verifique a caixa de entrada do email.
   - Procure por **"Recuperação de senha - FlixCRD"**.
6. Clique no link do email → abre `/reset-password?token=...`.
7. Informe nova senha + confirmação, envie.
8. Verifique se consegue logar normalmente com a nova senha.

Se ocorrer erro no envio:

- Verifique a tela `/admin/email-logs`:
  - Logs com `status: ERROR` para `reason: "forgot-password"`.
  - Veja `errorMessage` e `providerResponse` para detalhes do Mailjet.

---

## 4. Detalhes técnicos

### 4.1. Arquivos principais

- Login:
  - `src/app/login/page.tsx`
    - Adiciona link abaixo do campo de senha:
      - `Esqueceu sua senha?` → `/forgot-password`.

- Tela de solicitar recuperação:
  - `src/app/forgot-password/page.tsx`
    - Formulário com campo `email`.
    - Chama `POST /api/auth/forgot-password`.
    - Mostra mensagens de sucesso/erro.

- Tela de redefinir senha:
  - `src/app/reset-password/page.tsx`
    - Lê `token` de `useSearchParams()`.
    - Tem campos "Nova senha" e "Confirmar senha".
    - Chama `POST /api/auth/reset-password`.

- API – forgot password:
  - `src/app/api/auth/forgot-password/route.ts`
    - Gera token em `PasswordResetToken`.
    - Envia email usando `sendMail`.

- API – reset password:
  - `src/app/api/auth/reset-password/route.ts`
    - Valida token + expiração.
    - Atualiza hash da senha (`bcrypt`).

- Logging de email:
  - `src/lib/mailjet.ts`
  - `src/lib/email-log.ts`
  - `src/app/api/admin/email-logs/route.ts`

---

## 5. Erros comuns e diagnósticos

- **Não chega email**
  - Verificar envs `MAILJET_*` no ambiente.
  - Ver `/admin/email-logs` para ver se há logs `ERROR` com `reason = "forgot-password"`.

- **Link de reset abre com erro de token**
  - Token expirado (mais de 1h) → API retorna `Token expirado`.
  - Token já usado → já foi deletado.
  - Token alterado na URL → `Token inválido ou expirado`.

- **Reset aparentemente ok, mas login falha**
  - Ver logs do `ResetPassword` na API.
  - Confirmar se o login está usando `credentials` com `User.passwordHash` certo.

---

## 6. Checklist rápido para produção

- [ ] `MAILJET_API_KEY` configurado
- [ ] `MAILJET_SECRET_KEY` configurado
- [ ] DNS / domínio do remetente configurados no Mailjet (SPF/DKIM)
- [ ] Teste manual completo feito em homol
- [ ] `/admin/email-logs` mostrando logs de sucesso e erro

---

**Última atualização**: 2025-12-11

