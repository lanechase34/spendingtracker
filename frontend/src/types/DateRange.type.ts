import { z } from 'zod';

// Valid 'quick' date ranges to be selected
export const DateRangeTypeSchema = z.enum([
    'this-week',
    'last-week',
    'this-month',
    'last-month',
    'this-year',
    'last-year',
    'year-to-date',
    'custom',
]);
export type DateRangeType = z.infer<typeof DateRangeTypeSchema>;
