/**
 * Script para criar usuário admin
 * 
 * Uso: npx ts-node scripts/create-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = "Administrador";

  if (!email || !password) {
    console.error("❌ Erro: ADMIN_EMAIL e ADMIN_PASSWORD devem estar definidos no ambiente.");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error("❌ Erro: ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
    process.exit(1);
  }

  console.log("🔐 Criando usuário administrador...\n");

  // Verificar se já existe
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log("⚠️  Usuário admin já existe!");
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${existing.role}\n`);
    
    if (existing.role !== "ADMIN") {
      console.log("🔄 Atualizando role para ADMIN...");
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN" },
      });
      console.log("✅ Role atualizada!\n");
    }

    // Criar perfil padrão se não existir
    const profileCount = await prisma.profile.count({
      where: { userId: existing.id },
    });

    if (profileCount === 0) {
      await prisma.profile.create({
        data: {
          id: randomUUID(),
          userId: existing.id,
          name: "Admin",
          avatar: "👤",
          isKids: false,
          updatedAt: new Date(),
        },
      });
      console.log("✅ Perfil padrão criado!\n");
    }

    return;
  }

  // Criar hash da senha
  const passwordHash = await bcrypt.hash(password, 10);

  // Criar usuário
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      role: "ADMIN",
      updatedAt: new Date(),
    },
  });

  // Criar perfil padrão
  await prisma.profile.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      name: "Admin",
      avatar: "👤",
      isKids: false,
      updatedAt: new Date(),
    },
  });

  console.log("✅ Usuário administrador criado com sucesso!\n");
  console.log("📧 Email:", email);
  console.log("\n⚠️  IMPORTANTE: Altere a senha após o primeiro login se necessário!\n");
}

async function main() {
  try {
    await createAdmin();
  } catch (error) {
    console.error("❌ Erro ao criar admin:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
