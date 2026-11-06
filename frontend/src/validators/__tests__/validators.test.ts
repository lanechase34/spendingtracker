import dayjs from 'dayjs';
import { DateRangeTypeSchema } from 'types/DateRange.type';
import type { ExpenseDataRow } from 'types/Expense.type';
import { NoDataAPIResponseSchema, validateAPIResponse } from 'validators/validateAPIResponse';
import { validateEmail } from 'validators/validateEmail';
import { getErrorFor, validateExpenseDate, validateExpenseRow } from 'validators/validateExpenseRow';
import { validateFile } from 'validators/validateFile';
import { validateMoney, validateNonNegativeMoney } from 'validators/validateMoney';
import { normalize2FACode, validate2FACode } from 'validators/validateTOTP';
import { z } from 'zod';

describe('validateMoney', () => {
    it.each([null, ''])('Should require a value for %p', (value) => {
        expect(validateMoney(value)).toBe('Field is required');
    });

    it.each(['1', '1.5', '1.50', '0.01', '1000000', ' 12.34 '])('Should accept %p', (value) => {
        expect(validateMoney(value)).toBeNull();
    });

    it.each(['   ', 'abc', '1.234', '-5', '1,000', '1.', '.5', 'null', 'NaN'])(
        'Should reject %p as an invalid amount',
        (value) => {
            expect(validateMoney(value)).toBe('Enter a valid amount with up to 2 decimal places');
        }
    );

    it.each(['0', '0.00', '000'])('Should reject %p as not positive', (value) => {
        expect(validateMoney(value)).toBe('Enter a positive amount greater than zero');
    });

    it.each(['0', '0.00', '000'])('Should accept %p with allowZero', (value) => {
        expect(validateMoney(value, { allowZero: true })).toBeNull();
    });
});

describe('validateNonNegativeMoney', () => {
    it.each(['0', '0.00', '1', '12.34'])('Should accept %p', (value) => {
        expect(validateNonNegativeMoney(value)).toBeNull();
    });

    it('Should still require a value', () => {
        expect(validateNonNegativeMoney('')).toBe('Field is required');
    });

    it.each(['-1', '1.234', 'abc'])('Should reject %p as an invalid amount', (value) => {
        expect(validateNonNegativeMoney(value)).toBe('Enter a valid amount with up to 2 decimal places');
    });
});

describe('validateFile', () => {
    const csvTypes = ['text/csv'];
    const max = 1024;

    it.each([
        ['text/csv', 'a.csv'],
        ['application/vnd.ms-excel', 'a.csv'],
        ['', 'a.CSV'],
    ])('Should accept a CSV reported as %p (%s)', (type, name) => {
        const file = new File(['x'], name, { type });
        expect(validateFile(file, csvTypes, max)).toEqual({ file, error: null });
    });

    it.each([
        ['application/vnd.ms-excel', 'a.xls'],
        ['', 'a.txt'],
        ['', 'csv'],
        ['text/plain', 'a.csv'],
    ])('Should reject %p (%s)', (type, name) => {
        expect(validateFile(new File(['x'], name, { type }), csvTypes, max).error).toBe('Invalid file type.');
    });

    it('Should not accept an untyped .csv when CSV is not an allowed type', () => {
        expect(validateFile(new File(['x'], 'a.csv', { type: '' }), ['image/png'], max).error).toBe(
            'Invalid file type.'
        );
    });
});

describe('validate2FACode', () => {
    it.each([
        ['123456', '123456'],
        [' 123 456 ', '123456'],
        ['ABCD-1234-EFGH-5678', 'abcd-1234-efgh-5678'],
        ['abcd-1234-efgh-5678\n', 'abcd-1234-efgh-5678'],
    ])('Should normalize and accept %p', (value, normalized) => {
        expect(normalize2FACode(value)).toBe(normalized);
        expect(validate2FACode(value)).toBeNull();
    });

    it.each(['', '   '])('Should require a code for %p', (value) => {
        expect(validate2FACode(value)).toBe('Please enter your code.');
    });

    it.each(['12345', 'abcd-1234', '1234567'])('Should reject %p', (value) => {
        expect(validate2FACode(value)).toBe('Enter a 6-digit code or recovery code (xxxx-xxxx-xxxx-xxxx).');
    });
});

describe('validateEmail', () => {
    it.each([null, '', '   '])('Should require a value for %p', (value) => {
        expect(validateEmail(value)).toBe('Field is required');
    });

    it.each(['user@example.com', 'first.last+tag@sub.example.co', 'a_b-c%d@x.io'])('Should accept %p', (value) => {
        expect(validateEmail(value)).toBeNull();
    });

    it.each(['plainaddress', 'user@', '@example.com', 'user@example', 'user@example.c', 'us er@example.com'])(
        'Should reject %p',
        (value) => {
            expect(validateEmail(value)).toBe('Not a valid email');
        }
    );
});

describe('validateExpenseRow', () => {
    const validRow: ExpenseDataRow = {
        id: '1',
        date: dayjs().format('MM/DD/YYYY'),
        amount: 12.5,
        description: 'Groceries',
        categoryid: 3,
        category: null,
    };

    it('Should return no errors for a valid row', () => {
        expect(validateExpenseRow(validRow)).toEqual([]);
    });

    it('Should accept a free text category in place of a category id', () => {
        expect(validateExpenseRow({ ...validRow, categoryid: null, category: 'New Category' })).toEqual([]);
    });

    it('Should accept category id 0 since only null means missing', () => {
        expect(validateExpenseRow({ ...validRow, categoryid: 0 })).toEqual([]);
    });

    it.each(['', 'ab', '  ab  '])('Should reject description %p as too short', (description) => {
        expect(getErrorFor('description', validateExpenseRow({ ...validRow, description }))).toBe(
            'Description must be at least 3 characters'
        );
    });

    it('Should pass amount errors through from validateMoney', () => {
        expect(getErrorFor('amount', validateExpenseRow({ ...validRow, amount: 0 }))).toBe(
            'Enter a positive amount greater than zero'
        );
        expect(getErrorFor('amount', validateExpenseRow({ ...validRow, amount: 1.234 }))).toBe(
            'Enter a valid amount with up to 2 decimal places'
        );
    });

    it('Should require an amount when it is missing', () => {
        // BulkImportRow stores null when the amount field can't be parsed
        expect(getErrorFor('amount', validateExpenseRow({ ...validRow, amount: null }))).toBe('Field is required');
    });

    const { categoryid: _id, category: _name, ...rowWithoutCategory } = validRow;

    it.each([
        ['both are null', { ...validRow, categoryid: null, category: null }],
        ['both are omitted', rowWithoutCategory],
        ['the text is blank', { ...validRow, categoryid: null, category: '   ' }],
    ])('Should require a category when %s', (_label, row: ExpenseDataRow) => {
        expect(getErrorFor('category', validateExpenseRow(row))).toBe('Category is required');
    });

    it('Should report every invalid field at once', () => {
        const errors = validateExpenseRow({ ...validRow, description: '', amount: 0, categoryid: null });
        expect(errors.map((e) => e.field)).toEqual(['description', 'amount', 'category']);
    });

    it('Should return an empty string from getErrorFor when the field has no error', () => {
        expect(getErrorFor('date', validateExpenseRow(validRow))).toBe('');
    });

    it.each([
        ['missing', '', 'Date is required'],
        ['invalid', 'Invalid Date', 'Your date is not valid'],
        [
            'before the range',
            dayjs().subtract(1, 'year').subtract(1, 'day').format('MM/DD/YYYY'),
            'Please select a date within a 1-year range',
        ],
        [
            'after the range',
            dayjs().add(1, 'year').add(1, 'day').format('MM/DD/YYYY'),
            'Please select a date within a 1-year range',
        ],
    ])('Should reject a date that is %s', (_label, date, message) => {
        expect(getErrorFor('date', validateExpenseRow({ ...validRow, date }))).toBe(message);
    });
});

describe('validateExpenseDate', () => {
    it.each([
        ['today', dayjs().format('MM/DD/YYYY')],
        ['the first day of the range', dayjs().subtract(1, 'year').format('MM/DD/YYYY')],
        ['the last day of the range', dayjs().add(1, 'year').format('MM/DD/YYYY')],
        ['a Date object', new Date()],
    ])('Should accept %s', (_label, date) => {
        expect(validateExpenseDate(date)).toBeNull();
    });

    it.each([null, undefined])('Should require a date for %p', (date) => {
        expect(validateExpenseDate(date)).toBe('Date is required');
    });
});

describe('validateAPIResponse', () => {
    const Schema = validateAPIResponse(z.array(z.number()));

    it('Should accept a success response with valid data', () => {
        expect(Schema.safeParse({ error: false, data: [1, 2] }).success).toBe(true);
    });

    it('Should accept a success response with pagination', () => {
        const pagination = { page: 1, offset: 0, totalRecords: 2, totalPages: 1 };
        expect(Schema.safeParse({ error: false, data: [1], pagination }).success).toBe(true);
    });

    it('Should reject a success response with invalid data', () => {
        expect(Schema.safeParse({ error: false, data: ['1'] }).success).toBe(false);
    });

    it('Should accept an error response with messages', () => {
        expect(Schema.safeParse({ error: true, messages: ['Bad request'] }).success).toBe(true);
    });

    it('Should reject an error response without messages', () => {
        expect(Schema.safeParse({ error: true }).success).toBe(false);
    });

    it('Should reject an error response that carries data', () => {
        expect(Schema.safeParse({ error: true, data: [1], messages: [] }).success).toBe(false);
    });

    it.each([null, undefined, 'text', {}, { data: [1] }])('Should reject %p', (value) => {
        expect(Schema.safeParse(value).success).toBe(false);
    });
});

describe('NoDataAPIResponseSchema', () => {
    it.each([
        ['null data', { error: false, data: null }],
        ['missing data', { error: false }],
        ['messages', { error: false, messages: ['Saved'] }],
        ['an error', { error: true, messages: ['Failed'] }],
    ])('Should accept a response with %s', (_label, value) => {
        expect(NoDataAPIResponseSchema.safeParse(value).success).toBe(true);
    });

    it('Should reject a response with a data payload', () => {
        expect(NoDataAPIResponseSchema.safeParse({ error: false, data: { id: 1 } }).success).toBe(false);
    });
});

describe('DateRangeTypeSchema', () => {
    it.each(['this-week', 'last-week', 'this-month', 'last-month', 'this-year', 'last-year', 'year-to-date', 'custom'])(
        'Should accept %p',
        (value) => {
            expect(DateRangeTypeSchema.safeParse(value).success).toBe(true);
        }
    );

    it.each(['', 'next-week', 'THIS-WEEK', null, 1])('Should reject %p', (value) => {
        expect(DateRangeTypeSchema.safeParse(value).success).toBe(false);
    });
});
