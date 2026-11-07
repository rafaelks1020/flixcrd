/** @jest-environment node */
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth-mobile";
import { POST, GET } from "@/app/api/titles/[id]/progress/route";
import { GET as continueWatching } from "@/app/api/user/continue-watching/route";
import { GET as payments } from "@/app/api/payments/route";
import { GET as subscriptionDetails } from "@/app/api/subscription/create/route";
import { toMoney } from "@/lib/money";

jest.mock("@/lib/prisma", () => {
  const { PrismaClient } = jest.requireActual("@prisma/client");
  return { prisma: new PrismaClient({ datasources: { db: {
    url: "postgresql://postgres:teste@127.0.0.1:5442/flix",
  } } }) };
});
jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/auth-mobile", () => ({ getAuthUser: jest.fn() }));
// A consulta de assinatura não usa as integrações de cobrança ou envio de email.
jest.mock("@/lib/asaas", () => ({}));
jest.mock("@/lib/inter", () => ({}));
jest.mock("@/lib/email", () => ({}));

const testUrl = "postgresql://postgres:teste@127.0.0.1:5442/flix";
const describeDatabase = process.env.DATABASE_URL === testUrl ? describe : describe.skip;

describeDatabase("Dados no banco de teste autorizado", () => {
  const suffix = randomUUID();
  const userId = `dados-user-${suffix}`;
  let profileId: string;
  let titleId: string;
  let movieId: string;
  let episodeIds: string[];

  beforeAll(async () => {
    await prisma.user.create({ data: {
      id: userId, email: `dados-${suffix}@example.test`, passwordHash: "teste",
    } });
    profileId = (await prisma.profile.create({ data: { userId, name: "Teste" } })).id;
    const title = await prisma.title.create({ data: {
      slug: `dados-serie-${suffix}`, name: "Série de teste", type: "SERIES",
      Season: { create: { seasonNumber: 1 } },
    }, include: { Season: true } });
    titleId = title.id;
    episodeIds = [];
    for (const episodeNumber of [1, 2]) {
      const episode = await prisma.episode.create({ data: {
        titleId, seasonId: title.Season[0].id, seasonNumber: 1, episodeNumber, name: `Episódio ${episodeNumber}`,
      } });
      episodeIds.push(episode.id);
    }
    movieId = (await prisma.title.create({ data: {
      slug: `dados-filme-${suffix}`, name: "Filme de teste", type: "MOVIE",
    } })).id;
    jest.mocked(getServerSession).mockResolvedValue({ user: { id: userId, email: `dados-${suffix}@example.test`, role: "USER" } });
    jest.mocked(getAuthUser).mockResolvedValue({ id: userId, role: "USER" } as never);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.title.deleteMany({ where: { slug: { in: [`dados-serie-${suffix}`, `dados-filme-${suffix}`] } } });
    await prisma.$disconnect();
  });

  const save = (id: string, episodeId?: string) => POST(new NextRequest(`http://localhost/api/titles/${id}/progress`, {
    method: "POST", body: JSON.stringify({ profileId, episodeId, positionSeconds: 60, durationSeconds: 600 }),
  }), { params: Promise.resolve({ id }) });

  it("salva dois episódios e filmes no mesmo perfil sem colisão", async () => {
    for (const episodeId of episodeIds) expect((await save(titleId, episodeId)).status).toBe(200);
    // Inclui o fallback sem episódio no mesmo título para validar o índice parcial.
    for (const id of [titleId, movieId]) {
      const responses = await Promise.all(Array.from({ length: 4 }, () => save(id)));
      expect(responses.every((response) => response.status === 200)).toBe(true);
    }
    expect(await prisma.playbackProgress.count({ where: { profileId } })).toBe(4);
    expect(await prisma.playbackProgress.count({ where: { profileId, titleId, episodeId: null } })).toBe(1);
    const progress = await GET(new NextRequest(`http://localhost/api/titles/${movieId}/progress?profileId=${profileId}`), {
      params: Promise.resolve({ id: movieId }),
    });
    expect(await progress.json()).toEqual({ positionSeconds: 60, durationSeconds: 600 });

    await prisma.playbackProgress.update({ where: { profileId_episodeId: { profileId, episodeId: episodeIds[1] } },
      data: { updatedAt: new Date(Date.now() + 1000) } });
    const response = await continueWatching(new NextRequest(`http://localhost/api/user/continue-watching?profileId=${profileId}`));
    const titles = await response.json();
    expect(titles).toHaveLength(2);
    expect(titles.find((title: { id: string }) => title.id === titleId).episodeId).toBe(episodeIds[1]);
  });

  it("mantém centavos no banco e números nos contratos das APIs", async () => {
    const subscription = await prisma.subscription.create({ data: { userId, status: "PENDING", price: toMoney(12.345) } });
    await prisma.payment.create({ data: {
      subscriptionId: subscription.id, asaasPaymentId: `dados-${suffix}`, status: "PENDING",
      value: toMoney(12.345), billingType: "PIX", dueDate: new Date(),
    } });
    const pix = await prisma.pixPayment.create({ data: {
      userId, subscriptionId: subscription.id, txid: `dados-${suffix}`, valor: toMoney(12.345), status: "PENDING",
    } });
    expect(Number(subscription.price)).toBe(12.35);
    expect(Number(pix.valor)).toBe(12.35);
    const total = await prisma.payment.aggregate({ where: { subscriptionId: subscription.id }, _sum: { value: true } });
    expect(Number(total._sum.value)).toBe(12.35);
    const data = await (await payments(new NextRequest("http://localhost/api/payments"))).json();
    expect(data.subscription.price).toBe(12.35);
    expect(data.payments[0].value).toBe(12.35);
    const details = await (await subscriptionDetails()).json();
    expect(details.subscription.price).toBe(12.35);
    expect(details.subscription.Payment[0].value).toBe(12.35);
    expect(details.subscription.payments[0].value).toBe(12.35);
  });
});
