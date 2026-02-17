import type { ExpenseDataRow } from 'types/Expense.type';

import { validateMoney } from './validateMoney';

export type FieldName = keyof ExpenseDataRow;

export interface ErrorField {
    field: FieldName;
    error: string;
}

/**
 * Validate the fields of an expense row
 *
 * @date
 * @description
 * @amount
 * @category (id / string)
 */
export const validateExpenseRow = (row: ExpenseDataRow): ErrorField[] => {
    const errors: ErrorField[] = [];

    if (!row.description || row.description.trim().length < 3) {
        errors.push({ field: 'description', error: 'Description must be at least 3 characters' });
    }

    const amountValidate = validateMoney(`${row?.amount ?? null}`);
    if (amountValidate !== null) {
        errors.push({ field: 'amount', error: amountValidate });
    }

    const noCategoryId = row.categoryid == null;
    const noCategoryText = !row.category || row.category.trim() === '';
    if (noCategoryId && noCategoryText) {
        errors.push({ field: 'category', error: 'Category is required' });
    }

    return errors;
};

export const getErrorFor = (field: FieldName, error: ErrorField[]) => error.find((e) => e.field === field)?.error ?? '';
