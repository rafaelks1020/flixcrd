import { unstable_cache } from "next/cache";

type MbRating = {
  value?: number | string | null;
  "votes-count"?: number | string | null;
};

type MbEntity = {
  id?: string;
  name?: string;
  title?: string;
  rating?: MbRating;
  genres?: Array<{ name?: string | null }>; 
  tags?: Array<{ name?: string | null; count?: number | null }>;
};

type Enriched = {
  mbid: string;
  genres: string[];
  rating: { score: number; votes: number } | null;
  tags: string[];
  imageSourceUrls?: {
    picture?: string | null;
    cover?: string | null;
  };
};

const MB_BASE = "https://musicbrainz.org/ws/2";
const CAA_BASE = "https://coverartarchive.org";

let queue: Promise<void> = Promise.resolve();
let lastAt = 0;

function getUserAgent() {
  const explicit = process.env.MUSICBRAINZ_USER_AGENT;
  if (explicit) return explicit;

  const app = process.env.MUSICBRAINZ_APP_NAME || "pflix";
  const contact = process.env.MUSICBRAINZ_CONTACT || process.env.ADMIN_EMAIL || "dev@pflix.local";

  const version = process.env.npm_package_version || "0";
  return `${app}/${version} (${contact})`;
}

function enqueueThrottle() {
  queue = queue
    .catch(() => undefined)
    .then(async () => {
      const now = Date.now();
      const wait = Math.max(0, lastAt + 1100 - now);
      lastAt = now + wait;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    });
  return queue;
}

const cachedFetchJson = unstable_cache(
  async (url: string) => {
    await enqueueThrottle();

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const resp = await fetch(url, {
        headers: {
          accept: "application/json",
          "User-Agent": getUserAgent(),
        },
        next: {
          revalidate: 60 * 60 * 24,
        },
      });

      if (resp.ok) {
        try {
          return await resp.json();
        } catch {
          throw new Error("musicbrainz_invalid_json");
        }
      }

      const status = resp.status;
      const retryable = status === 429 || status === 502 || status === 503 || status === 504;
      if (!retryable || attempt === maxAttempts) {
        throw new Error(`musicbrainz_http_${status}`);
      }

      const retryAfter = resp.headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
      const backoffMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(0, Math.floor(retryAfterSeconds * 1000))
        : 400 * attempt;
      await new Promise((r) => setTimeout(r, backoffMs));
    }

    throw new Error("musicbrainz_unreachable");
  },
  ["musicbrainz"],
  {
    revalidate: 60 * 60 * 24,
  },
);

const cachedFetchJsonNoThrottle = unstable_cache(
  async (url: string) => {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const resp = await fetch(url, {
        headers: {
          accept: "application/json",
          "User-Agent": getUserAgent(),
        },
        next: {
          revalidate: 60 * 60 * 24,
        },
      });

      if (resp.ok) {
        try {
          return await resp.json();
        } catch {
          return null;
        }
      }

      if (attempt === maxAttempts) return null;
      const status = resp.status;
      const retryable = status === 429 || status === 502 || status === 503 || status === 504;
      if (!retryable) return null;
      await new Promise((r) => setTimeout(r, 250 * attempt));
    }

    return null;
  },
  ["coverartarchive"],
  {
    revalidate: 60 * 60 * 24,
  }
);

function normalizeList(list: unknown, limit = 6) {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    if (item && typeof item === "object" && "name" in item) {
      const name = (item as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) out.push(name);
    }
  }
  return Array.from(new Set(out)).slice(0, limit);
}

function parseRating(rating: MbRating | undefined): { score: number; votes: number } | null {
  if (!rating) return null;

  const rawValue = rating.value;
  const rawVotes = rating["votes-count"];

  const value = typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : NaN;
  const votes = typeof rawVotes === "number" ? rawVotes : typeof rawVotes === "string" ? Number(rawVotes) : NaN;

  if (!Number.isFinite(value) || value <= 0) return null;

  const imdbScore = Math.round(value * 2 * 10) / 10;
  return {
    score: imdbScore,
    votes: Number.isFinite(votes) ? Math.max(0, Math.floor(votes)) : 0,
  };
}

async function mbSearch(entity: "artist" | "release-group" | "recording", query: string) {
  const url = `${MB_BASE}/${entity}?query=${encodeURIComponent(query)}&limit=1&fmt=json`;
  try {
    return await cachedFetchJson(url);
  } catch {
    return null;
  }
}

async function mbLookup(entity: "artist" | "release-group" | "recording", mbid: string, inc: string[]) {
  const url = `${MB_BASE}/${entity}/${encodeURIComponent(mbid)}?inc=${encodeURIComponent(inc.join("+"))}&fmt=json`;
  try {
    return await cachedFetchJson(url);
  } catch {
    return null;
  }
}

function pickArtistImageUrl(relations: unknown): string | null {
  if (!Array.isArray(relations)) return null;
  for (const rel of relations) {
    if (!rel || typeof rel !== "object") continue;
    const type = (rel as any).type;
    if (typeof type !== "string" || type.toLowerCase() !== "image") continue;
    const resource = (rel as any).url?.resource;
    if (typeof resource === "string" && resource.trim()) return resource.trim();
  }
  return null;
}

function pickCoverArtUrl(images: unknown): string | null {
  if (!Array.isArray(images)) return null;
  let first: string | null = null;
  for (const img of images) {
    const url = img && typeof img === "object" ? (img as any).image : null;
    const front = img && typeof img === "object" ? (img as any).front : null;
    if (!first && typeof url === "string" && url.trim()) first = url.trim();
    if (front === true && typeof url === "string" && url.trim()) return url.trim();
  }
  return first;
}

async function caaReleaseGroupCoverUrl(releaseGroupMbid: string): Promise<string | null> {
  const url = `${CAA_BASE}/release-group/${encodeURIComponent(releaseGroupMbid)}`;
  const data = await cachedFetchJsonNoThrottle(url);
  const cover = pickCoverArtUrl(data?.images);
  return cover;
}

export async function enrichArtistByName(name: string): Promise<Enriched | null> {
  const q = name.trim();
  if (!q) return null;

  const search = await mbSearch("artist", `artist:"${q}"`);
  const mbid = search?.artists?.[0]?.id;
  if (!mbid) return null;

  const data: any | null = await mbLookup("artist", mbid, ["genres", "tags", "ratings", "url-rels"]);
  if (!data) return null;

  return {
    mbid,
    genres: normalizeList(data.genres),
    tags: normalizeList(data.tags),
    rating: parseRating(data.rating),
    imageSourceUrls: {
      picture: pickArtistImageUrl(data.relations),
    },
  };
}

export async function enrichReleaseGroupByTitle(params: {
  title: string;
  artistName?: string | null;
}): Promise<Enriched | null> {
  const title = params.title.trim();
  const artistName = String(params.artistName || "").trim();
  if (!title) return null;

  const query = artistName
    ? `releasegroup:"${title}" AND artist:"${artistName}"`
    : `releasegroup:"${title}"`;

  const search = await mbSearch("release-group", query);
  const mbid = search?.["release-groups"]?.[0]?.id;
  if (!mbid) return null;

  const data: MbEntity | null = await mbLookup("release-group", mbid, ["genres", "tags", "ratings", "artist-credits"]);
  if (!data) return null;

  const cover = await caaReleaseGroupCoverUrl(mbid);

  return {
    mbid,
    genres: normalizeList(data.genres),
    tags: normalizeList(data.tags),
    rating: parseRating(data.rating),
    imageSourceUrls: {
      cover,
    },
  };
}

export async function enrichRecordingByTitle(params: {
  title: string;
  artistName?: string | null;
}): Promise<Enriched | null> {
  const title = params.title.trim();
  const artistName = String(params.artistName || "").trim();
  if (!title) return null;

  const query = artistName ? `recording:"${title}" AND artist:"${artistName}"` : `recording:"${title}"`;
  const search = await mbSearch("recording", query);
  const mbid = search?.recordings?.[0]?.id;
  if (!mbid) return null;

  const data: MbEntity | null = await mbLookup("recording", mbid, ["genres", "tags", "ratings", "artist-credits"]);
  if (!data) return null;

  return {
    mbid,
    genres: normalizeList(data.genres),
    tags: normalizeList(data.tags),
    rating: parseRating(data.rating),
  };
}
