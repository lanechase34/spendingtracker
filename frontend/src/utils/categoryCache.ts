import type { SelectOptionType } from 'types/SelectOption.type';

export type CategoryCache = Record<string, Record<number, SelectOptionType[]>>;

/**
 * Shared cache reference for ALL instances of CategorySelect
 * Cache all combinations of search + page
 */
const cache: CategoryCache = {};

/**
 * Get cache if exists, otherwise returns null
 */
export const getCachedCategories = (search: string, page: number) => cache[search]?.[page] ?? null;

/**
 * Set the current options for search + page in cache
 */
export const setCachedCategories = (search: string, page: number, data: SelectOptionType[]) => {
    if (!cache[search]) cache[search] = {};
    cache[search][page] = data;
};

/**
 * Force flush the cache
 */
export const clearCategoryCache = () => {
    for (const key in cache) delete cache[key];
};
