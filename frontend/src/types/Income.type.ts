import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

/**
 * GET /income
 * Pay and extra income totals for a date range
 */
const IncomeSchema = z.object({
    pay: z.number().nonnegative(),
    extra: z.number().nonnegative(),
});

export type Income = z.infer<typeof IncomeSchema>;
export const IncomeResponseSchema = validateAPIResponse(IncomeSchema);

/**
 * GET /income/extra
 * An individual extra income entry
 */
const IncomeExtraSchema = z.object({
    id: z.number().int().positive(),
    date: z.iso.date(),
    amount: z.number().positive(),
    description: z.string(),
});

export type IncomeExtra = z.infer<typeof IncomeExtraSchema>;
export const IncomeExtraListResponseSchema = validateAPIResponse(z.array(IncomeExtraSchema));

/**
 * POST /income/extra
 * Returns the new entry's id
 */
export const SaveIncomeExtraResponseSchema = validateAPIResponse(
    z.object({
        id: z.number().int().positive(),
    })
);

/**
 * Request bodies
 */
export interface UpdateIncomeBody extends Record<string, unknown> {
    date: string;
    pay: string;
}

export interface SaveIncomeExtraBody extends Record<string, unknown> {
    date: string;
    amount: string;
    description: string;
}
