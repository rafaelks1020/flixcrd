# Log de progresso – FlixCRD

## 2025-12-02
- Criada a estrutura de documentação Cascade:
  - Arquivo `.cascade` com visão geral e convenções.
  - Pasta `/cascade` com `log.md`, `decisions.md` e `tasks.md`.
- Documento de arquitetura usado como referência inicial: `streaming-architecture-hls-netflix.md`.

- Refinido escopo do MVP: painel admin completo, upload/catalogação, metadata automática, login/assinatura e player protegido por presigned URL.
- Definida stack inicial: Next.js (App Router) + TypeScript + Tailwind, Auth.js, Prisma + Postgres, Wasabi S3 (bucket `filmespael`), TMDb para metadados.
- Criado projeto Next.js `flixcrd-web` com TypeScript + Tailwind (create-next-app).
- Iniciada configuração de backend com Prisma apontando para Postgres remoto.
 - Implementada autenticação com NextAuth (credentials + Prisma User), rotas `/login` e `/admin` e middleware protegendo `/admin`.
 - Criado seed Prisma para usuário admin padrão (`admin@flixcrd.local` / `admin123`) e executado `prisma db seed`.
 - Implementado CRUD básico de títulos (`/api/titles`) e tela de catálogo em `/admin/catalog` com listagem, criação/edição e remoção.
 - Implementada rota `/api/tmdb/search` e integração de busca TMDb na tela de catálogo para preencher metadados automaticamente.
  - Iniciado fluxo de upload integrado ao CRUD em `/admin/upload`, com geração de URLs presignadas para Wasabi (`/api/wasabi/upload-url`) e atualização automática do campo `hlsPath` do título.
