import { prisma } from "./prisma";

export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return existing;

  return prisma.settings.create({ data: {} });
}
