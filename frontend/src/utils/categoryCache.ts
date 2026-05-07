import type { SelectOptionType } from 'types/SelectOption.type';

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_ENTRIES = 100; // max unique search+page combinations

interface CacheEntry {
    data: SelectOptionType[];
    expiresAt: number;
}

/**
 * Shared cache reference for ALL instances of CategorySelect
 * Cache all combinations of search + page
 */
const cache = new Map<string, CacheEntry>();

function makeKey(search: string, page: number): string {
    return `${search}::${page}`;
}

/**
 * Get cached result if it exists and hasn't expired
 */
export const getCachedCategories = (search: string, page: number): SelectOptionType[] | null => {
    const entry = cache.get(makeKey(search, page));
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        cache.delete(makeKey(search, page));
        return null;
    }

    return entry.data;
};

/**
 * Store a result. Evicts the oldest entry when the cap is reached.
 */
export const setCachedCategories = (search: string, page: number, data: SelectOptionType[]): void => {
    const key = makeKey(search, page);

    if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
        // Map preserves insertion order - delete the first (oldest) entry
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
    }

    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

/**
 * Force flush the entire cache
 */
export const clearCategoryCache = (): void => {
    cache.clear();
};
