/** @jest-environment node */
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { wasabiClient } from "@/lib/wasabi";
import {
  isHlsSegmentReference,
  playlistCacheControl,
  publicOrSignedUrl,
  readObjectText,
} from "@/lib/media-url";

jest.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: jest.fn() }));
jest.mock("@/lib/wasabi", () => ({ wasabiClient: { send: jest.fn() } }));

const signed = jest.mocked(getSignedUrl);
const send = wasabiClient.send as unknown as jest.Mock;
const ENV_KEYS = ["S3_CDN_URL", "WASABI_CDN_URL", "S3_BUCKET_NAME", "WASABI_BUCKET_NAME"] as const;
const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
const originalFetch = global.fetch;

function clearStorageEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

beforeEach(() => {
  clearStorageEnv();
  signed.mockReset();
  send.mockReset();
  signed.mockResolvedValue("https://storage.exemplo/assinado");
  global.fetch = originalFetch;
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    const value = previousEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  global.fetch = originalFetch;
});

describe("publicOrSignedUrl", () => {
  test("com CDN devolve a URL pública e não assina", async () => {
    process.env.S3_CDN_URL = "https://cdn.exemplo.com/";
    process.env.S3_BUCKET_NAME = "bucket-privado";

    await expect(publicOrSignedUrl("videos/a.ts")).resolves.toBe("https://cdn.exemplo.com/videos/a.ts");
    expect(signed).not.toHaveBeenCalled();
    expect(playlistCacheControl()).toBe("public, max-age=300, stale-while-revalidate=60");
  });

  test("sem CDN assina GetObject com o bucket e a validade pedida", async () => {
    process.env.S3_BUCKET_NAME = "bucket-privado";

    await expect(publicOrSignedUrl("videos/a.ts")).resolves.toBe("https://storage.exemplo/assinado");
    expect(signed).toHaveBeenCalledWith(wasabiClient, expect.any(GetObjectCommand), { expiresIn: 21600 });
    const command = signed.mock.calls[0][1] as GetObjectCommand;
    expect(command.input).toEqual({ Bucket: "bucket-privado", Key: "videos/a.ts" });

    await publicOrSignedUrl("videos/b.ts", 120);
    expect(signed).toHaveBeenLastCalledWith(wasabiClient, expect.any(GetObjectCommand), { expiresIn: 120 });
    expect(playlistCacheControl()).toBe("private, max-age=300");
  });

  test("sem CDN e sem bucket falha antes de assinar", async () => {
    await expect(publicOrSignedUrl("videos/a.ts")).rejects.toThrow("Bucket de storage não configurado.");
    expect(signed).not.toHaveBeenCalled();
  });
});

describe("readObjectText", () => {
  test("com CDN faz o fetch público e devolve null quando a resposta não é ok", async () => {
    process.env.S3_CDN_URL = "https://cdn.exemplo.com/";
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "#EXTM3U\n" })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "ausente" });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(readObjectText("hls/master.m3u8")).resolves.toBe("#EXTM3U\n");
    expect(fetchMock).toHaveBeenCalledWith("https://cdn.exemplo.com/hls/master.m3u8", {
      cache: "default",
      headers: { Accept: "application/vnd.apple.mpegurl, */*" },
    });
    await expect(readObjectText("hls/ausente.m3u8")).resolves.toBeNull();
    expect(send).not.toHaveBeenCalled();
    expect(signed).not.toHaveBeenCalled();
  });

  test("sem CDN lê o corpo do GetObject", async () => {
    process.env.S3_BUCKET_NAME = "bucket-privado";
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    send.mockResolvedValue({ Body: { transformToString: async () => "#EXTM3U\nseg.ts\n" } });

    await expect(readObjectText("hls/master.m3u8")).resolves.toBe("#EXTM3U\nseg.ts\n");
    expect(fetchMock).not.toHaveBeenCalled();
    const command = send.mock.calls[0][0] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({ Bucket: "bucket-privado", Key: "hls/master.m3u8" });
  });

  test("sem CDN devolve null em NoSuchKey e em HTTP 404, e propaga outro erro", async () => {
    process.env.S3_BUCKET_NAME = "bucket-privado";
    const missing = new Error("The specified key does not exist.");
    missing.name = "NoSuchKey";
    send.mockRejectedValueOnce(missing);
    await expect(readObjectText("hls/missing.m3u8")).resolves.toBeNull();

    send.mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } });
    await expect(readObjectText("hls/other.m3u8")).resolves.toBeNull();

    send.mockRejectedValueOnce(Object.assign(new Error("negado"), {
      name: "AccessDenied",
      $metadata: { httpStatusCode: 403 },
    }));
    await expect(readObjectText("hls/secreto.m3u8")).rejects.toThrow("negado");
  });

  test("sem corpo devolve null", async () => {
    process.env.S3_BUCKET_NAME = "bucket-privado";
    send.mockResolvedValue({ Body: undefined });
    await expect(readObjectText("hls/vazio.m3u8")).resolves.toBeNull();
  });
});

describe("isHlsSegmentReference", () => {
  test("reconhece segmento e ignora playlist", () => {
    expect(isHlsSegmentReference("720/seg.ts")).toBe(true);
    expect(isHlsSegmentReference("seg.m4s")).toBe(true);
    expect(isHlsSegmentReference("audio.aac")).toBe(true);
    expect(isHlsSegmentReference("legenda.vtt")).toBe(true);
    expect(isHlsSegmentReference("enc.key")).toBe(true);
    expect(isHlsSegmentReference("index.m3u8")).toBe(false);
    expect(isHlsSegmentReference("#EXTINF:6")).toBe(false);
  });
});
