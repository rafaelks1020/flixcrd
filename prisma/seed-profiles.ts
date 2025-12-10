import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Criando perfis padrão para usuários existentes...");

  const users = await prisma.user.findMany({
    include: {
      Profile: true,
    },
  });

  for (const user of users) {
    if (user.Profile.length === 0) {
      await prisma.profile.create({
        data: {
          id: randomUUID(),
          userId: user.id,
          name: user.name || "Perfil Principal",
          avatar: "👤",
          isKids: false,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ Perfil criado para ${user.email}`);
    } else {
      console.log(`⏭️  ${user.email} já tem ${user.Profile.length} perfil(is)`);
    }
  }

  console.log("✨ Seed concluído!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
