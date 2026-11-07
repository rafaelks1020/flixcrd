/** @jest-environment node */
import { compare, hash } from "bcryptjs";
import { getSettings } from "@/lib/settings";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAppSettings, invalidateSettingsCache, verifyAdultPin } from "@/lib/app-settings";
import { GET, PUT } from "@/app/api/admin/settings/route";
import { GET as publicSettings } from "@/app/api/settings/public/route";

jest.mock("@/lib/prisma", () => ({ prisma: { settings: {
  findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn(),
} } }));
jest.mock("@/lib/require-admin", () => ({ requireAdmin: jest.fn().mockResolvedValue({ id: "admin" }) }));

const settings = jest.mocked(prisma.settings);
const record = (adultContentPin: string | null) => ({ id: "settings", adultContentPin });

beforeEach(() => {
  jest.clearAllMocks();
  invalidateSettingsCache();
});

describe("Proteção do PIN adulto", () => {
  it("valida hash bcrypt e rejeita PIN incorreto", async () => {
    settings.findFirst.mockResolvedValue(record(await hash("1234", 4)) as never);
    await expect(verifyAdultPin("1234")).resolves.toBe(true);
    await expect(verifyAdultPin("9999")).resolves.toBe(false);
    expect(settings.updateMany).not.toHaveBeenCalled();
  });

  it("migra PIN legado somente após uma comparação correta", async () => {
    settings.findFirst.mockResolvedValue(record("1234") as never);
    settings.updateMany.mockResolvedValue({ count: 1 });
    await expect(verifyAdultPin("9999")).resolves.toBe(false);
    expect(settings.updateMany).not.toHaveBeenCalled();
    await expect(verifyAdultPin("1234")).resolves.toBe(true);
    const update = settings.updateMany.mock.calls[0][0]!;
    expect(update.where).toEqual({ id: "settings", adultContentPin: "1234" });
    const saved = update.data.adultContentPin as string;
    expect(saved.startsWith("$2")).toBe(true);
    await expect(compare("1234", saved)).resolves.toBe(true);
  });

  it("revalida se o PIN foi alterado durante a migração", async () => {
    settings.findFirst.mockResolvedValueOnce(record("1234") as never)
      .mockResolvedValueOnce(record(await hash("5678", 4)) as never);
    settings.updateMany.mockResolvedValue({ count: 0 });
    await expect(verifyAdultPin("1234")).resolves.toBe(false);
  });

  it("permite acesso quando não há PIN", async () => {
    settings.findFirst.mockResolvedValue(record(null) as never);
    await expect(verifyAdultPin("1234")).resolves.toBe(true);
  });

  it("não expõe PIN nem hash nos helpers e nas APIs", async () => {
    settings.findFirst.mockResolvedValue(record("segredo") as never);
    const app = await getAppSettings();
    const admin = await (await GET()).json();
    const publicData = await (await publicSettings()).json();
    for (const data of [app, admin, publicData, await getSettings()]) {
      expect(data).not.toHaveProperty("adultContentPin");
      expect(JSON.stringify(data)).not.toContain("segredo");
    }
    expect(admin.hasAdultContentPin).toBe(true);
  });

  it("grava hash ao definir PIN e permite preservar ou remover", async () => {
    settings.findFirst.mockResolvedValue(record("1234") as never);
    settings.update.mockImplementation((args) =>
      Promise.resolve({ ...record(null), ...args.data }) as unknown as ReturnType<typeof prisma.settings.update>);
    const put = (body: object) => PUT(new NextRequest("http://localhost/api/admin/settings", {
      method: "PUT", body: JSON.stringify(body),
    }));
    const response = await put({ adultContentPin: "5678" });
    const data = await response.json();
    expect(data.hasAdultContentPin).toBe(true);
    expect(data).not.toHaveProperty("adultContentPin");
    const saved = settings.update.mock.calls[0][0].data.adultContentPin as string;
    await expect(compare("5678", saved)).resolves.toBe(true);
    await put({ siteName: "Pflix" });
    expect(settings.update.mock.calls[1][0].data).not.toHaveProperty("adultContentPin");
    const removed = await (await put({ adultContentPin: null })).json();
    expect(settings.update.mock.calls[2][0].data.adultContentPin).toBeNull();
    expect(removed.hasAdultContentPin).toBe(false);
  });
});
