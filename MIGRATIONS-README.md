# 📚 Guia de Migrations - LEIA ISSO ANTES DE FAZER QUALQUER COISA

## ⚠️ REGRA DE OURO: NUNCA MEXA NO BANCO DIRETAMENTE!

Se você mexer no banco sem criar migration, VAI DAR DRIFT! 💥

---

## 🎯 Como Adicionar uma Nova Tabela ou Campo

### Passo 1: Editar o `schema.prisma`
Adicione seu modelo ou campo no arquivo `prisma/schema.prisma`.

Exemplo:
```prisma
model MinhaNovaTabela {
  id        String   @id @default(cuid())
  nome      String
  createdAt DateTime @default(now())
}
```

### Passo 2: Criar a Migration NO AMBIENTE DE DESENVOLVIMENTO LOCAL
```bash
npx prisma migrate dev --name nome_da_sua_migration --skip-seed
```

**IMPORTANTE:** Isso vai:
- Criar o arquivo de migration em `prisma/migrations/`
- Aplicar no seu banco LOCAL
- Gerar o Prisma Client automaticamente

### Passo 3: Aplicar a Migration no Banco de PRODUÇÃO/HOMOLOG
```bash
npx prisma migrate deploy
```

**IMPORTANTE:** Use `migrate deploy` em produção, NUNCA `migrate dev`!

### Passo 4: Gerar o Prisma Client (se necessário)
```bash
npx prisma generate
```

---

## 🚨 O que fazer se der DRIFT?

Se você ver a mensagem `Drift detected`, significa que o banco está diferente do schema.

### Solução 1: Se você FEZ mudanças no banco manualmente (NÃO FAÇA ISSO!)

**Passo 1:** Sincronize o schema com o banco
```bash
npx prisma db pull --force
```

**Passo 2:** Gere o client
```bash
npx prisma generate
```

**Passo 3:** Verifique o status
```bash
npx prisma migrate status
```

### Solução 2: Se as mudanças estão no schema mas não no banco

**Passo 1:** Crie um script Node.js para aplicar as mudanças:

```javascript
// apply-changes.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Coloque aqui o SQL que precisa ser executado
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MinhaTabela" (
        "id" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        CONSTRAINT "MinhaTabela_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✅ Mudanças aplicadas!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
})();
```

**Passo 2:** Execute o script
```bash
node apply-changes.js
```

**Passo 3:** Sincronize o schema
```bash
npx prisma db pull --force
npx prisma generate
```

**Passo 4:** Delete o script temporário
```bash
rm apply-changes.js
```

---

## ✅ Verificar se está tudo OK

```bash
npx prisma migrate status
```

Deve mostrar: `Database schema is up to date!`

---

## 📝 Checklist para QUALQUER mudança no banco

- [ ] Editei o `schema.prisma`?
- [ ] Rodei `npx prisma migrate dev` (LOCAL) ou `npx prisma migrate deploy` (PRODUÇÃO)?
- [ ] Rodei `npx prisma generate`?
- [ ] Commitei os arquivos de migration junto com o código?
- [ ] Verifiquei com `npx prisma migrate status`?

---

## 🔥 NUNCA FAÇA ISSO:

❌ Executar SQL direto no banco sem criar migration  
❌ Usar `npx prisma migrate dev` em produção  
❌ Deletar arquivos de migration  
❌ Editar migrations já aplicadas  
❌ Usar `migrate reset` em produção (VAI APAGAR TUDO!)  

---

## ✅ SEMPRE FAÇA ISSO:

✅ Use `npx prisma migrate dev` no LOCAL  
✅ Use `npx prisma migrate deploy` em PRODUÇÃO  
✅ Commite as migrations junto com o código  
✅ Teste as migrations no LOCAL antes de aplicar em produção  
✅ Faça backup do banco antes de migrations grandes  

---

## 🆘 Emergência: Como resolver qualquer problema de migration

Se TUDO der errado e você não souber o que fazer:

```bash
# 1. Sincronizar schema com o banco (traz o que TÁ NO BANCO pro schema)
npx prisma db pull --force

# 2. Gerar o client
npx prisma generate

# 3. Verificar status
npx prisma migrate status

# 4. Pronto! O schema agora reflete exatamente o que está no banco.
```

**IMPORTANTE:** Isso NÃO cria migration nova, apenas sincroniza o schema com o banco atual.

---

## 📞 Ainda está com dúvida?

Leia este README de novo. Sério. Leia de novo. 🙃

**Regra de ouro:** O SCHEMA PRISMA deve sempre refletir o BANCO DE DADOS.

Se você mudou o schema → Crie migration e aplique no banco.  
Se você mudou o banco → Sincronize o schema com `db pull`.

SIMPLES ASSIM! 🎉

