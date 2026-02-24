import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useLocalStorage, { dayjsTransform } from 'hooks/useLocalStorage';
import type { ReactNode } from 'react';
import { createContext, useCallback, useMemo } from 'react';
import type { DateRangeType } from 'types/DateRange.type';
import type { DateRangeContextType } from 'types/DateRangeContext.type';

export const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

/**
 * Helper to compute the date range based on the range type
 */
function computeDatesForRangeType(rangeType: DateRangeType): {
    start: Dayjs;
    end: Dayjs;
} {
    const now = dayjs();

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
     * Compute the start, end dates based on the rangeType
     */
    const { startDate, endDate } = useMemo(() => {
        if (rangeType === 'custom') {
            const { start: fallbackStart, end: fallbackEnd } = computeDatesForRangeType('this-month');
            return {
                startDate: customStartDate ?? fallbackStart,
                endDate: customEndDate ?? fallbackEnd,
            };
        }

        const { start, end } = computeDatesForRangeType(rangeType);
        return { startDate: start, endDate: end };
    }, [rangeType, customStartDate, customEndDate]);

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
