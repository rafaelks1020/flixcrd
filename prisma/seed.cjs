const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  const userPasswordHash = await bcrypt.hash("user123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@flixcrd.local" },
    update: {},
    create: {
      email: "admin@flixcrd.local",
      name: "Admin FlixCRD",
      passwordHash,
      role: "ADMIN",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@flixcrd.local" },
    update: {},
    create: {
      email: "user@flixcrd.local",
      name: "Usuário FlixCRD",
      passwordHash: userPasswordHash,
      role: "USER",
    },
  });

  console.log("Seed concluído.");
  console.log("Usuário admin:", admin.email);
  console.log("Usuário comum:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
