import { z } from 'zod';
import { ExpenseSchema } from './Expense.type';

export const ExpenseListSchema = z.object({
    expenses: z.array(ExpenseSchema),
    filteredSum: z.number().nonnegative(),
    totalSum: z.number().nonnegative(),
});

export type ExpenseList = z.infer<typeof ExpenseListSchema>;
