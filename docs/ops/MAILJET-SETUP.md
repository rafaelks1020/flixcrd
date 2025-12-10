# 📧 Configuração de Email com Mailjet

Este documento descreve todas as implementações de email no sistema FlixCRD.

---

## 🔧 Variáveis de Ambiente Necessárias

Adicione as seguintes variáveis no arquivo `.env`:

```env
# Mailjet (chaves de API)
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_SECRET_KEY=your_mailjet_secret_key

# Admin (quem recebe notificações de solicitações)
ADMIN_EMAIL=admin@example.com

# App URL (para links nos emails)
NEXT_PUBLIC_APP_URL=https://pflix.com.br
```

### 📧 Remetentes de Email (Configurados Automaticamente)

Os emails são enviados com remetentes diferentes de acordo com o tipo:

| Tipo de Email | Remetente | Nome |
|--------------|-----------|------|
| **Recuperação de senha** | `suporte@pflix.com.br` | Suporte FlixCRD |
| **Solicitações de conteúdo** | `contato@pflix.com.br` | FlixCRD |
| **Pagamentos e cobranças** | `financeiro@pflix.com.br` | Financeiro FlixCRD |

> ⚠️ **Importante:** Certifique-se de que esses emails estão verificados no Mailjet!

---

## 📨 Emails Implementados

### 1. **Recuperação de Senha**

#### Rota: `POST /api/auth/forgot-password`
**Quando é enviado:** Quando o usuário solicita recuperação de senha.

**Para quem:** Usuário que solicitou a recuperação.

**Conteúdo:**
- Link de recuperação de senha (válido por 1 hora)
- Instruções para redefinir a senha

**Exemplo de uso:**
```bash
curl -X POST https://pflix.com.br/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@example.com"}'
```

#### Rota: `POST /api/auth/reset-password`
**Quando é enviado:** Quando o usuário redefine a senha com sucesso.

**Para quem:** Não envia email (apenas confirma a operação).

**Exemplo de uso:**
```bash
curl -X POST https://pflix.com.br/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123...", "password": "novaSenha123"}'
```

---

### 2. **Notificação de Solicitação de Conteúdo**

#### Rota: `POST /api/solicitacoes`
**Quando é enviado:** Quando um usuário solicita um filme/série.

**Para quem:** Admin (configurado na variável `ADMIN_EMAIL`).

**Conteúdo:**
- Título e tipo do conteúdo solicitado
- Dados do usuário que fez a solicitação
- IMDB ID (se fornecido)
- Idiomas e qualidade desejados
- Link direto para o admin gerenciar a solicitação

**Exemplo de uso:**
```bash
curl -X POST https://pflix.com.br/api/solicitacoes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "title": "Breaking Bad",
    "type": "SERIES",
    "imdbId": "tt0903747",
    "desiredLanguages": ["Português", "Inglês"],
    "desiredQuality": "1080p",
    "note": "Todas as temporadas, por favor!"
  }'
```

---

### 3. **Emails de Pagamento**

#### Rota: `POST /api/subscription/create`

**Enviado quando:** Um pagamento é criado/processado.

**Para quem:** Usuário que está criando a assinatura.

**Tipos de email:**

##### a) **Pagamento via PIX**
- **Conteúdo:** QR Code e código Pix Copia e Cola
- **Instruções:** Como pagar via PIX

##### b) **Pagamento via Boleto**
- **Conteúdo:** Link para visualizar o boleto
- **Data de vencimento:** Informada no email

##### c) **Pagamento via Cartão de Crédito (Aprovado)**
- **Conteúdo:** Confirmação de pagamento aprovado
- **Detalhes:** Plano, valor, período de validade
- **Call-to-action:** Botão "Começar a assistir"

---

### 4. **Webhooks de Pagamento (Asaas)**

#### Rota: `POST /api/webhook`

**Enviado quando:** O Asaas notifica sobre mudanças no status do pagamento.

**Eventos que geram email:**

##### a) **Pagamento Confirmado** (`PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`)
- **Para quem:** Usuário
- **Conteúdo:** 
  - Confirmação de pagamento
  - Plano ativado
  - Período de validade
  - Link para começar a assistir

##### b) **Pagamento Vencido** (`PAYMENT_OVERDUE`)
- **Para quem:** Usuário
- **Conteúdo:** 
  - Alerta de pagamento vencido
  - Valor e data de vencimento
  - Link para renovar assinatura

---

## 🧪 Como Testar

### 1. **Testar Recuperação de Senha**

```bash
# 1. Solicitar recuperação
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "seu-email@example.com"}'

# 2. Verificar o email recebido e usar o token
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_DO_EMAIL", "password": "novaSenha123"}'
```

### 2. **Testar Notificação de Solicitação**

```bash
# Fazer login e pegar o token
# Depois criar uma solicitação
curl -X POST http://localhost:3000/api/solicitacoes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "title": "Teste de Filme",
    "type": "MOVIE",
    "note": "Teste de notificação"
  }'

# Verificar se o admin recebeu o email
```

### 3. **Testar Emails de Pagamento**

```bash
# Criar assinatura com PIX
curl -X POST http://localhost:3000/api/subscription/create \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=SEU_SESSION_TOKEN" \
  -d '{
    "billingType": "PIX",
    "plan": "BASIC"
  }'

# Verificar se o email com o QR Code foi recebido
```

---

## 📋 Checklist de Implementação

- [x] Modelo `PasswordResetToken` no banco de dados
- [x] Rota de recuperação de senha (`/api/auth/forgot-password`)
- [x] Rota de redefinição de senha (`/api/auth/reset-password`)
- [x] Email para admin quando solicitação é criada
- [x] Email de pagamento via PIX
- [x] Email de pagamento via Boleto
- [x] Email de pagamento via Cartão (aprovado)
- [x] Email de pagamento confirmado (webhook)
- [x] Email de pagamento vencido (webhook)
- [x] Cliente Mailjet configurado (`/src/lib/mailjet.ts`)

---

## 🔒 Segurança

- **Tokens de recuperação:** Expiram em 1 hora
- **Tokens usados:** São deletados após uso
- **Emails de erro:** Não revelam se o email existe no sistema (proteção contra ataques)
- **Logs:** Registram todas as operações de email (sucesso e falha)

---

## 🚀 Próximos Passos (Opcional)

- [ ] Adicionar templates de email mais elaborados (com HTML melhorado)
- [ ] Criar sistema de preferências de notificação por usuário
- [ ] Adicionar email de boas-vindas no registro
- [ ] Email de confirmação quando solicitação for atendida
- [ ] Email semanal com novos conteúdos adicionados

---

## 🆘 Troubleshooting

### Email não está sendo enviado

1. **Verifique as variáveis de ambiente:**
   ```bash
   echo $MAILJET_API_KEY
   echo $MAILJET_SECRET_KEY
   ```

2. **Verifique os logs do servidor:**
   - Procure por `[Mailjet]` nos logs
   - Erros de envio são logados mas não bloqueiam a operação

3. **Teste a conexão com o Mailjet:**
   ```javascript
   // test-mailjet.js
   const { sendMail } = require('./src/lib/mailjet');
   
   sendMail({
     to: 'seu-email@example.com',
     subject: 'Teste',
     text: 'Teste de email',
     html: '<p>Teste de email</p>',
   }).then(() => console.log('✅ Email enviado!'))
     .catch(err => console.error('❌ Erro:', err));
   ```

### Token de recuperação inválido

- Tokens expiram em 1 hora
- Tokens são deletados após uso
- Verifique se o token está correto (copie e cole)

### Admin não está recebendo emails de solicitação

- Verifique se `ADMIN_EMAIL` está configurado no `.env`
- Verifique se o email do admin está correto
- Verifique os logs para ver se há erros de envio

---

## 📚 Referências

- [Documentação Mailjet](https://dev.mailjet.com/)
- [node-mailjet NPM](https://www.npmjs.com/package/node-mailjet)
- [Mailjet Dashboard](https://app.mailjet.com/)

