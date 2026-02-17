import type { Dayjs } from 'dayjs';

import type { DateRangeType } from './DateRange.type';

export interface DateRangeContextType {
    startDate: Dayjs;
    endDate: Dayjs;
    formattedStartDate: string;
    formattedEndDate: string;
    shortFormattedStartDate: string;
    shortFormattedEndDate: string;
    rangeType: DateRangeType;
    setPresetRange: (type: Exclude<DateRangeType, 'custom'>) => void;
    setCustomRange: (start: Dayjs, end: Dayjs) => void;
    dateFormat: (date: Dayjs, format?: string) => string;
}
