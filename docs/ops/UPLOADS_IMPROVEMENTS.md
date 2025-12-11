# Melhorias no Módulo de Uploads (FlixCRD)

Este documento lista os gaps identificados e as melhorias propostas para o módulo de uploads, com foco especial em **séries/animes**, **experiência mobile** e **UX geral**.

---

## Situação Atual

### Telas de Upload

1. **`/admin/upload`** (legado)
   - Seleciona título existente do catálogo.
   - Para séries, exige selecionar temporada e episódio manualmente.
   - Upload de um arquivo por vez.
   - Não mostra status de uploads anteriores.

2. **`/admin/upload-v2`** (novo, mais completo)
   - Busca no TMDB e cria título automaticamente.
   - Drag & drop de múltiplos arquivos.
   - Detecção automática de S/E (regex + fallback IA).
   - Upload multipart concorrente (64MB/parte, 6 workers).
   - Opção de transcodificação automática após upload.
   - **Não mostra** o que já foi feito upload para cada episódio.
   - **Sem classes responsivas** (sm:/md:/lg:) – layout fixo.
   - **Drag & drop não funciona bem em mobile** (não há alternativa touch-friendly).

3. **`/admin/catalog/[id]`** (SeasonsClient)
   - Lista temporadas e episódios importados do TMDB.
   - Mostra status HLS por episódio: `Sem upload`, `Upload feito (HLS pendente)`, `HLS pronto`.
   - Permite importar temporadas do TMDB.
   - Permite gerar HLS em lote para episódios com upload.
   - **Não permite** fazer upload diretamente dessa tela.

### APIs Relevantes

- `POST /api/wasabi/multipart/start` – inicia upload multipart (título ou episódio).
- `POST /api/wasabi/multipart/part-url` – gera URL para cada parte.
- `POST /api/wasabi/multipart/complete` – finaliza upload multipart.
- `POST /api/wasabi/upload-url` – gera URL para upload simples (PUT único).
- `GET /api/admin/titles/[id]/seasons` – lista temporadas/episódios com `hlsPath`.
- `GET /api/admin/episodes/[id]/hls-status` – verifica se episódio tem upload/HLS.
- `POST /api/admin/titles/[id]/transcode-episodes` – enfileira HLS para episódios com upload.
- `POST /api/episodes` – cria episódio (e temporada se não existir).
- `POST /api/admin/episodes/create-batch` – cria episódios em lote.

---

## Gaps Identificados

### 1. Falta de visibilidade do que já foi feito upload

**Problema**: Ao fazer upload de uma série com muitos episódios, o admin não sabe facilmente quais episódios já têm arquivo e quais faltam.

**Onde aparece**:
- `/admin/upload-v2` não mostra status dos episódios existentes.
- `/admin/catalog/[id]` mostra status, mas não permite upload direto.

**Impacto**: Admin pode fazer upload duplicado ou esquecer episódios.

---

### 2. Upload um a um é trabalhoso

**Problema**: Embora `/admin/upload-v2` aceite múltiplos arquivos, o fluxo é "tudo ou nada". Não há como:
- Fazer upload de 1 episódio, pausar, continuar depois.
- Ver progresso persistido (se fechar a aba, perde tudo).
- Retomar uploads interrompidos.

**Impacto**: Para séries grandes (50+ episódios), é arriscado fazer tudo de uma vez.

---

### 3. Não há como fazer upload direto da tela de catálogo/episódios

**Problema**: O admin precisa ir para `/admin/upload-v2`, buscar o título, arrastar arquivos. Seria mais prático poder fazer upload diretamente na tela de episódios (`/admin/catalog/[id]`).

**Impacto**: Fluxo fragmentado, mais cliques.

---

### 4. Detecção de episódio pode falhar silenciosamente

**Problema**: Se a detecção automática não encontrar S/E, o arquivo fica marcado como "Não detectado" e o admin precisa corrigir manualmente. Se não corrigir, o upload vai para o título (não para o episódio).

**Impacto**: Arquivos podem ir para o lugar errado.

---

### 5. Falta de resumo/dashboard de uploads

**Problema**: Não existe uma tela que mostre:
- Uploads em andamento.
- Uploads recentes (últimas 24h).
- Episódios pendentes de upload por série.

**Impacto**: Difícil acompanhar progresso de séries grandes.

---

### 6. Não há como "continuar de onde parou"

**Problema**: Se o admin fez upload de 10 episódios ontem e quer continuar hoje, precisa:
1. Ir para `/admin/catalog/[id]` e ver quais episódios já têm upload.
2. Ir para `/admin/upload-v2`, buscar o título, arrastar os arquivos restantes.
3. Torcer para a detecção automática funcionar.

**Impacto**: Fluxo manual e propenso a erros.

---

### 7. 📱 Experiência Mobile é Ruim

**Problema**: A tela `/admin/upload-v2` não foi pensada para mobile:
- **Drag & drop não funciona** em dispositivos touch (iOS/Android).
- **Layout não é responsivo** – sem breakpoints `sm:`, `md:`, `lg:`.
- **Dropzone muito grande** (p-12) – ocupa tela inteira em mobile.
- **Botões pequenos** – difícil de clicar em touch.
- **Não há input de câmera** – não permite gravar/enviar vídeo direto do celular.

**Impacto**: Admin não consegue fazer upload de forma prática pelo celular/tablet.

---

### 8. Sem Cancelamento de Upload

**Problema**: Uma vez iniciado o upload, não há como cancelar:
- Não existe botão "Cancelar" por arquivo.
- Não há como abortar o upload multipart em andamento.
- Se o admin errar o arquivo, precisa esperar terminar ou fechar a aba (perde tudo).

**Impacto**: Desperdício de tempo e banda.

---

### 9. Sem Retry Automático Visível

**Problema**: O código tem `MULTIPART_MAX_RETRIES = 3`, mas:
- O usuário não vê quando está em retry.
- Não há indicação de "tentativa 2/3".
- Se falhar após 3 tentativas, o erro não é claro.

**Impacto**: Admin não sabe se deve esperar ou intervir.

---

### 10. Sem Validação de Arquivo

**Problema**: O input aceita `video/*`, mas:
- Não valida se o arquivo é realmente um vídeo válido.
- Não verifica tamanho mínimo (arquivo corrompido pode ter 0 bytes).
- Não verifica codec/container (alguns formatos podem não ser suportados pelo transcoder).

**Impacto**: Uploads inúteis que vão falhar na transcodificação.

---

### 11. Sem Notificação de Conclusão

**Problema**: Se o admin deixar a aba em background:
- Não recebe notificação quando o upload termina.
- Não recebe notificação quando a transcodificação termina.
- Precisa ficar olhando a tela.

**Impacto**: Perda de produtividade.

---

### 12. Falta Ordenação/Agrupamento de Arquivos

**Problema**: Ao arrastar muitos arquivos:
- Não são ordenados por S/E automaticamente.
- Não há agrupamento visual por temporada.
- Difícil ver se está faltando algum episódio no meio.

**Impacto**: Fácil perder episódios ou fazer upload fora de ordem.

---

### 13. Sem Histórico de Uploads

**Problema**: Não há registro persistente de:
- Quem fez upload de qual arquivo.
- Quando foi feito.
- Se deu erro ou sucesso.

**Impacto**: Sem auditoria, difícil debugar problemas.

---

### 14. Falta Integração com Solicitações

**Problema**: Quando uma solicitação é atendida e o título é criado:
- O admin é redirecionado para `/admin/upload-v2?titleId=xxx`.
- Mas não há indicação clara de que veio de uma solicitação.
- Não há link de volta para a solicitação.
- Não atualiza automaticamente o status da solicitação após upload.

**Impacto**: Fluxo desconectado entre solicitações e uploads.

---

### 15. Sem Suporte a Upload de Legendas Junto

**Problema**: O fluxo de upload é só para vídeos:
- Não permite arrastar legendas (.srt, .vtt) junto.
- Legendas precisam ser enviadas em outra tela (`/admin/subtitles`).

**Impacto**: Mais passos para o admin.

---

### 16. Sem Estimativa de Tempo Total

**Problema**: Mostra tempo restante por arquivo, mas:
- Não mostra tempo total estimado para todos os arquivos.
- Não mostra progresso geral (ex: "3 de 10 arquivos concluídos").

**Impacto**: Admin não sabe quanto tempo vai levar no total.

---

### 17. Sem Modo "Fila" para Uploads Grandes

**Problema**: Todos os arquivos começam a fazer upload ao mesmo tempo (limitado por concorrência de partes, não de arquivos). Para séries grandes:
- Pode sobrecarregar a conexão.
- Não há priorização (ex: fazer S01 primeiro).

**Impacto**: Uploads podem ficar lentos ou travar.

---

## Melhorias Propostas

### P0 – Crítico (Mobile + UX Básico)

#### 0.1. 📱 Layout Responsivo para Mobile

**O que fazer**:
- Adicionar breakpoints Tailwind (`sm:`, `md:`, `lg:`) em toda a tela.
- Reduzir padding do dropzone em mobile (`p-6` em vez de `p-12`).
- Botões maiores e mais espaçados para touch.
- Texto legível em telas pequenas.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

#### 0.2. 📱 Input de Arquivo Touch-Friendly

**O que fazer**:
- Além do drag & drop, ter botão grande "Selecionar Arquivos" que funciona bem em mobile.
- Adicionar `capture="environment"` para permitir gravar vídeo direto da câmera.
- Considerar input separado para câmera vs galeria.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

#### 0.3. Botão de Cancelar Upload

**O que fazer**:
- Adicionar botão "❌ Cancelar" em cada arquivo em upload.
- Implementar `AbortController` para cancelar o XHR/fetch.
- Para multipart, chamar `AbortMultipartUpload` no Wasabi.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`
- Possivelmente nova rota `POST /api/wasabi/multipart/abort`.

---

### P1 – Alta Prioridade

#### 1.1. Mostrar status de upload na tela de upload-v2

**O que fazer**:
- Após criar/selecionar título, carregar lista de episódios existentes com status (`none`, `uploaded`, `hls_ready`).
- Exibir ao lado de cada arquivo arrastado se o episódio correspondente já tem upload.
- Destacar visualmente episódios que já têm arquivo (para evitar duplicação).
- Mostrar lista de episódios que **faltam** upload.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`
- `src/app/api/admin/titles/[id]/seasons/route.ts` (já retorna `hlsPath`)

---

#### 1.2. Permitir upload individual por episódio na tela de catálogo

**O que fazer**:
- Na tela `/admin/catalog/[id]` (SeasonsClient), adicionar botão "📤 Upload" em cada episódio que está `Sem upload`.
- Ao clicar, abrir modal ou expandir área para arrastar/selecionar arquivo.
- Fazer upload diretamente para aquele episódio.
- Funcionar bem em mobile (botão grande, input touch-friendly).

**Arquivos envolvidos**:
- `src/app/admin/catalog/[id]/SeasonsClient.tsx`
- Reutilizar lógica de upload multipart de `upload-v2`.

---

#### 1.3. Filtro "Episódios sem upload" na tela de catálogo

**O que fazer**:
- Adicionar filtro/toggle para mostrar apenas episódios que ainda não têm arquivo.
- Facilita identificar o que falta.

**Arquivos envolvidos**:
- `src/app/admin/catalog/[id]/SeasonsClient.tsx`

---

#### 1.4. Ordenar e Agrupar Arquivos por Temporada

**O que fazer**:
- Após detectar S/E, ordenar lista de arquivos por temporada → episódio.
- Agrupar visualmente por temporada (ex: "Temporada 1 (5 arquivos)").
- Destacar gaps (ex: "Falta E03").

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

#### 1.5. Progresso Geral + Tempo Total Estimado

**O que fazer**:
- Mostrar barra de progresso geral: "3 de 10 arquivos (30%)".
- Mostrar tempo total estimado baseado na velocidade média.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

### P2 – Média Prioridade

#### 2.1. Resumo de uploads pendentes por série

**O que fazer**:
- Na listagem de títulos (`/admin/catalog`), mostrar badge com contagem de episódios sem upload.
- Exemplo: "Breaking Bad – 62 episódios – 5 sem upload".

**Arquivos envolvidos**:
- `src/app/admin/catalog/page.tsx`
- `src/app/api/admin/titles/[id]/seasons/route.ts` ou nova rota de resumo.

---

#### 2.2. Persistir estado de uploads em andamento

**O que fazer**:
- Salvar no `localStorage` ou no banco os uploads em progresso.
- Ao reabrir a tela, mostrar uploads pendentes/interrompidos.
- Permitir retomar (se o upload multipart ainda estiver válido no Wasabi).

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`
- Possivelmente nova tabela `UploadSession` no Prisma.

---

#### 2.3. Dashboard de uploads recentes

**O que fazer**:
- Nova tela `/admin/uploads` com:
  - Uploads em andamento (se persistidos).
  - Uploads concluídos nas últimas 24h/7d.
  - Erros de upload.
  - Quem fez cada upload (auditoria).

**Arquivos envolvidos**:
- Nova página `src/app/admin/uploads/page.tsx`.
- Nova rota `GET /api/admin/uploads` (se persistir no banco).
- Nova tabela `UploadLog` no Prisma.

---

#### 2.4. Notificação de Conclusão

**O que fazer**:
- Usar `Notification API` do browser para notificar quando upload terminar.
- Integrar com push notifications existentes para notificar quando transcodificação terminar.
- Toast persistente se a aba estiver em background.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`
- Possivelmente `src/lib/push.ts`.

---

#### 2.5. Indicador de Retry

**O que fazer**:
- Mostrar "Tentativa 2/3" quando estiver em retry.
- Após falha final, mostrar botão "Tentar novamente" por arquivo.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

#### 2.6. Validação de Arquivo Antes do Upload

**O que fazer**:
- Verificar `file.size > 0`.
- Verificar extensão válida (.mkv, .mp4, .avi, .mov, .webm).
- Opcionalmente, usar `MediaInfo.js` para validar codec.
- Alertar se arquivo parecer inválido.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

#### 2.7. Modo Fila (Upload Sequencial de Arquivos)

**O que fazer**:
- Opção para fazer upload de 1 arquivo por vez (em vez de todos em paralelo).
- Útil para conexões lentas ou séries muito grandes.
- Permitir priorizar ordem (ex: arrastar para reordenar).

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

### P3 – Baixa Prioridade (nice to have)

#### 3.1. Upload em background com Service Worker

**O que fazer**:
- Usar Service Worker para upload em background.
- Continuar upload mesmo se fechar a aba (com limitações).
- Notificar via push quando concluir.

---

#### 3.2. Suporte a pastas (upload de temporada inteira)

**O que fazer**:
- Permitir arrastar uma pasta (ex: `Season 01/`) e detectar todos os arquivos dentro.
- Usar `webkitdirectory` attribute.
- Mapear automaticamente para os episódios.

**Arquivos envolvidos**:
- `src/app/admin/upload-v2/page.tsx`

---

#### 3.3. Upload de Legendas Junto com Vídeo

**O que fazer**:
- Permitir arrastar .srt/.vtt junto com o vídeo.
- Associar automaticamente ao episódio.
- Fazer upload para o mesmo prefixo.

---

#### 3.4. Integração Melhor com Solicitações

**O que fazer**:
- Quando vier de uma solicitação, mostrar banner "Fazendo upload para solicitação #123".
- Link de volta para a solicitação.
- Após upload, atualizar status da solicitação automaticamente (ex: `UPLOADING`).

---

#### 3.5. Preview de Vídeo Antes do Upload

**O que fazer**:
- Mostrar thumbnail do vídeo (primeiro frame).
- Mostrar duração estimada.
- Ajuda a confirmar que é o arquivo certo.

---

## Ordem de Implementação Sugerida

### Fase 1 – Mobile + UX Crítico
1. **0.1** – Layout responsivo para mobile.
2. **0.2** – Input touch-friendly + câmera.
3. **0.3** – Botão de cancelar upload.

### Fase 2 – Visibilidade + Continuidade
4. **1.1** – Status de upload visível no upload-v2.
5. **1.3** – Filtro "sem upload" no catálogo.
6. **1.4** – Ordenar/agrupar arquivos por temporada.
7. **1.5** – Progresso geral + tempo total.

### Fase 3 – Upload Direto no Catálogo
8. **1.2** – Upload individual por episódio no catálogo.

### Fase 4 – Persistência + Dashboard
9. **2.1** – Badge de episódios pendentes.
10. **2.2** – Persistência de uploads.
11. **2.3** – Dashboard de uploads.

### Fase 5 – Polish
12. **2.4** – Notificações.
13. **2.5** – Indicador de retry.
14. **2.6** – Validação de arquivo.
15. **2.7** – Modo fila.

### Fase 6 – Nice to Have
16. P3 conforme demanda.

---

## Checklist de Implementação

### P0 – Crítico
- [x] 0.1 – Layout responsivo para mobile (ajustado em `/admin/upload-v2`)
- [x] 0.2 – Input touch-friendly + câmera (botões "Selecionar da galeria" e "Gravar com câmera")
- [x] 0.3 – Botão de cancelar upload (cancelamento por arquivo, simples e multipart)

### P1 – Alta Prioridade
- [x] 1.1 – Status de upload visível no upload-v2 (painel de episódios + badge de status por arquivo mapeado)
- [x] 1.2 – Upload individual por episódio no catálogo (botão "📤 Upload vídeo" por episódio em `/admin/catalog/[id]`)
- [x] 1.3 – Filtro "sem upload" no catálogo (toggle em `/admin/catalog/[id]` via SeasonsClient)
- [x] 1.4 – Ordenar/agrupar arquivos por temporada (agrupamento por temporada e destaque de gaps em `/admin/upload-v2`)
- [x] 1.5 – Progresso geral + tempo total (barra de progresso geral e estimativa de tempo total em `/admin/upload-v2`)

### P2 – Média Prioridade
- [x] 2.1 – Badge de episódios pendentes na lista de títulos (resumo de episódios sem upload em `/admin/catalog` lista+grid)
- [x] 2.2 – Persistência de uploads em andamento (resumo da sessão anterior via localStorage em `/admin/upload-v2`)
- [x] 2.3 – Dashboard de uploads recentes (página `/admin/uploads` lendo histórico local de uploads via localStorage)
- [x] 2.4 – Notificação de conclusão (toggle de notificações desktop no `/admin/upload-v2` para uploads/transcode)
- [x] 2.5 – Indicador de retry (mostra "Tentativa X/3" durante uploads multipart no `/admin/upload-v2`)
- [x] 2.6 – Validação de arquivo (bloqueia arquivos vazios ou com extensão não suportada em `/admin/upload-v2`)
- [x] 2.7 – Modo fila (toggle para fazer upload em fila ou paralelo por arquivo em `/admin/upload-v2`)

### P3 – Nice to Have
- [ ] 3.1 – Upload em background (Service Worker)
- [x] 3.2 – Suporte a pastas (botão "Selecionar pasta" em `/admin/upload-v2` usando webkitdirectory)
- [ ] 3.3 – Upload de legendas junto
- [x] 3.4 – Integração com solicitações
- [ ] 3.5 – Preview de vídeo

---

**Última atualização**: 2025-12-11  
**Autor**: Cascade AI + FlixCRD Team
