import { getAppSettings } from "./app-settings";

let availableIdsCache: { ids: Set<number>; cachedAt: number; apiUrl: string } | null = null;
const AVAILABLE_IDS_TTL_MS = 5 * 60 * 1000; // 5 minutos

function parseIds(rawText: string): number[] {
    try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
            return parsed
                .map((id: string | number) => parseInt(String(id), 10))
                .filter((n: number) => !Number.isNaN(n));
        }
        if (parsed && typeof parsed === "object") {
            if (Array.isArray((parsed as any).ids)) {
                return (parsed as any).ids
                    .map((id: string | number) => parseInt(String(id), 10))
                    .filter((n: number) => !Number.isNaN(n));
            }
            if (Array.isArray((parsed as any).data)) {
                return (parsed as any).data
                    .map((item: any) => parseInt(String(item?.id ?? item?.tmdb_id ?? ""), 10))
                    .filter((n: number) => !Number.isNaN(n));
            }
        }
    } catch {
        // ignorar e tentar parsear como texto simples
    }

    return rawText
        .split(/[\n,]/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
}

/**
 * Busca todos os IDs disponíveis no SuperFlixAPI para todas as categorias.
 * Utiliza cache global para evitar múltiplas requisições.
 */
export async function getAvailableTmdbIds(): Promise<Set<number>> {
    const settings = await getAppSettings();
    const SUPERFLIX_API = settings.superflixApiUrl;

    const now = Date.now();
    if (
        availableIdsCache &&
        now - availableIdsCache.cachedAt < AVAILABLE_IDS_TTL_MS &&
        availableIdsCache.apiUrl === SUPERFLIX_API
    ) {
        return availableIdsCache.ids;
    }

    const categories = [
        "movie",
        "serie",
        "anime",
        "dorama",
        "c-drama",
        "k-drama",
        "j-drama",
        "hindi-drama",
        "lakorn",
    ];

    const allIds = new Set<number>();

    try {
        const results = await Promise.allSettled(
            categories.map(async (cat) => {
                const res = await fetch(
                    `${SUPERFLIX_API}/lista?category=${cat}&type=tmdb&format=json&order=desc`,
                    {
                        headers: { "User-Agent": "FlixCRD-Lab/1.0" },
                        next: { revalidate: 300 },
                    }
                );
                if (!res.ok) return [];
                const text = await res.text();
                return parseIds(text);
            })
        );

        for (const res of results) {
            if (res.status === "fulfilled") {
                for (const id of res.value) {
                    allIds.add(id);
                }
            }
        }
    } catch (err) {
        console.error("[SuperFlix] Error fetching available IDs:", err);
    }

    availableIdsCache = {
        ids: allIds,
        cachedAt: now,
        apiUrl: SUPERFLIX_API,
    };

    return allIds;
}

/**
 * Busca os IDs de uma categoria específica. (Útil para o catálogo/discover)
 */
export async function getAvailableIdsByCategory(category: string): Promise<number[]> {
    const settings = await getAppSettings();
    const SUPERFLIX_API = settings.superflixApiUrl;

    try {
        const res = await fetch(
            `${SUPERFLIX_API}/lista?category=${category}&type=tmdb&format=json&order=desc`,
            {
                headers: { "User-Agent": "FlixCRD-Lab/1.0" },
                next: { revalidate: 300 },
            }
        );
        if (!res.ok) return [];
        const text = await res.text();
        return parseIds(text);
    } catch (err) {
        console.error(`[SuperFlix] Error fetching category ${category}:`, err);
        return [];
    }
}
