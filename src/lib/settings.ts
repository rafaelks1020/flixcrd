import { prisma } from "./prisma";

export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return settingsWithoutPin(existing);

  return settingsWithoutPin(await prisma.settings.create({ data: {} }));
}

export function settingsWithoutPin<T extends { adultContentPin: string | null }>(settings: T) {
  const { adultContentPin, ...safeSettings } = settings;
  return { ...safeSettings, hasAdultContentPin: Boolean(adultContentPin) };
}
