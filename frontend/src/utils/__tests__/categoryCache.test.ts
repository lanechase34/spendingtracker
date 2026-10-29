import { clearCategoryCache, getCachedCategories, setCachedCategories } from 'utils/categoryCache';

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 100;

const options = (...labels: string[]) => labels.map((label, i) => ({ value: i, label }));

describe('categoryCache', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-03-27T12:00:00Z'));
        clearCategoryCache();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('Should return null on a miss', () => {
        expect(getCachedCategories('food', 1)).toBeNull();
    });

    it('Should return stored categories for the same search and page', () => {
        const data = options('Food', 'Fuel');
        setCachedCategories('f', 1, data);

        expect(getCachedCategories('f', 1)).toBe(data);
    });

    it('Should key entries by both search and page', () => {
        setCachedCategories('f', 1, options('Food'));
        setCachedCategories('f', 2, options('Fuel'));
        setCachedCategories('', 1, options('All'));

        expect(getCachedCategories('f', 1)).toEqual(options('Food'));
        expect(getCachedCategories('f', 2)).toEqual(options('Fuel'));
        expect(getCachedCategories('', 1)).toEqual(options('All'));
        expect(getCachedCategories('f', 3)).toBeNull();
    });

    it('Should keep an entry until its TTL passes, then drop it', () => {
        setCachedCategories('f', 1, options('Food'));

        jest.setSystemTime(Date.now() + TTL_MS);
        expect(getCachedCategories('f', 1)).not.toBeNull();

        jest.setSystemTime(Date.now() + 1);
        expect(getCachedCategories('f', 1)).toBeNull();

        // Expired entries are removed, not just hidden
        jest.setSystemTime(Date.now() - TTL_MS);
        expect(getCachedCategories('f', 1)).toBeNull();
    });

    it('Should reset the TTL when an entry is overwritten', () => {
        setCachedCategories('f', 1, options('Old'));
        jest.setSystemTime(Date.now() + TTL_MS - 1000);
        setCachedCategories('f', 1, options('New'));

        jest.setSystemTime(Date.now() + 2000);
        expect(getCachedCategories('f', 1)).toEqual(options('New'));
    });

    it('Should evict the oldest entry once the cap is reached', () => {
        for (let i = 0; i < MAX_ENTRIES; i++) setCachedCategories(`s${String(i)}`, 1, options(String(i)));

        setCachedCategories('newest', 1, options('newest'));

        expect(getCachedCategories('s0', 1)).toBeNull();
        expect(getCachedCategories('s1', 1)).not.toBeNull();
        expect(getCachedCategories('newest', 1)).not.toBeNull();
    });

    it('Should not evict when overwriting an existing key at the cap', () => {
        for (let i = 0; i < MAX_ENTRIES; i++) setCachedCategories(`s${String(i)}`, 1, options(String(i)));

        setCachedCategories('s50', 1, options('updated'));

        expect(getCachedCategories('s0', 1)).not.toBeNull();
        expect(getCachedCategories('s50', 1)).toEqual(options('updated'));
    });

    it('Should empty the cache on clear', () => {
        setCachedCategories('f', 1, options('Food'));
        setCachedCategories('g', 1, options('Gas'));

        clearCategoryCache();

        expect(getCachedCategories('f', 1)).toBeNull();
        expect(getCachedCategories('g', 1)).toBeNull();
    });
});
