/** @jest-environment node */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { getServerSession } from "next-auth";
import { hasActiveSubscription } from "@/lib/subscription";
import { requireMusicAccess } from "../access";
import { assertMusicKey, musicKey } from "../storage";
import { requirePlaylist } from "../playlists";
import { musicJson } from "../http";
import { prisma } from "@/lib/prisma";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GET as stream } from "@/app/api/music/tracks/[id]/stream/route";
import { POST as history } from "@/app/api/music/history/route";
import { POST as favorite } from "@/app/api/music/favorites/route";
import { POST as upload } from "@/app/api/admin/music/upload/presign/route";
import { trackUpdateData } from "../admin-input";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/subscription", () => ({ hasActiveSubscription: jest.fn() }));
jest.mock("@/lib/wasabi", () => ({ wasabiClient: {} }));
jest.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: jest.fn() }));
jest.mock("@/lib/prisma", () => ({ prisma: {
  playlist: { findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
  playlistTrack: { create: jest.fn(), deleteMany: jest.fn() },
  track: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  album: { findUnique: jest.fn() },
  musicPlayHistory: { create: jest.fn() },
  musicFavorite: { upsert: jest.fn() },
  $transaction: jest.fn(),
} }));
const session = jest.mocked(getServerSession);
const subscription = jest.mocked(hasActiveSubscription);
const db = prisma as unknown as {
  [table: string]: Record<string, jest.Mock>;
} & { $transaction: jest.Mock };
const signed = jest.mocked(getSignedUrl);
const request = (path = "", method = "GET", body?: unknown) => new Request(`http://localhost/api/music/${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const authenticated = (role = "USER") => session.mockResolvedValue({ user: { id: "user-a", role } });

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(null);
  subscription.mockResolvedValue(false);
  signed.mockResolvedValue("https://storage.example/temporario");
  process.env.WASABI_BUCKET_NAME = "teste-musica";
});

test("acesso exige sessão e assinatura, com exceção para ADMIN", async () => {
  await expect(requireMusicAccess()).rejects.toMatchObject({ status: 401 });
  authenticated();
  await expect(requireMusicAccess()).rejects.toMatchObject({ status: 403 });
  subscription.mockResolvedValue(true);
  await expect(requireMusicAccess()).resolves.toEqual({ userId: "user-a", role: "USER" });
  subscription.mockClear();
  authenticated("ADMIN");
  await expect(requireMusicAccess()).resolves.toEqual({ userId: "user-a", role: "ADMIN" });
  expect(subscription).not.toHaveBeenCalled();
});

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? routeFiles(join(dir, entry.name)) : entry.name === "route.ts" ? [join(dir, entry.name)] : []);
}
const userRoutes = routeFiles(join(process.cwd(), "src/app/api/music"));
const adminRoutes = routeFiles(join(process.cwd(), "src/app/api/admin/music"));
for (const [category, files] of [["usuário", userRoutes], ["admin", adminRoutes]] as const) {
  for (const file of files) {
    const handlers = require(file) as Record<string, (req: Request, ctx: unknown) => Promise<Response>>;
    for (const [method, handler] of Object.entries(handlers)) {
      if (!["GET", "POST", "PUT", "DELETE"].includes(method)) continue;
      test(`${category}: ${method} ${file.split("src/app")[1]} nega sessão ausente e acesso insuficiente`, async () => {
        const ctx = { params: Promise.resolve({ playlistId: "p1", id: "t1", trackId: "t1", albumId: "al1", artistId: "a1" }) };
        expect((await handler(request("", method), ctx)).status).toBe(401);
        authenticated();
        expect((await handler(request("", method), ctx)).status).toBe(403);
      });
    }
  }
}

test.each(["videos/a.mp3", "music/../a.mp3", "music/a\\b.mp3", "music/a//b.mp3", "music/", "music/%2e%2e/a.mp3", "music/a/./b.mp3"])("rejeita chave insegura %s", key => {
  expect(() => assertMusicKey(key)).toThrow();
});
test("constrói chaves somente sob music/", () => {
  expect(musicKey("artist", "album", "track.mp3")).toBe("music/artist/album/track.mp3");
  expect(() => musicKey("../video")).toThrow();
});

test("serialização remove chave de áudio em qualquer nível", async () => {
  const response = await musicJson({ playlists: [{ tracks: [{ track: { id: "t1", audioUrl: "music/a/al/t.mp3" } }] }] });
  const body = await response.json();
  expect(body.playlists[0].tracks[0].track).toEqual({ id: "t1", streamUrl: "/api/music/tracks/t1/stream" });
  expect(JSON.stringify(body)).not.toContain("music/a/al/t.mp3");
});

const permissions = [
  ["owner", false, false, false, true], ["owner", true, false, false, true],
  ["editor", false, false, false, true], ["editor", true, false, false, true],
  ["viewer", false, false, false, true], ["viewer", true, false, false, false],
  ["stranger", false, false, false, false], ["stranger", false, true, false, true],
  ["stranger", true, true, false, false], ["editor", true, false, true, false],
] as const;
test.each(permissions)("playlist: papel=%s escrita=%s pública=%s sóDono=%s permitido=%s", async (role, write, isPublic, ownerOnly, allowed) => {
  db.playlist.findFirst.mockImplementation(({ where }) => {
    const ownerId = role === "owner" ? "user-a" : "other";
    const matches = (filter: Record<string, unknown>) => {
      if (filter.userId) return filter.userId === ownerId;
      if (filter.isPublic) return isPublic;
      const roles = (filter.collaborators as { some: { role: { in: string[] } } } | undefined)?.some.role.in;
      return !!roles?.includes(role);
    };
    return matches(where) || where.OR?.some(matches) ? { id: "p1", userId: ownerId, isPublic } : null;
  });
  const result = requirePlaylist("p1", "user-a", write, ownerOnly);
  if (allowed) await expect(result).resolves.toMatchObject({ id: "p1" });
  else await expect(result).rejects.toMatchObject({ status: 404 });
});

test.each(["GET", "PUT", "DELETE"])("nega IDOR de playlist no método %s", async method => {
  authenticated(); subscription.mockResolvedValue(true);
  db.playlist.findFirst.mockResolvedValue(null);
  const handlers = require("@/app/api/music/playlists/[playlistId]/route");
  expect((await handlers[method](request("", method), { params: Promise.resolve({ playlistId: "other-playlist" }) })).status).toBe(404);
  expect(db.playlist.update).not.toHaveBeenCalled();
  expect(db.playlist.delete).not.toHaveBeenCalled();
});
test.each(["GET", "POST", "DELETE"])("nega IDOR de faixas de playlist no método %s", async method => {
  authenticated(); subscription.mockResolvedValue(true);
  db.playlist.findFirst.mockResolvedValue(null);
  const handlers = require("@/app/api/music/playlists/[playlistId]/tracks/route");
  expect((await handlers[method](request("", method), { params: Promise.resolve({ playlistId: "other-playlist" }) })).status).toBe(404);
  expect(db.playlistTrack.create).not.toHaveBeenCalled();
  expect(db.playlistTrack.deleteMany).not.toHaveBeenCalled();
});

test("stream assina por uma hora e não incrementa reprodução", async () => {
  authenticated("ADMIN");
  db.track.findFirst.mockResolvedValue({ audioUrl: "music/a/al/t.mp3" });
  const response = await stream(request(), { params: Promise.resolve({ id: "t1" }) });
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("https://storage.example/temporario");
  expect(signed.mock.calls[0][2]).toEqual({ expiresIn: 3600 });
  expect(db.track.update).not.toHaveBeenCalled();
  db.track.findFirst.mockResolvedValue({ audioUrl: "video/a.mp3" });
  expect((await stream(request(), { params: Promise.resolve({ id: "t1" }) })).status).toBe(400);
});

test("histórico usa o usuário autenticado e incrementa playCount na transação", async () => {
  authenticated("ADMIN");
  db.track.findFirst.mockResolvedValue({ id: "t1" });
  db.musicPlayHistory.create.mockResolvedValue({ id: "h1" });
  db.$transaction.mockImplementation(callback => callback(prisma));
  const response = await history(request("history", "POST", { trackId: "t1", userId: "other" }));
  expect(response.status).toBe(201);
  expect(db.musicPlayHistory.create).toHaveBeenCalledWith({ data: { userId: "user-a", trackId: "t1", durationSec: 0, completed: false, source: null } });
  expect(db.track.update).toHaveBeenCalledWith({ where: { id: "t1" }, data: { playCount: { increment: 1 } } });
});
test("favoritos ignoram userId fornecido pelo cliente", async () => {
  authenticated("ADMIN");
  db.track.findFirst.mockResolvedValue({ id: "t1" });
  expect((await favorite(request("favorites", "POST", { trackId: "t1", userId: "other" }))).status).toBe(200);
  expect(db.musicFavorite.upsert.mock.calls[0][0].create).toEqual({ userId: "user-a", trackId: "t1" });
});

test("upload saneia nome e assina PUT por 15 minutos", async () => {
  authenticated("ADMIN"); db.album.findUnique.mockResolvedValue({ artistId: "a1" });
  const body = { kind: "cover", artistId: "a1", albumId: "al1", filename: "../../capa á.png", contentType: "image/png" };
  const response = await upload(request("", "POST", body));
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.key).toMatch(/^music\/covers\/a1\/al1\/[a-z0-9-]+-capa_a_\.png$/);
  expect(signed.mock.calls[0][2]).toEqual({ expiresIn: 900 });
  expect((await upload(request("", "POST", { ...body, contentType: "audio/mpeg" }))).status).toBe(400);
  expect((await upload(request("", "POST", { ...body, contentType: "constructor" }))).status).toBe(400);
  expect((await upload(request("", "POST", { ...body, filename: "a.svg", contentType: "image/svg+xml" }))).status).toBe(400);
});
test("edição de metadados preserva letras e estado omitidos", async () => {
  db.album.findUnique.mockResolvedValue({ artistId: "a1" });
  db.track.findUnique.mockResolvedValue({ lyricsLrc: "[00:01]Letra", lyricsPlain: null });
  const { update } = await trackUpdateData({ title: "Faixa", audioUrl: "music/a/al/t.mp3", artistId: "a1", albumId: "al1", format: "mp3", durationSec: 10 }, "t1");
  expect(update).not.toHaveProperty("lyricsLrc");
  expect(update).not.toHaveProperty("hasLyrics");
  expect(update).not.toHaveProperty("status");
});
