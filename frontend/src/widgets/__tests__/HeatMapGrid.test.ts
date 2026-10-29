import { formatDateKey } from 'utils/dates';
import { buildYearGrid } from 'widgets/HeatMap';

const keys = (days: Date[]) => days.map(formatDateKey);

describe('buildYearGrid', () => {
    it('Should pad the first week back to Sunday and the last week out to Saturday', () => {
        // Wed Mar 4 2026 - Tue Mar 10 2026
        const weeks = buildYearGrid(new Date(2026, 2, 4), new Date(2026, 2, 10));

        expect(weeks).toHaveLength(2);
        expect(keys(weeks[0] ?? [])).toEqual([
            '2026-03-01',
            '2026-03-02',
            '2026-03-03',
            '2026-03-04',
            '2026-03-05',
            '2026-03-06',
            '2026-03-07',
        ]);
        expect(formatDateKey(weeks[1]?.[6] ?? new Date(0))).toBe('2026-03-14');
    });

    it('Should return a single week when the range starts on Sunday and ends on Saturday', () => {
        const weeks = buildYearGrid(new Date(2026, 2, 1), new Date(2026, 2, 7));

        expect(weeks).toHaveLength(1);
    });

    it('Should start every week on Sunday with consecutive days', () => {
        const weeks = buildYearGrid(new Date(2026, 0, 1), new Date(2026, 11, 31));

        for (const week of weeks) {
            expect(week[0].getDay()).toBe(0);
            expect(week[6].getDay()).toBe(6);
        }
        const allDays = weeks.flat();
        allDays.slice(1).forEach((day, i) => {
            const prev = allDays[i] ?? day;
            expect(Math.round((day.getTime() - prev.getTime()) / 86_400_000)).toBe(1);
        });
    });

    it('Should cover a full year in 53 weeks for 2026', () => {
        // Jan 1 2026 is a Thursday and Dec 31 2026 is a Thursday
        const weeks = buildYearGrid(new Date(2026, 0, 1), new Date(2026, 11, 31));

        expect(weeks).toHaveLength(53);
        expect(formatDateKey(weeks[0]?.[0] ?? new Date(0))).toBe('2025-12-28');
        expect(formatDateKey(weeks.at(-1)?.[6] ?? new Date(0))).toBe('2027-01-02');
    });

    it('Should not shift days across a daylight saving change', () => {
        // US DST starts Sun Mar 8 2026
        const weeks = buildYearGrid(new Date(2026, 2, 8), new Date(2026, 2, 14));

        expect(keys(weeks[0] ?? [])).toEqual([
            '2026-03-08',
            '2026-03-09',
            '2026-03-10',
            '2026-03-11',
            '2026-03-12',
            '2026-03-13',
            '2026-03-14',
        ]);
    });

    it('Should not mutate the dates passed in', () => {
        const start = new Date(2026, 2, 4);
        const end = new Date(2026, 2, 10);

        buildYearGrid(start, end);

        expect(formatDateKey(start)).toBe('2026-03-04');
        expect(formatDateKey(end)).toBe('2026-03-10');
    });
});
