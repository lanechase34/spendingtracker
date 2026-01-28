import type { Dayjs } from 'dayjs';
import type { Dispatch, SetStateAction } from 'react';

export interface DateRangeContextType {
    startDate: Dayjs;
    endDate: Dayjs;
    formattedStartDate: string;
    formattedEndDate: string;
    shortFormattedStartDate: string;
    shortFormattedEndDate: string;
    setStartDate: Dispatch<SetStateAction<Dayjs>>;
    setEndDate: Dispatch<SetStateAction<Dayjs>>;
    dateFormat: (date: Dayjs, format?: string) => string;
}
