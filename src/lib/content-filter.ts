
/**
 * Security utilities for content filtering
 */

const ADULT_KEYWORDS_STRICT = [
    "sex", "rape", "porn", "boobs", "milf", "jav", "adult", "nude", "orgasm", "gangbang",
    "anal", "bondage", "bdsm", "blowjob", "handjob", "titfuck", "paizuri", "bitch", "slut",
    "spank", "fetish", "voyeur", "xxx", "incest", "taboo"
];

const ADULT_KEYWORDS_PARTIAL = [
    "hentai", "uncensored", "erotic", "ecchi", "doujinshi", // English terms that are almost always adult
    "yaoi", "yuri", "futanari", "ahegao", "bukkaque", "nakadashi", "creampie",
    "facial", "squirting", "oppai", "netorare", "ntr", "chikan", "rape",
    // Japanese - Kanji & Kana
    "聖ヤリマン", "ヤリマン", "援交", "enjo-kosai", "seiso",
    "セックス", "エロ", "痴漢", "レイプ", "調教", "巨乳", "中出し", "近親", "凌辱",
    "淫行", "無修正", "熟女", "人妻", "美少女", "アナル", "クリトリス", "フェラ",
    "パイズリ", "精液", "中出", "膣内", "絶頂", "変態", "性交", "交尾",
    "催眠", "淫虐", "兄嫁", "母娘", "女教師", "義母",
    // Common substrings in hentai titles
    "sex friend", "sexfriend", "sex-friend",
    "private lesson", "stepmother", "step-mother", "stepmom",
    "stepsister", "step-sister", "stepdaughter", "step-daughter"
];

const ADULT_GENRE_IDS = [
    10749, // Romance (sometimes filtered if combined with other signals, but risky)
    // TMDB doesn't have a stable "Hentai" genre ID in the public list, 
    // but it uses 16 (Animation) + usually 18+ keywords or adult flag.
];

interface FilterableItem {
    id?: number | string;
    name?: string;
    title?: string;
    overview?: string;
    adult?: boolean;
    genre_ids?: number[];
}

/**
 * Checks if a title, overview or adult flag indicates adult content.
 */
export function isExplicitContent(item: FilterableItem): boolean {
    if (item.adult === true) return true;

    // Concatena tudo e normaliza
    const content = `${item.name || ""} ${item.title || ""} ${item.overview || ""}`.toLowerCase();

    // 1. Check Strict Keywords (Full word matches only)
    const strictRegex = new RegExp(`\\b(${ADULT_KEYWORDS_STRICT.join("|")})\\b`, "i");
    if (strictRegex.test(content)) return true;

    // 2. Check Partial/Substring Keywords
    for (const kw of ADULT_KEYWORDS_PARTIAL) {
        // If the keyword is Japanese (contains non-ASCII), use substring match
        if (/[^\x00-\x7F]/.test(kw)) {
            if (content.includes(kw.toLowerCase())) return true;
        } else {
            // For English/Alphanumeric terms in the partial list, use word boundaries
            // to avoid false positives like "entrar" matching "ntr"
            const wordRegex = new RegExp(`\\b${kw}\\b`, "i");
            if (wordRegex.test(content)) return true;
        }
    }

    return false;
}

/**
 * Filter an array of items based on the hideAdultContent setting.
 */
export function filterAdultContent<T extends FilterableItem>(items: T[], hideAdult: boolean): T[] {
    if (!hideAdult) return items;
    return items.filter(item => !isExplicitContent(item));
}
