import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useLocalStorage, { dayjsTransform } from 'hooks/useLocalStorage';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { DateRangeType } from 'types/DateRange.type';
import { DateRangeTypeSchema } from 'types/DateRange.type';
import type { DateRangeContextType } from 'types/DateRangeContext.type';

export const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

const DAY_FORMAT = 'YYYY-MM-DD';

/**
 * Helper to compute the date range based on the range type, relative to now
 */
function computeDatesForRangeType(
    rangeType: DateRangeType,
    now: Dayjs
): {
    start: Dayjs;
    end: Dayjs;
} {
    switch (rangeType) {
        case 'this-week':
            return { start: now.startOf('week'), end: now.endOf('week') };
        case 'last-week':
            return {
                start: now.subtract(1, 'week').startOf('week'),
                end: now.subtract(1, 'week').endOf('week'),
            };
        case 'this-month':
            return { start: now.startOf('month'), end: now.endOf('month') };
        case 'last-month':
            return {
                start: now.subtract(1, 'month').startOf('month'),
                end: now.subtract(1, 'month').endOf('month'),
            };
        case 'this-year':
            return { start: now.startOf('year'), end: now.endOf('year') };
        case 'last-year':
            return {
                start: now.subtract(1, 'year').startOf('year'),
                end: now.subtract(1, 'year').endOf('year'),
            };
        case 'year-to-date':
            return { start: now.startOf('year'), end: now };
        case 'custom':
        default:
            return { start: now.startOf('month'), end: now.endOf('month') };
    }
}

/**
 * Context is managed inside provider, use hook when needed access
 * DateRange Context to store the following
 *
 * rangeType - quick selected option like 'This Week', 'Last Month' - will auto-update and compute current dates based on this option
 *
 * If user selects a custom range, store the start and end date of this range
 * customStartDate
 * customEndDate
 */
export const DateRangeContextProvider = ({ children }: { children: ReactNode }) => {
    const [rangeType, setRangeType] = useLocalStorage<DateRangeType>({
        key: 'rangeType',
        initialValue: 'this-month',
        schema: DateRangeTypeSchema,
    });

    const [customStartDate, setCustomStartDate] = useLocalStorage<Dayjs | null>({
        key: 'customStartDate',
        initialValue: null,
        transform: dayjsTransform,
    });

    const [customEndDate, setCustomEndDate] = useLocalStorage<Dayjs | null>({
        key: 'customEndDate',
        initialValue: null,
        transform: dayjsTransform,
    });

    /**
     * The current day - preset ranges are relative to it
     * Kept in state so a tab left open across midnight (or a month/year boundary) moves 'This Month' etc. forward
     * Re-checked at midnight and whenever the tab becomes visible again (background timers are throttled)
     */
    const [today, setToday] = useState<string>(() => dayjs().format(DAY_FORMAT));

    useEffect(() => {
        const syncToday = () => {
            setToday(dayjs().format(DAY_FORMAT)); // same string is a no-op render
        };

        let timer: ReturnType<typeof setTimeout>;
        const scheduleMidnight = () => {
            const msUntilTomorrow = dayjs().endOf('day').diff(dayjs()) + 1000;
            timer = setTimeout(() => {
                syncToday();
                scheduleMidnight();
            }, msUntilTomorrow);
        };
        scheduleMidnight();

        document.addEventListener('visibilitychange', syncToday);
        window.addEventListener('focus', syncToday);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', syncToday);
            window.removeEventListener('focus', syncToday);
        };
    }, []);

    /**
     * Compute the start, end dates based on the rangeType
     */
    const { startDate, endDate } = useMemo(() => {
        const now = dayjs(today);

        if (rangeType === 'custom') {
            const { start: fallbackStart, end: fallbackEnd } = computeDatesForRangeType('this-month', now);
            return {
                startDate: customStartDate ?? fallbackStart,
                endDate: customEndDate ?? fallbackEnd,
            };
        }

        const { start, end } = computeDatesForRangeType(rangeType, now);
        return { startDate: start, endDate: end };
    }, [today, rangeType, customStartDate, customEndDate]);

    /**
     * useCallback for stable function reference
     * Formats date
     */
    const dateFormat = useCallback((date: Dayjs, format = 'MM-DD-YYYY'): string => {
        return date.format(format);
    }, []);

    /**
     * Formatted dates
     */
    const formattedDates = useMemo(
        () => ({
            formattedStartDate: dateFormat(startDate),
            formattedEndDate: dateFormat(endDate),
            shortFormattedStartDate: dateFormat(startDate, 'YYYY-MM'),
            shortFormattedEndDate: dateFormat(endDate, 'YYYY-MM'),
        }),
        [startDate, endDate, dateFormat]
    );

    /**
     * Set a preset range type
     */
    const setPresetRange = useCallback(
        (type: Exclude<DateRangeType, 'custom'>) => {
            setRangeType(type);
        },
        [setRangeType]
    );

    /**
     * Set a custom date range
     */
    const setCustomRange = useCallback(
        (start: Dayjs, end: Dayjs) => {
            setRangeType('custom');
            setCustomStartDate(start);
            setCustomEndDate(end);
        },
        [setRangeType, setCustomStartDate, setCustomEndDate]
    );

    /**
     * Memoize the entire context value to prevent unnecessary re-renders
     */
    const value = useMemo<DateRangeContextType>(() => {
        return {
            startDate,
            endDate,
            ...formattedDates,
            rangeType,
            setPresetRange,
            setCustomRange,
            dateFormat,
        };
    }, [startDate, endDate, formattedDates, rangeType, setPresetRange, setCustomRange, dateFormat]);

    return <DateRangeContext value={value}>{children}</DateRangeContext>;
};
