import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, type Locator, type Page, test } from '@playwright/test';

import {
    expenseRow,
    fillDate,
    login,
    NORMAL_USER,
    openExpenseForm,
    searchExpenses,
    selectCategory,
    setDateRangePreset,
    submitExpenseForm,
} from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * A real image asset from the app itself, used to exercise the receipt upload field.
 */
const RECEIPT_PATH = path.join(__dirname, '..', 'public', 'icons', 'logo192.png');

interface ExpenseInput {
    /** Digits only, no separators - e.g. "01152026" for Jan 15, 2026 */
    date: string;
    description: string;
    amount: string;
    category: string;
    receiptPath?: string;
}

async function fillExpenseForm(dialog: Locator, page: Page, expense: ExpenseInput) {
    await fillDate(dialog, page, expense.date);
    await dialog.getByLabel('Description').fill(expense.description);
    await dialog.getByLabel('Amount').fill(expense.amount);
    await selectCategory(dialog, page, expense.category);

    if (expense.receiptPath) {
        await dialog.locator('#uploadReceipt').setInputFiles(expense.receiptPath);
    }
}

test.describe('Track Expense form', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        await setDateRangePreset(page, 'This Year');
    });

    test('Saves expenses with different dates, descriptions, amounts, and categories', async ({ page }) => {
        const stamp = Date.now();
        const expenses: ExpenseInput[] = [
            { date: '01152026', description: `Grocery Run ${stamp}`, amount: '54.32', category: 'Grocery' },
            { date: '04012026', description: `Car Tune Up ${stamp}`, amount: '120', category: 'Car' },
            { date: '07202026', description: `Movie Night ${stamp}`, amount: '15.5', category: 'Entertainment' },
            { date: '12252026', description: `Holiday Gifts ${stamp}`, amount: '250.00', category: 'Gifts' },
        ];

        for (const expense of expenses) {
            const dialog = await openExpenseForm(page);
            await fillExpenseForm(dialog, page, expense);
            await submitExpenseForm(dialog);
        }

        // Search once by the shared stamp rather than re-searching per expense
        await searchExpenses(page, `${stamp}`);

        for (const expense of expenses) {
            const row = expenseRow(page, expense.description);
            await expect(row).toBeVisible();

            const [month, day, year] = [expense.date.slice(0, 2), expense.date.slice(2, 4), expense.date.slice(4)];
            await expect(row).toContainText(`${month}/${day}/${year}`);
            await expect(row).toContainText(expense.category);
        }
    });

    test('Receipt is optional', async ({ page }) => {
        const stamp = Date.now();

        // With a receipt attached
        const withReceipt: ExpenseInput = {
            date: '02102026',
            description: `Camera Gear ${stamp}`,
            amount: '99.99',
            category: 'Entertainment',
            receiptPath: RECEIPT_PATH,
        };
        const dialogWithReceipt = await openExpenseForm(page);
        await fillExpenseForm(dialogWithReceipt, page, withReceipt);
        await expect(dialogWithReceipt.getByText('Selected:')).toBeVisible();
        await submitExpenseForm(dialogWithReceipt);

        // Without a receipt
        const withoutReceipt: ExpenseInput = {
            date: '02112026',
            description: `Coffee Run ${stamp}`,
            amount: '4.75',
            category: 'Restaurant',
        };
        const dialogWithoutReceipt = await openExpenseForm(page);
        await fillExpenseForm(dialogWithoutReceipt, page, withoutReceipt);
        await submitExpenseForm(dialogWithoutReceipt);

        // Search once by the shared stamp rather than re-searching per expense
        await searchExpenses(page, `${stamp}`);

        await expenseRow(page, withReceipt.description).getByRole('button', { name: 'Expense Detail' }).click();
        const detailWithReceipt = page.getByRole('dialog');
        await expect(detailWithReceipt).toBeVisible();
        await expect(detailWithReceipt.locator('img')).toBeVisible();
        await detailWithReceipt.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(detailWithReceipt).toBeHidden();

        await expenseRow(page, withoutReceipt.description).getByRole('button', { name: 'Expense Detail' }).click();
        const detailWithoutReceipt = page.getByRole('dialog');
        await expect(detailWithoutReceipt).toBeVisible();
        await expect(detailWithoutReceipt.locator('img')).toHaveCount(0);
    });

    test('Requires date, description, amount, and category before saving', async ({ page }) => {
        const dialog = await openExpenseForm(page);

        // Date defaults to today, so leaving everything else blank exercises the other three
        await dialog.getByRole('button', { name: 'Track' }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Description must be at least 3 characters')).toBeVisible();
        await expect(dialog.getByText('Field is required')).toBeVisible();
        await expect(dialog.getByText('Category is required')).toBeVisible();

        // Fill in the other three fields, but push the date more than a year out
        await dialog.getByLabel('Description').fill('Valid description text');
        await dialog.getByLabel('Amount').fill('10.00');
        await selectCategory(dialog, page, 'Entertainment');
        await fillDate(dialog, page, '09102028');

        await dialog.getByRole('button', { name: 'Track' }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Please select a date within a 1-year range')).toBeVisible();

        // Correcting the date allows the save to go through
        await fillDate(dialog, page, '09102026');
        await submitExpenseForm(dialog);
    });
});
