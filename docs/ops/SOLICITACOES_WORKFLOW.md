# Workflow de Solicitações (FlixCRD)

Este documento descreve o workflow completo do módulo de **solicitações de conteúdo**, com foco em:

- Ownership flexível por administrador.
- Filtros para "Minhas solicitações".
- Notas internas no histórico.
- Endpoints de API e telas envolvidas.

---

## 1. Conceitos principais

### 1.1. Modelos Prisma

**Request** (resumido):

- `assignedAdminId: String?`
- `assignedAt: DateTime?`
- `status: RequestStatus` (`PENDING`, `UNDER_REVIEW`, `IN_PRODUCTION`, `UPLOADING`, `COMPLETED`, `REJECTED`)
- `workflowState: RequestWorkflowState` (`NONE`, `TECH_ANALYSIS`, `SOURCE_ACQUISITION`, `ENCODING`, `SUBTITLING`, `UPLOAD_SERVER`, `PUBLISHED`)
- `followersCount: Int`
- `RequestHistory[]`
- `RequestUpload?`
- `User` (dono da solicitação)
- `AssignedAdmin?` (admin responsável atual)

**User** (trecho relevante):

- `AssignedRequests: Request[] @relation("RequestAssignedAdmin")`

**RequestHistory** (trecho relevante):

- `action: RequestHistoryAction`
  - Inclui, entre outros: `CREATED`, `ASSIGNED`, `STATUS_CHANGED`, `WORKFLOW_CHANGED`, `LINKED_TO_CATALOG`, `REJECTED`, `COMPLETED`, `NOTE_ADDED`.
- `message: String?`
- `adminId: String?` (admin que executou a ação)

### 1.2. Ownership flexível

- Cada `Request` pode ter **zero ou um** `AssignedAdmin`.
- O owner é definido via `assignedAdminId` e `assignedAt`.
- **Qualquer admin** pode "assumir" uma solicitação a qualquer momento.
- O último admin que assume passa a ser o responsável atual.

### 1.3. Notas internas

- Notas internas são registradas em `RequestHistory` com `action = NOTE_ADDED`.
- Sempre associadas a um admin (`adminId`) e a uma mensagem de texto.
- **Nunca** são expostas para o usuário final fora do painel admin.

---

## 2. Telas e UX

### 2.1. Lista admin: `/admin/solicitacoes`

Arquivo: `src/app/admin/solicitacoes/page.tsx`

- Exibe uma tabela com as solicitações, incluindo:
  - Título
  - Usuário (dono)
  - **Responsável (AssignedAdmin)**
  - Tipo, Status, Workflow
  - Seguidores, Rating
  - SLA / Prioridade

#### 2.1.1. Coluna "Responsável"

Para cada item:

- Se houver `AssignedAdmin`:
  - Nome ou e‑mail do admin.
  - Linha com o e‑mail.
  - Se existir `assignedAt`, mostra: `Desde dd/mm/aaaa`.
- Se não houver responsável:
  - Mostra `Sem responsável` em cinza.

#### 2.1.2. Filtro "Responsável"

Na barra de filtros existe um seletor:

- `Todos`
- `Minhas`
- `Sem responsável`

Internamente, isso gera query params na API:

- `assigned=me` → filtra `assignedAdminId` pelo id do admin logado.
- `assigned=unassigned` → filtra solicitações com `assignedAdminId = null`.

### 2.2. Detalhe de solicitação: `/solicitacao/[id]`

Componentes principais:

- Página server: `src/app/solicitacao/[id]/page.tsx`
- Cliente: `src/app/solicitacao/[id]/RequestDetailClient.tsx`

#### 2.2.1. Bloco de informações principais

- Título, tipo (Filme, Série, Anime, etc.).
- Dados do TMDB (poster, overview, ano).
- Campos da solicitação:
  - `status` (formatado em texto amigável).
  - `workflowState` (estado do fluxo interno).
  - Seguidores.
  - Observações do usuário (qualidade desejada, idiomas, nota).

#### 2.2.2. Painel do administrador

Visível apenas para admins, enquanto a solicitação **não** estiver `COMPLETED` ou `REJECTED`.

Elementos principais:

- Mensagens de feedback (sucesso/erro) das ações.
- **Seção de ownership**:
  - Se houver `AssignedAdmin`:
    - `Responsável: <nome ou email>`
    - `Desde dd/mm/aaaa hh:mm` (usando `assignedAt`).
  - Caso contrário:
    - `Sem responsável definido.`
- **Botão "Assumir caso"**:
  - Chama `POST /api/admin/solicitacoes/[id]/atribuir`.
  - Depois recarrega os dados, atualizando owner e histórico.
- **Ações de status/workflow** (já existentes):
  - Marcar como "Em análise" (`UNDER_REVIEW`).
  - Marcar como "Concluída" (`COMPLETED`).
  - Marcar como "Recusada" (`REJECTED`).
  - Alterar `workflowState` conforme etapas internas.
- **Notas internas**:
  - Textarea para digitar uma anotação.
  - Botão "Adicionar nota interna".
  - Ao salvar, recarrega a timeline mostrando a nova anotação.

#### 2.2.3. Histórico (timeline)

- Baseado em `RequestHistory`, ordenado por `createdAt ASC`.
- Cada item mostra:
  - Ação formatada (por ex. `Solicitação criada`, `Status alterado`, `Anotação adicionada`).
  - Mensagem associada (quando existir).
  - Data/hora da ocorrência.
  - Em anotação interna (`NOTE_ADDED`), a mensagem é o texto da nota.

---

## 3. APIs do workflow de solicitações

### 3.1. Listagem admin

**Endpoint:** `GET /api/admin/solicitacoes`

Arquivo: `src/app/api/admin/solicitacoes/route.ts`

Principais responsabilidades:

- Aplicar filtros por:
  - `type` (MOVIE, SERIES, ANIME, etc.).
  - `status` (PENDING, UNDER_REVIEW, etc.).
  - `upload` (with/without upload vinculado).
  - `assigned` (me/unassigned).
- Ordenar por prioridade, SLA, seguidores, etc.
- Incluir relações:
  - `User` (dono da solicitação).
  - `RequestUpload` + `Title` vinculado (se houver).
  - `AssignedAdmin` (responsável atual).

O objeto retornado para cada item inclui, entre outros:

- `assignedAdminId`
- `assignedAt`
- `AssignedAdmin { id, email, name } | null`

### 3.2. Detalhe da solicitação (usuário + admin)

**Endpoint:** `GET /api/solicitacoes/[id]`

Arquivo: `src/app/api/solicitacoes/[id]/route.ts`

- Valida sessão.
- Carrega `Request` com:
  - `RequestHistory` (ordenado).
  - `AssignedAdmin`.
- Retorna os campos completos para o `RequestDetailClient` renderizar o painel do admin, histórico e dados do TMDB.

### 3.3. Assumir solicitação

**Endpoint:** `POST /api/admin/solicitacoes/[id]/atribuir`

Arquivo: `src/app/api/admin/solicitacoes/[id]/atribuir/route.ts`

Fluxo:

1. Valida sessão e role `ADMIN`.
2. Lê `id` da URL e `message?` do body.
3. Garante que a solicitação existe.
4. Atualiza `Request`:
   - `assignedAdminId = admin logado`.
   - `assignedAt = new Date()`.
5. Cria `RequestHistory` com:
   - `action = ASSIGNED`.
   - `message` opcional.
   - `adminId` do admin logado.
6. Notifica dono e seguidores via push e e‑mail.

**Regras de ownership:**

- Se já havia outro `AssignedAdmin`, ele é substituído pelo admin atual.
- O histórico mantém o rastro da atribuição (`ASSIGNED`).

### 3.4. Notas internas

**Endpoint:** `POST /api/admin/solicitacoes/[id]/add-note`

Arquivo: `src/app/api/admin/solicitacoes/[id]/add-note/route.ts`

Fluxo:

1. Valida sessão e role `ADMIN`.
2. Lê `id` da URL e `message` do body.
3. Garante que a solicitação existe.
4. Valida que `message` não está vazia.
5. Cria `RequestHistory` com:
   - `action = NOTE_ADDED`.
   - `message` com o texto da anotação.
   - `adminId` do admin logado.

Uso típico:

- Documentar decisões técnicas.
- Registrar contexto de negociações/requisitos com o usuário.
- Deixar dicas para outro admin que venha assumir o caso depois.

### 3.5. Outros endpoints relacionados

Sem alteração de contrato, mas importantes para o workflow:

- `POST /api/admin/solicitacoes/[id]/status`
  - Atualiza `status` (`UNDER_REVIEW`, `IN_PRODUCTION`, `COMPLETED`, `REJECTED`, etc.).
  - Registra em `RequestHistory` com `STATUS_CHANGED`.
- `POST /api/admin/solicitacoes/[id]/workflow`
  - Atualiza `workflowState`.
  - Registra em `RequestHistory` com `WORKFLOW_CHANGED`.
- `POST /api/admin/solicitacoes/[id]/concluir`
  - Marca como concluída (`COMPLETED`).
  - Atualiza histórico e envia notificações.
- `POST /api/admin/solicitacoes/[id]/recusar`
  - Marca como recusada (`REJECTED`).
  - Atualiza histórico e envia notificações.

---

## 4. Fluxos operacionais para administradores

### 4.1. Assumir um caso e continuar depois

1. Abrir `/admin/solicitacoes`.
2. Filtrar por `Sem responsável` (opcional).
3. Clicar na solicitação desejada.
4. No painel do admin (detalhe):
   - Clicar em **"Assumir caso"**.
5. A partir deste ponto:
   - A lista admin passa a mostrar você como `Responsável`.
   - O filtro `Minhas` passa a listar essa solicitação para você.
   - O `assignedAt` guarda quando você assumiu (para análise de fila/SLA).

### 4.2. Usar filtros "Minhas" e "Sem responsável"

- Em `/admin/solicitacoes`:
  - `Responsável = Minhas` → mostra apenas solicitações onde `assignedAdminId` é o seu id.
  - `Responsável = Sem responsável` → ajuda a encontrar itens não assumidos.

### 4.3. Registrar contexto com notas internas

1. Abrir `/solicitacao/[id]`.
2. No painel do admin, localizar a seção **Notas internas**.
3. Escrever um resumo claro, por exemplo:
   - "Esperando resposta do usuário sobre idioma preferido."
   - "Arquivos fonte baixados, aguardando encoding."
4. Clicar em **"Adicionar nota interna"**.
5. Conferir no histórico que a ação `Anotação adicionada` foi criada.

Recomendações:

- Escrever sempre em tom objetivo e técnico.
- Usar uma anotação por assunto (melhor para leitura futura).

### 4.4. Encerrar o caso

- Quando o conteúdo estiver pronto:
  - Usar as ações existentes para marcar como `COMPLETED` ou `REJECTED`.
  - Opcionalmente, adicionar nota interna explicando o motivo da conclusão/recusa.

---

## 5. Migrações e manutenção

### 5.1. Campos de ownership

Os campos `assignedAdminId` e `assignedAt`, além da relação `AssignedAdmin`, estão definidos em `prisma/schema.prisma`. Quando houver ajustes futuros nesses campos, seguir o guia:

- `docs/ops/PRISMA_MIGRATIONS_GUIDE.md`

### 5.2. Comandos principais (desenvolvimento)

Resumo dos comandos mais comuns (detalhados no guia de migrations):

```bash
# Sincronizar schema com o banco (desenvolvimento, não destrutivo)
npx prisma db push

# Gerar client Prisma
npx prisma generate

# Rodar build completo da aplicação
npm run build
```

---

## 6. Checklist rápido de sanity

Antes de considerar o módulo de solicitações estável após mudanças:

- [ ] Conseguir **assumir** uma solicitação como admin.
- [ ] Ver o nome do responsável e a data "Desde" na lista admin.
- [ ] Filtrar solicitações por `Minhas` e `Sem responsável`.
- [ ] Adicionar notas internas e vê-las na timeline.
- [ ] Alterar status e workflow normalmente.
- [ ] `npm run build` finaliza sem erros.
