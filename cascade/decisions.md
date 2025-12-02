# Decisões de arquitetura (ADR light)

## [2025-12-02] Formato de documentação do projeto
- Contexto:
  - Projeto de streaming HLS estilo Netflix com muitos detalhes de arquitetura.
  - Necessidade de acompanhar decisões e progresso de forma organizada.
- Decisão:
  - Usar um arquivo raiz `.cascade` para visão geral e convenções.
  - Criar a pasta `/cascade` com arquivos de log, decisões e tarefas.
- Consequências:
  - Histórico claro do que foi feito ao longo do tempo.
  - Facilita retomar o projeto depois de pausas longas.
  - Base para automatizar relatórios de progresso no futuro.

## [2025-12-02] Stack inicial do produto (MVP com admin + login/assinatura)
- Contexto:
  - Sistema de streaming estilo Netflix com painel admin, login/assinatura e player protegido.
  - Bucket Wasabi já existente (`filmespael`) com credenciais em `credentials.csv`.
- Decisão:
  - Usar Next.js (App Router) com TypeScript e Tailwind para frontend e painel admin.
  - Usar Auth.js (NextAuth) para autenticação com sessão server-side.
  - Usar Prisma como ORM com banco Postgres (dev/local e produção configurados via variáveis de ambiente).
  - Integrar com Wasabi via SDK S3-compatível para geração de presigned URLs de playback.
  - Usar The Movie Database (TMDb) como API principal de metadados (títulos, posters, thumbs).
- Consequências:
  - Fluxo de login e autorização integrado com Next.js e páginas protegidas.
  - Fácil evolução do modelo de dados com Prisma.
  - Player HLS poderá consumir manifestos protegidos por presigned URLs de curta duração.
  - Dependência de chaves de API externas (Wasabi, TMDb), gerenciadas via variáveis de ambiente.
