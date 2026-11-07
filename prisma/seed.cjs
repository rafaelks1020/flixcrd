const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error("Erro: ADMIN_EMAIL e ADMIN_PASSWORD devem estar definidos no ambiente.");
    process.exit(1);
  }

  if (adminPassword.length < 12) {
    console.error("Erro: ADMIN_PASSWORD deve ter pelo menos 12 caracteres.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin FlixCRD",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Seed concluído.");
  console.log("Usuário admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
