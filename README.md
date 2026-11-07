# Pflix

Plataforma unificada de streaming de vídeo sob demanda (HLS adaptativo) e streaming de música, com gestão de catálogo, perfis de usuário, playlists, cobrança de assinaturas e painel administrativo.

## Stack Principal

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Estilização**: Tailwind CSS + Framer Motion + Lucide Icons
- **Banco de Dados**: PostgreSQL + Prisma 5 ORM
- **Cache**: Redis (opcional)
- **Autenticação**: NextAuth v4 (sessão JWT para web e suporte a token Bearer para app mobile)
- **Armazenamento**: Wasabi S3 (vídeos HLS e faixas/capas de música sob o prefixo `music/` com URLs presignadas)
- **Integrações**: TMDb e OpenSubtitles (metadados e legendas de vídeo), MusicBrainz e LRCLIB (metadados e letras de música), Asaas e Banco Inter (pagamentos Pix/Boleto), Resend (e-mails) e Web Push (VAPID)

## Como Rodar Localmente

1. Instale as dependências:
```bash
npm install
```

2. Configure o ambiente:
```bash
cp .env.example .env
```
Preencha no `.env` ao menos `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` (mínimo de 12 caracteres).

3. Gere o cliente Prisma e aplique as migrações:
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. Crie o usuário administrador inicial:
```bash
npx prisma db seed
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## Variáveis de Ambiente

Todas as variáveis utilizadas pelo sistema estão documentadas e agrupadas no arquivo `.env.example`:

- **Banco e Cache**: `DATABASE_URL`, `SHADOW_DATABASE_URL`, `REDIS_URL`, `POSTGRES_PASSWORD`
- **Autenticação e App**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `CORS_ALLOWED_ORIGINS`
- **Admin Inicial**: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- **Mobile e Frontend**: `NEXT_PUBLIC_APK_URL` (se omitida, oculta o botão de download do APK), `NEXT_PUBLIC_LAB_ENABLED`
- **Storage Wasabi (Vídeo e Música)**: `WASABI_ACCESS_KEY_ID`, `WASABI_SECRET_ACCESS_KEY`, `WASABI_BUCKET_NAME`, `WASABI_ENDPOINT`, `WASABI_REGION`, `WASABI_CDN_URL`
- **Serviços Externos**: `TRANSCODER_BASE_URL`, `TMDB_API_KEY`, `OPENSUBTITLES_API_KEY`, `MUSICBRAINZ_*`, `ASAAS_*`, `INTER_*`, `RESEND_*`, `WEBPUSH_VAPID_*`

## Scripts Disponíveis

- `npm run dev`: inicia o servidor de desenvolvimento Next.js
- `npm run build`: gera o Prisma Client e compila a aplicação para produção
- `npm run start`: inicia o servidor de produção
- `npm run lint`: executa a verificação do ESLint
- `npm test`: executa a suíte de testes com Jest
- `npm run test:watch`: executa o Jest em modo watch
- `npm run test:coverage`: executa o Jest com relatório de cobertura
- `npm run prisma:generate`: gera o cliente Prisma
- `npm run prisma:migrate`: executa migrações de desenvolvimento do Prisma
- `npx prisma db seed`: cria ou atualiza o usuário admin a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD`
