import { prisma } from "./prisma";

const db = prisma as any;

export async function getSettings() {
  const existing = await db.settings.findFirst();
  if (existing) return existing;

  return db.settings.create({ data: {} });
}
