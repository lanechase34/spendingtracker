import { createContext, useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { DateRangeContextType } from 'types/DateRangeContext.type';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import useLocalStorage from 'hooks/useLocalStorage';

// Initialize as undefined to enforce usage inside the provider
export const DateRangeContext = createContext<DateRangeContextType | undefined>(undefined);

/**
 * Context is managed inside provider, use hook when needed access
 * DateRange Context to store the following
 *
 * startDate
 * endDate
 */
export const DateRangeContextProvider = ({ children }: { children: ReactNode }) => {
    const [startDate, setStartDate] = useLocalStorage<Dayjs>({
        key: 'startDate',
        initialValue: dayjs().startOf('month'),
        serialize: (date: Dayjs) => date.toISOString(),
        deserialize: (str: string) => dayjs(str),
    });

    const [endDate, setEndDate] = useLocalStorage<Dayjs>({
        key: 'endDate',
        initialValue: dayjs().endOf('month'),
        serialize: (date: Dayjs) => date.toISOString(),
        deserialize: (str: string) => dayjs(str),
    });

    /**
     * useCallback for stable function reference
     */
    const dateFormat = useCallback((date: Dayjs, format = 'MM-DD-YYYY'): string => {
        return date.format(format);
    }, []);

    /**
     * Memoize the entire context value to prevent unnecessary re-renders
     */
    const value = useMemo<DateRangeContextType>(() => {
        const formattedStartDate = dateFormat(startDate);
        const formattedEndDate = dateFormat(endDate);
        const shortFormattedStartDate = dateFormat(startDate, 'YYYY-MM');
        const shortFormattedEndDate = dateFormat(endDate, 'YYYY-MM');

        return {
            startDate,
            endDate,
            formattedStartDate,
            formattedEndDate,
            shortFormattedStartDate,
            shortFormattedEndDate,
            setStartDate,
            setEndDate,
            dateFormat,
        };
    }, [startDate, endDate, setStartDate, setEndDate, dateFormat]);

    return <DateRangeContext value={value}>{children}</DateRangeContext>;
};
