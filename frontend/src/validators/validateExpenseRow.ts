import dayjs from 'dayjs';
import type { ExpenseDataRow } from 'types/Expense.type';

import { validateMoney } from './validateMoney';

export type FieldName = keyof ExpenseDataRow;

export interface ErrorField {
    field: FieldName;
    error: string;
}

/**
 * Range the expense date pickers allow, one year either side of today
 */
export const getExpenseDateRange = () => ({
    minDate: dayjs().subtract(1, 'year'),
    maxDate: dayjs().add(1, 'year'),
});

/**
 * Validate an expense date is present, valid, and within the picker range (day granularity)
 */
export const validateExpenseDate = (value: Date | string | null | undefined): string | null => {
    if (value == null || value === '') return 'Date is required';

    const date = dayjs(value);
    if (!date.isValid()) return 'Your date is not valid';

    const { minDate, maxDate } = getExpenseDateRange();
    if (date.isBefore(minDate, 'day') || date.isAfter(maxDate, 'day')) {
        return 'Please select a date within a 1-year range';
    }
    return null;
};

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
        errors.push({
            field: 'description',
            error: 'Description must be at least 3 characters',
        });
    }

    const amountValidate = validateMoney(row.amount == null ? null : String(row.amount));
    if (amountValidate !== null) {
        errors.push({ field: 'amount', error: amountValidate });
    }

    const noCategoryId = row.categoryid == null;
    const noCategoryText = row.category == null || row.category.trim() === '';
    if (noCategoryId && noCategoryText) {
        errors.push({ field: 'category', error: 'Category is required' });
    }

    const dateValidate = validateExpenseDate(row.date);
    if (dateValidate !== null) {
        errors.push({ field: 'date', error: dateValidate });
    }

    return errors;
};

export const getErrorFor = (field: FieldName, error: ErrorField[]) => error.find((e) => e.field === field)?.error ?? '';
