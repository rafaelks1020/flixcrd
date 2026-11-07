import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { presignMusicGet } from "./storage";

import { MusicError } from "./errors";
export { MusicError } from "./errors";

export function fail(status: number, message: string): never {
  throw new MusicError(status, message);
}

export function musicError(error: unknown) {
  if (error instanceof MusicError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === "P2025" ? 404 : error.code === "P2002" ? 409 : error.code === "P2003" ? 400 : 500;
    return NextResponse.json({ error: status === 500 ? "Erro interno" : "Registro inexistente, duplicado ou relação inválida" }, { status });
  }
  console.error("Erro na API de música", error);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}

export async function adminDenied() {
  const session = await getServerSession(authOptions);
  return NextResponse.json({ error: session?.user ? "Acesso restrito ao administrador" : "Autenticação necessária" }, { status: session?.user ? 403 : 401 });
}

export function streamUrl(id: string) { return `/api/music/tracks/${encodeURIComponent(id)}/stream`; }

export async function resolveMusicImage(value: string): Promise<string> {
  if (value.startsWith("music/covers/")) return presignMusicGet(value);
  if (value.startsWith("music/")) return "";
  return value;
}

// Aplica a mesma proteção às faixas aninhadas em playlists e respostas administrativas.
async function serialize(value: unknown): Promise<unknown> {
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  if (Array.isArray(value)) return Promise.all(value.map(serialize));
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(input)) {
    if (key === "audioUrl") continue;
    output[key] = typeof item === "string" && ["coverUrl", "pictureUrl", "bannerUrl", "backdropUrl"].includes(key)
      ? await resolveMusicImage(item) : await serialize(item);
  }
  if ("audioUrl" in input && typeof input.id === "string") output.streamUrl = streamUrl(input.id);
  return output;
}

export async function musicJson(value: unknown, status = 200) {
  return NextResponse.json(await serialize(value), { status, headers: { "Cache-Control": "private, no-store" } });
}

export type Body = Record<string, unknown>;
export async function readBody(req: Request): Promise<Body> {
  const raw = await req.text();
  if (Buffer.byteLength(raw) > 512_000) fail(413, "Corpo excede 512 KB");
  let body: unknown;
  try { body = JSON.parse(raw); } catch { fail(400, "JSON inválido"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "Objeto JSON obrigatório");
  return body as Body;
}
export function text(value: unknown, field: string, max = 300, required = false): string {
  if (value === undefined || value === null) {
    if (required) fail(400, `${field} obrigatório`);
    return "";
  }
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) fail(400, `${field} inválido`);
  return value.trim();
}
export function id(value: unknown, field = "id"): string {
  const result = text(value, field, 128, true);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) fail(400, `${field} inválido`);
  return result;
}
export function number(value: unknown, field: string, min: number, max: number, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < min || value > max) fail(400, `${field} inválido`);
  return value;
}
export function boolean(value: unknown, field: string, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") fail(400, `${field} inválido`);
  return value;
}
export function list(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return [];
  const items = typeof value === "string" ? value.split(",").filter(s => s.trim()) : value;
  if (!Array.isArray(items) || items.length > 50) fail(400, `${field} inválido`);
  return [...new Set(items.map(v => text(v, field, 100, true)))];
}
export function limitFrom(req: Request, fallback = 24, max = 100): number {
  const value = new URL(req.url).searchParams.get("limit");
  return value === null ? fallback : number(Number(value), "limit", 1, max);
}
export function image(value: unknown, field: string, required = false): string {
  const result = text(value, field, 2048, required);
  if (!result) return "";
  if (result.startsWith("music/covers/")) {
    if (result.includes("..") || result.includes("\\") || result.includes("//") || /[%\s\x00-\x1f]/.test(result)) fail(400, `${field} inválido`);
    return result;
  }
  let url: URL;
  try { url = new URL(result); } catch { fail(400, `${field} inválido`); }
  if (url.protocol !== "https:" || url.username || url.password) fail(400, `${field} inválido`);
  return result;
}
