import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

/**
 * Result of API processing each CSV row
 */
const ImportedExpenseSchema = z.object({
    id: z.string().optional(),
    date: z.string(),
    amount: z.number().min(0.01),
    description: z.string(),
});

export type ImportedExpense = z.infer<typeof ImportedExpenseSchema>;

/**
 * Result of API for each row that errors
 */
const ErroredExpenseSchema = z.object({
    row: z.number(),
    message: z.string(),
});

export type ErroredExpense = z.infer<typeof ErroredExpenseSchema>;

/**
 * API return format
 */
export const ImportResponseSchema = validateAPIResponse(
    z.object({
        imported: z.array(ImportedExpenseSchema),
        errored: z.array(ErroredExpenseSchema),
    })
);
