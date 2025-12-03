/**
 * Script para testar permissões do banco de dados
 * Verifica se o usuário consegue criar schemas e fazer migrations
 * 
 * Uso: npx ts-node scripts/test-db-permissions.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testPermissions() {
  console.log("🔍 Testando permissões do banco de dados...\n");

  try {
    // 1. Testar conexão básica
    console.log("1️⃣ Testando conexão com o banco...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("   ✅ Conexão OK\n");

    // 2. Verificar usuário atual
    console.log("2️⃣ Verificando usuário atual...");
    const userResult: any = await prisma.$queryRaw`SELECT current_user, current_database()`;
    console.log(`   👤 Usuário: ${userResult[0].current_user}`);
    console.log(`   💾 Database: ${userResult[0].current_database}\n`);

    // 3. Verificar permissões de CREATE no database
    console.log("3️⃣ Verificando permissão CREATE no database...");
    const dbPerms: any = await prisma.$queryRaw`
      SELECT has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema
    `;
    if (dbPerms[0].can_create_schema) {
      console.log("   ✅ Permissão CREATE no database: OK");
      console.log("   📝 Pode criar schemas para shadow database\n");
    } else {
      console.log("   ❌ Permissão CREATE no database: NEGADA");
      console.log("   ⚠️  Não pode criar shadow database automaticamente\n");
    }

    // 4. Verificar permissões no schema public
    console.log("4️⃣ Verificando permissões no schema public...");
    const schemaPerms: any = await prisma.$queryRaw`
      SELECT 
        has_schema_privilege(current_user, 'public', 'CREATE') as can_create,
        has_schema_privilege(current_user, 'public', 'USAGE') as can_use
    `;
    console.log(`   CREATE: ${schemaPerms[0].can_create ? '✅' : '❌'}`);
    console.log(`   USAGE: ${schemaPerms[0].can_use ? '✅' : '❌'}\n`);

    // 5. Testar criação de tabela temporária
    console.log("5️⃣ Testando criação de tabela temporária...");
    try {
      await prisma.$executeRaw`
        CREATE TEMP TABLE test_permissions (
          id SERIAL PRIMARY KEY,
          name TEXT
        )
      `;
      await prisma.$executeRaw`DROP TABLE test_permissions`;
      console.log("   ✅ Pode criar tabelas temporárias\n");
    } catch (error: any) {
      console.log("   ❌ Erro ao criar tabela temporária:", error.message, "\n");
    }

    // 6. Verificar se schema shadow existe
    console.log("6️⃣ Verificando se schema 'shadow' existe...");
    const shadowExists: any = await prisma.$queryRaw`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'shadow'
      ) as exists
    `;
    if (shadowExists[0].exists) {
      console.log("   ✅ Schema 'shadow' existe");
      
      // Verificar permissões no schema shadow
      const shadowPerms: any = await prisma.$queryRaw`
        SELECT 
          has_schema_privilege(current_user, 'shadow', 'CREATE') as can_create,
          has_schema_privilege(current_user, 'shadow', 'USAGE') as can_use
      `;
      console.log(`   CREATE no shadow: ${shadowPerms[0].can_create ? '✅' : '❌'}`);
      console.log(`   USAGE no shadow: ${shadowPerms[0].can_use ? '✅' : '❌'}\n`);
    } else {
      console.log("   ⚠️  Schema 'shadow' não existe\n");
    }

    // 7. Resumo e recomendações
    console.log("📊 RESUMO:\n");
    
    if (dbPerms[0].can_create_schema) {
      console.log("✅ Permissões OK para usar 'prisma migrate dev'");
      console.log("   O Prisma pode criar shadow database automaticamente\n");
    } else if (shadowExists[0].exists) {
      console.log("✅ Pode usar 'prisma migrate dev' com shadow database manual");
      console.log("   Configure SHADOW_DATABASE_URL no .env:\n");
      console.log('   SHADOW_DATABASE_URL="postgresql://user:pass@host:port/db?schema=shadow"\n');
    } else {
      console.log("⚠️  Use 'prisma db push' em vez de 'prisma migrate dev'");
      console.log("   OU peça ao DBA para executar:\n");
      console.log("   -- Opção 1: Dar permissão CREATE");
      console.log("   GRANT CREATE ON DATABASE crdflix_db TO crdflix_user;\n");
      console.log("   -- Opção 2: Criar schema shadow manualmente");
      console.log("   CREATE SCHEMA IF NOT EXISTS shadow;");
      console.log("   GRANT ALL PRIVILEGES ON SCHEMA shadow TO crdflix_user;\n");
    }

  } catch (error: any) {
    console.error("❌ Erro durante teste:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPermissions();
