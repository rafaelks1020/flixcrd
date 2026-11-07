import { requireMusicAccess } from "@/lib/music/access";
import { musicJson, musicError, fail, text, number } from "@/lib/music/http";
import { searchCatalog, getAvailableGenres } from "@/lib/music/catalog-db";

export async function GET(req: Request) {
  try {
    await requireMusicAccess();
    const params = new URL(req.url).searchParams;
    if (params.get("type") === "genres") return musicJson({ genres: await getAvailableGenres() });
    const q = text(params.get("q"), "q", 300);
    const genre = text(params.get("genre"), "genre", 100) || undefined;
    const yearFrom = params.has("yearFrom") ? number(Number(params.get("yearFrom")), "yearFrom", 1, 9999) : undefined;
    const yearTo = params.has("yearTo") ? number(Number(params.get("yearTo")), "yearTo", 1, 9999) : undefined;
    if (yearFrom !== undefined && yearTo !== undefined && yearFrom > yearTo) fail(400, "Intervalo de anos inválido");
    const sortBy = params.get("sortBy") ?? "relevance";
    if (!["relevance", "popularity", "recent", "title"].includes(sortBy)) fail(400, "Ordenação inválida");
    const filters = { genre, yearFrom, yearTo, sortBy };
    return musicJson({ ...await searchCatalog(q, filters), filters });
  } catch (error) { return musicError(error); }
}

