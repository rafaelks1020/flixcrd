import { requireMusicPage } from "@/lib/music/page-access";
import { SearchClient } from "./SearchClient";

export const metadata = { title: "Buscar música" };

export default async function MusicSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = raw?.trim() || "";
  const callback = query ? `/music/search?q=${encodeURIComponent(query)}` : "/music/search";
  await requireMusicPage(callback);
  return <SearchClient initialQuery={query} />;
}
