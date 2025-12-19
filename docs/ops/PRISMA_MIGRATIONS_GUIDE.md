# Guia Definitivo: Prisma Migrations no FlixCRD

Este documento explica **exatamente** como gerenciar o schema do banco de dados usando Prisma, evitando os erros de "drift" e perda de dados.

---

## TL;DR - Comandos que você vai usar 99% do tempo

```bash
# Desenvolvimento local - criar/aplicar migration
npx prisma migrate dev --name nome_da_migration

# Produção - aplicar migrations pendentes
npx prisma migrate deploy

# Emergência - sincronizar banco sem migration (cuidado!)
npx prisma db push
```

---

## 1. Entendendo as duas estratégias do Prisma

### Estratégia A: `prisma migrate` (Recomendada para produção)

- Cria arquivos SQL versionados na pasta `prisma/migrations/`
- Cada migration tem um timestamp único (ex: `20251210120000_add_email_log`)
- O Prisma mantém uma tabela `_prisma_migrations` no banco para rastrear quais já foram aplicadas
- **Vantagem**: Histórico completo, rollback possível, deploy seguro em produção
- **Desvantagem**: Mais burocrático, pode dar "drift" se mexer no banco por fora

### Estratégia B: `prisma db push` (Boa para prototipação)

- Aplica mudanças do schema direto no banco, sem criar migration
- Não mantém histórico de mudanças
- **Vantagem**: Rápido, sem burocracia
- **Desvantagem**: Sem histórico, pode perder dados se remover campos

---

## 2. O que aconteceu no nosso caso (e por que deu erro)

### Problema: "Drift detected"

```
Drift detected: Your database schema is not in sync with your migration history.
```

**Causa**: O banco foi modificado por fora do fluxo de migrations (provavelmente via `db push` ou SQL direto), mas existiam arquivos de migration na pasta `prisma/migrations/`. O Prisma comparou:

1. O que as migrations dizem que deveria existir
2. O que realmente existe no banco

E encontrou diferenças (drift).

### Solução aplicada

1. Deletamos a pasta `prisma/migrations/` (que estava dessincronizada)
2. Usamos `npx prisma db pull` para trazer o schema atual do banco para o arquivo `schema.prisma`
3. Usamos `npx prisma db push` para confirmar que está tudo em sync
4. Rodamos `npx prisma generate` para gerar o client

**A partir de agora**, podemos escolher:
- Continuar com `db push` (mais simples)
- Ou iniciar um novo histórico de migrations (mais robusto)

---

## 3. Fluxo correto para CRIAR uma nova migration

### Passo 1: Editar o schema

Abra `prisma/schema.prisma` e faça suas alterações. Exemplo:

```prisma
model EmailLog {
  id        String   @id @default(cuid())
  status    String
  to        String
  subject   String
  // Novo campo que você quer adicionar:
  provider  String   @default("mailjet")
  createdAt DateTime @default(now())
}
```

### Passo 2: Criar a migration (desenvolvimento)

```bash
npx prisma migrate dev --name add_provider_to_email_log
```

O que esse comando faz:
1. Compara o `schema.prisma` com o banco atual
2. Gera um arquivo SQL em `prisma/migrations/TIMESTAMP_add_provider_to_email_log/migration.sql`
3. Aplica o SQL no banco de desenvolvimento
4. Regenera o Prisma Client

### Passo 3: Commitar a migration

```bash
git add prisma/migrations
git add prisma/schema.prisma
git commit -m "Add provider field to EmailLog"
```

### Passo 4: Aplicar em produção

No servidor de produção (ou no deploy):

```bash
npx prisma migrate deploy
```

Este comando:
- Lê a pasta `prisma/migrations/`
- Verifica quais migrations ainda não foram aplicadas (via tabela `_prisma_migrations`)
- Aplica apenas as pendentes

---

## 4. Cenários comuns e como resolver

### Cenário 1: Quero adicionar um campo simples

```bash
# 1. Editar schema.prisma
# 2. Criar e aplicar migration
npx prisma migrate dev --name add_campo_x

# 3. Commitar
git add prisma/
git commit -m "Add campo X to Model Y"
```

### Cenário 2: Quero remover um campo (CUIDADO - perde dados!)

```bash
# 1. Editar schema.prisma (remover o campo)
# 2. Criar migration
npx prisma migrate dev --name remove_campo_x

# O Prisma vai avisar que dados serão perdidos
# Confirme apenas se tiver certeza
```

### Cenário 3: Quero renomear um campo (sem perder dados)

O Prisma não sabe "renomear" automaticamente. Ele vai deletar o campo antigo e criar um novo (perdendo dados).

**Solução**: Fazer em 3 migrations:

```bash
# Migration 1: Adicionar campo novo
npx prisma migrate dev --name add_new_field_name

# (Rodar script para copiar dados do campo antigo pro novo)

# Migration 2: Remover campo antigo
npx prisma migrate dev --name remove_old_field_name
```

### Cenário 4: Deu "drift" e não quero perder dados

```bash
# 1. Fazer backup do banco (SEMPRE!)

# 2. Trazer o schema atual do banco
npx prisma db pull

# 3. Verificar o que mudou no schema.prisma
git diff prisma/schema.prisma

# 4. Se estiver OK, sincronizar sem migration
npx prisma db push

# 5. Regenerar client
npx prisma generate

# 6. (Opcional) Iniciar novo histórico de migrations - ver seção 5
```

### Cenário 5: Quero ver o SQL que seria gerado sem aplicar

```bash
npx prisma migrate dev --create-only --name nome_da_migration
```

Isso cria o arquivo SQL mas NÃO aplica. Você pode revisar e até editar o SQL antes de aplicar com:

```bash
npx prisma migrate dev
```

### Cenário 6: Uma migration falhou no meio

```bash
# Marcar como resolvida (se você corrigiu manualmente)
npx prisma migrate resolve --applied NOME_DA_MIGRATION

# Ou marcar como rollback (se você desfez)
npx prisma migrate resolve --rolled-back NOME_DA_MIGRATION
```

---

## 5. Como iniciar um novo histórico de migrations (baseline)

Se você tem um banco em produção que foi criado sem migrations e quer começar a usar migrations:

### Passo 1: Garantir que schema.prisma reflete o banco atual

```bash
npx prisma db pull
```

### Passo 2: Criar migration baseline

```bash
mkdir -p prisma/migrations/0_baseline
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0_baseline/migration.sql
```

### Passo 3: Criar arquivo de lock

Criar `prisma/migrations/migration_lock.toml`:

```toml
provider = "postgresql"
```

### Passo 4: Marcar como já aplicada

```bash
npx prisma migrate resolve --applied 0_baseline
```

Se der erro "migration not found", o nome precisa ter timestamp:

```bash
# Renomear pasta
mv prisma/migrations/0_baseline prisma/migrations/20251210000000_baseline

# Tentar novamente
npx prisma migrate resolve --applied 20251210000000_baseline
```

### Passo 5: Verificar status

```bash
npx prisma migrate status
```

Deve mostrar a migration baseline como aplicada.

---

## 6. Comandos úteis de diagnóstico

```bash
# Ver status das migrations
npx prisma migrate status

# Ver diferença entre schema e banco
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# Resetar banco completamente (DESENVOLVIMENTO APENAS!)
npx prisma migrate reset

# Gerar client sem aplicar nada
npx prisma generate

# Ver schema do banco atual
npx prisma db pull --print
```

---

## 7. Regras de ouro

1. **NUNCA rode `migrate reset` em produção** - apaga todos os dados

2. **SEMPRE faça backup antes de migrations destrutivas** (remover campo, mudar tipo)

3. **SEMPRE commite as migrations junto com o schema.prisma**

4. **NUNCA edite migrations que já foram aplicadas em produção**

5. **Se deu drift, não entre em pânico**:
   - `db pull` para ver o estado real
   - `db push` para sincronizar
   - Depois organize as migrations

6. **Em produção, use apenas `migrate deploy`** - nunca `migrate dev`

7. **Campos novos devem ser opcionais ou ter default** - senão a migration falha em tabelas com dados

---

## 8. Estrutura esperada da pasta prisma/

```
prisma/
├── schema.prisma              # Definição do schema
├── migrations/
│   ├── migration_lock.toml    # Lock do provider (postgresql)
│   ├── 20251203204259_init/
│   │   └── migration.sql      # SQL da migration inicial
│   ├── 20251210120000_add_email_log/
│   │   └── migration.sql      # SQL para adicionar EmailLog
│   └── ...
└── (opcional) seed.ts         # Script de seed
```

---

## 9. Checklist antes de fazer migration em produção

- [ ] Testei a migration no ambiente de desenvolvimento
- [ ] Fiz backup do banco de produção
- [ ] Verifiquei se a migration é destrutiva (remove dados?)
- [ ] Commitei o arquivo `prisma/migrations/*/migration.sql`
- [ ] Commitei o `prisma/schema.prisma` atualizado
- [ ] O comando em produção será `npx prisma migrate deploy`

---

## 10. Referências

- [Prisma Migrate Docs](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Baselining a Database](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/baselining)
- [Troubleshooting](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/troubleshooting-development)

---

**Última atualização**: 2025-12-11  
**Autor**: Cascade AI + FlixCRD Team
