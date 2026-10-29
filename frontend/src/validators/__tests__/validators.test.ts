import { DateRangeTypeSchema } from 'types/DateRange.type';
import type { ExpenseDataRow } from 'types/Expense.type';
import { NoDataAPIResponseSchema, validateAPIResponse } from 'validators/validateAPIResponse';
import { validateEmail } from 'validators/validateEmail';
import { getErrorFor, validateExpenseRow } from 'validators/validateExpenseRow';
import { validateMoney } from 'validators/validateMoney';
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
        date: '01/15/2026',
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
