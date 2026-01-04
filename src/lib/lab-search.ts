/**
 * Shared Search Logic for LAB
 */

import { getAppSettings } from "@/lib/app-settings";
import { isExplicitContent } from "@/lib/content-filter";

const TMDB_API = "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.TMDB_API_KEY || "";

interface TmdbSearchResult {
    id: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    overview: string;
    vote_average: number;
    vote_count?: number;
    popularity?: number;
    release_date?: string;
    first_air_date?: string;
    media_type: string;
    adult?: boolean;
    genre_ids?: number[];
}

export interface LabSearchResult {
    id: string;
    tmdbId: number;
    imdbId: string | null;
    name: string;
    originalName?: string;
    posterUrl: string | null;
    backdropUrl: string | null;
    overview: string;
    voteAverage: number;
    releaseDate: string | null;
    type: string;
    popularity?: number;
    isAnime?: boolean;
    _relevanceScore?: number;
}

function calculateRelevanceScore(item: TmdbSearchResult, query: string, isAvailable: boolean): number {
    const q = query.toLowerCase().trim();
    const title = (item.title || item.name || "").toLowerCase();
    const originalTitle = (item.original_title || item.original_name || "").toLowerCase();
    const overview = (item.overview || "").toLowerCase();

    let score = 0;

    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 80;
    else if (title.includes(q)) score += 50;

    if (originalTitle === q) score += 90;
    else if (originalTitle.startsWith(q)) score += 70;
    else if (originalTitle.includes(q)) score += 40;

    if (overview.includes(q)) score += 20;

    const popularity = typeof item.popularity === "number" ? item.popularity : 0;
    const voteAverage = typeof item.vote_average === "number" ? item.vote_average : 0;
    const voteCount = typeof item.vote_count === "number" ? item.vote_count : 0;

    score += Math.min(30, popularity * 0.1);
    score += Math.min(20, voteAverage * 2);
    score += Math.min(15, voteCount * 0.01);

    if (!item.poster_path) score -= 10;

    const releaseDate = item.release_date || item.first_air_date;
    if (releaseDate) {
        const year = parseInt(releaseDate.substring(0, 4), 10);
        const currentYear = new Date().getFullYear();
        if (year >= currentYear - 3) score += 10;
    }

    if (isAvailable) score += 500;

    return score;
}

export async function performLabSearch(q: string, options: {
    page: number;
    limit: number;
    includeAdult?: boolean;
    availableIds: Set<number>;
}): Promise<{
    results: LabSearchResult[];
    totalPages: number;
    tmdbPageEnd: number;
    hasMore: boolean;
}> {
    if (!TMDB_KEY) {
        console.error("[Search Service] TMDB_API_KEY missing");
        return { results: [], totalPages: 0, tmdbPageEnd: options.page, hasMore: false };
    }

    const results: LabSearchResult[] = [];
    const seenTmdbIds = new Set<number>();
    let tmdbPage = options.page;
    let scannedPages = 0;
    let totalPages = 0;

    const normalizedQ = q.toLowerCase().trim();
    const isAnimeTarget = normalizedQ === "anime" || normalizedQ === "animes";
    const isDoramaTarget = normalizedQ === "dorama" || normalizedQ === "doramas";
    const includeAdult = options.includeAdult ?? false;

    while (results.length < options.limit && scannedPages < 8) {
        let searchUrl = `${TMDB_API}/search/multi?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}&page=${tmdbPage}&include_adult=${includeAdult}`;

        if ((isAnimeTarget || isDoramaTarget) && tmdbPage === 1) {
            const discoverParams = new URLSearchParams({
                api_key: TMDB_KEY,
                language: "pt-BR",
                sort_by: "popularity.desc",
                page: String(tmdbPage),
                include_adult: String(includeAdult)
            });
            if (isAnimeTarget) discoverParams.set("with_genres", "16");
            if (isDoramaTarget) {
                discoverParams.set("with_original_language", "ko|ja");
                discoverParams.set("with_genres", "18");
                discoverParams.set("without_genres", "16"); // Exclude Anime
            }
            searchUrl = `${TMDB_API}/discover/tv?${discoverParams.toString()}`;
        }

        console.log(`[Search Service] TMDB Page ${tmdbPage} for "${q}"`);
        const res = await fetch(searchUrl, { next: { revalidate: 120 } });
        if (!res.ok) {
            console.error(`[Search Service] TMDB Error: ${res.status}`);
            break;
        }

        const data = await res.json();
        const tmdbResults: TmdbSearchResult[] = data.results || [];
        if (!totalPages) totalPages = data?.total_pages || 0;

        const scoredItems = tmdbResults
            .filter(item => item.media_type === "movie" || item.media_type === "tv")
            .filter(item => {
                if (!includeAdult) {
                    const explicit = isExplicitContent({
                        name: item.title || item.name || "",
                        overview: item.overview || "",
                        adult: item.adult,
                        genre_ids: item.genre_ids
                    });
                    if (explicit) {
                        console.log(`[Search Service] Filtered (Adult/Explicit): ${item.title || item.name}`);
                    }
                    return !explicit;
                }
                return true;
            })
            .filter(item => !seenTmdbIds.has(item.id))
            .map(item => ({
                item,
                score: calculateRelevanceScore(item, q, options.availableIds.has(item.id))
            }))
            .sort((a, b) => b.score - a.score);

        for (const { item, score } of scoredItems) {
            seenTmdbIds.add(item.id);
            results.push({
                id: `lab-${item.media_type}-${item.id}`,
                tmdbId: item.id,
                imdbId: null,
                name: item.title || item.name || "Sem título",
                originalName: item.original_title || item.original_name || undefined,
                posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null,
                overview: item.overview || "",
                voteAverage: item.vote_average || 0,
                popularity: item.popularity,
                releaseDate: item.release_date || item.first_air_date || null,
                type: item.media_type === "movie" ? "MOVIE" : "SERIES",
                isAnime: item.genre_ids?.includes(16),
                _relevanceScore: score,
            });
            if (results.length >= options.limit) break;
        }

        scannedPages += 1;
        tmdbPage += 1;
        if (!totalPages || tmdbPage > totalPages) break;
        if (tmdbResults.length === 0) break;
    }

    const tmdbPageEnd = tmdbPage - 1;
    const hasMore = totalPages ? tmdbPage <= totalPages : false;

    return { results, totalPages, tmdbPageEnd, hasMore };
}
