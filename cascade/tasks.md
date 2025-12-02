# Tarefas / backlog – FlixCRD

Legenda:
- [ ] pendente
- [x] concluída

## A. Organização e documentação
- [x] Criar arquivo `.cascade` com visão geral do projeto.
- [x] Criar pasta `/cascade` com arquivos de log, decisões e tarefas.
- [x] Extrair requisitos detalhados do documento `streaming-architecture-hls-netflix.md`.
- [x] Definir modelo de dados inicial do catálogo (filmes/séries/episódios, gêneros etc.).
- [ ] Documentar escopo de login/assinatura e proteção por presigned URL.

## B. Backend / Infraestrutura
- [ ] Definir stack técnica backend (Next.js API routes, Prisma, banco Postgres).
- [ ] Definir estratégia de armazenamento no Wasabi (pastas por vídeo, `master.m3u8`, variações, `segments`, thumbnails).
- [ ] Definir formato de `metadata.json` para cada vídeo.
- [ ] Planejar API de geração de presigned URLs de playback protegidos por login.
- [ ] Planejar integração com API externa de metadata (ex.: TMDb) para preencher infos automaticamente.

## C. Frontend / UX
- [ ] Definir páginas principais (detalhes do título, player, cadastro).
- [x] Criar páginas iniciais de home e login.
- [ ] Desenhar fluxo do player HLS (carregamento do `.m3u8`, fallback, erros).
- [ ] Especificar layout estilo Netflix (carrosséis, seções, destaque principal).
- [x] Definir estrutura base do painel admin em `/admin` (layout, navegação).

## D. Painel administrativo
- [x] Planejar fluxo de cadastro de título com busca automática em API externa (TMDb).
- [x] Planejar tela de upload/vinculação de assets HLS no Wasabi.
- [x] Planejar tela de gerenciamento de catálogo (CRUD de títulos).
- [ ] Planejar tela de gerenciamento de assinaturas/usuários (ativar/desativar acesso).

## E. Autenticação e assinatura
- [x] Escolher solução de autenticação (Auth.js / NextAuth) e modelo de usuário.
- [ ] Definir modelo de assinatura (status, plano, validade).
- [ ] Planejar integração de pagamento (ex.: Stripe/MercadoPago) ou fluxo manual no MVP.
