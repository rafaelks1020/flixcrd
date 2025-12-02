const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@flixcrd.local" },
    update: {},
    create: {
      email: "admin@flixcrd.local",
      name: "Admin FlixCRD",
      passwordHash,
    },
  });

  console.log("Seed concluído. Usuário admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
