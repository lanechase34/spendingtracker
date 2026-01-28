import { z } from 'zod';

export const ExpenseSchema = z.object({
    id: z.number().int().positive(),
    date: z.string(),
    amount: z.number().nonnegative(),
    description: z.string(),
    category: z.string(),
    receipt: z.number().int().min(0).max(1),
});

export type Expense = z.infer<typeof ExpenseSchema>;

export interface ExpenseDataRow {
    id?: string;
    date: Date | string;
    amount: number;
    description: string;
    category?: string | null;
    categoryid?: number | null;
    receipt?: File | null;
    receiptError?: string | null;
}
