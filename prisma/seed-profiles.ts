import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Criando perfis padrão para usuários existentes...");

  const users = await prisma.user.findMany({
    include: {
      profiles: true,
    },
  });

  for (const user of users) {
    if (user.profiles.length === 0) {
      await prisma.profile.create({
        data: {
          userId: user.id,
          name: user.name || "Perfil Principal",
          avatar: "👤",
          isKids: false,
        },
      });
      console.log(`✅ Perfil criado para ${user.email}`);
    } else {
      console.log(`⏭️  ${user.email} já tem ${user.profiles.length} perfil(is)`);
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
