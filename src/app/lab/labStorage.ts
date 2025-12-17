export type LabMediaType = "movie" | "tv";

export type LabStoredTitle = {
  key: string;
  tmdbId: number;
  mediaType: LabMediaType;
  title: string;
  posterUrl: string | null;
  type: "MOVIE" | "SERIES";
  addedAt: number;
};

export type LabContinueEntry = {
  key: string;
  watchUrl: string;
  title: string;
  posterUrl: string | null;
  watchType: "filme" | "serie";
  contentId: string;
  season?: number;
  episode?: number;
  updatedAt: number;
};

const KEY_MY_LIST = "lab_my_list_v1";
const KEY_WATCH_LATER = "lab_watch_later_v1";
const KEY_CONTINUE = "lab_continue_v1";

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readList<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = safeParseJson<T[]>(raw, []);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {
  }
}

export function makeLabTitleKey(mediaType: LabMediaType, tmdbId: number) {
  return `lab-${mediaType}-${tmdbId}`;
}

export function getLabMyList() {
  return readList<LabStoredTitle>(KEY_MY_LIST);
}

export function getLabWatchLater() {
  return readList<LabStoredTitle>(KEY_WATCH_LATER);
}

function toggleInList(storageKey: string, item: LabStoredTitle) {
  const list = readList<LabStoredTitle>(storageKey);
  const idx = list.findIndex((x) => x.key === item.key);

  let next: LabStoredTitle[];
  if (idx >= 0) {
    next = [...list.slice(0, idx), ...list.slice(idx + 1)];
  } else {
    next = [{ ...item, addedAt: Date.now() }, ...list];
  }

  const dedup = new Map<string, LabStoredTitle>();
  for (const it of next) {
    if (!dedup.has(it.key)) dedup.set(it.key, it);
  }
  const merged = Array.from(dedup.values()).slice(0, 200);
  writeList(storageKey, merged);
  return merged;
}

export function toggleLabMyList(item: LabStoredTitle) {
  return toggleInList(KEY_MY_LIST, item);
}

export function toggleLabWatchLater(item: LabStoredTitle) {
  return toggleInList(KEY_WATCH_LATER, item);
}

export function isInLabMyList(key: string) {
  return getLabMyList().some((x) => x.key === key);
}

export function isInLabWatchLater(key: string) {
  return getLabWatchLater().some((x) => x.key === key);
}

export function getLabContinue() {
  const list = readList<LabContinueEntry>(KEY_CONTINUE);
  return list
    .filter((x) => x && typeof x === "object" && typeof (x as any).key === "string")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 60);
}

export function upsertLabContinue(entry: Omit<LabContinueEntry, "updatedAt"> & { updatedAt?: number }) {
  const list = readList<LabContinueEntry>(KEY_CONTINUE);
  const idx = list.findIndex((x) => x.key === entry.key);
  const existing = idx >= 0 ? list[idx] : null;

  const nextEntry: LabContinueEntry = {
    key: entry.key,
    watchUrl: entry.watchUrl || existing?.watchUrl || "/lab",
    title: entry.title || existing?.title || "",
    posterUrl: entry.posterUrl ?? existing?.posterUrl ?? null,
    watchType: entry.watchType || existing?.watchType || "filme",
    contentId: entry.contentId || existing?.contentId || "",
    season: typeof entry.season === "number" ? entry.season : existing?.season,
    episode: typeof entry.episode === "number" ? entry.episode : existing?.episode,
    updatedAt: entry.updatedAt ?? Date.now(),
  };

  const next = idx >= 0 ? [...list.slice(0, idx), ...list.slice(idx + 1)] : [...list];
  next.unshift(nextEntry);

  const dedup = new Map<string, LabContinueEntry>();
  for (const it of next) {
    if (!dedup.has(it.key)) dedup.set(it.key, it);
  }

  const merged = Array.from(dedup.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 60);

  writeList(KEY_CONTINUE, merged);
  return merged;
}

export function removeLabContinue(key: string) {
  const list = readList<LabContinueEntry>(KEY_CONTINUE);
  const next = list.filter((x) => x.key !== key);
  writeList(KEY_CONTINUE, next);
  return next;
}
