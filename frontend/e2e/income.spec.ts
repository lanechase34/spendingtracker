import { expect, type Locator, type Page, test } from '@playwright/test';

import {
    fillDate,
    login,
    netIncomeCard,
    NORMAL_USER,
    openExpenseForm,
    openIncomeForm,
    readCardAmount,
    selectCategory,
    setDateRangePreset,
    submitExpenseForm,
    toDatePickerDigits,
} from './helpers';

/**
 * Extra income is a list of entries that persists across runs, so remove every entry for the month
 * then stage a single entry for the amount, leaving Extra equal to exactly that amount
 */
async function setExtraIncome(dialog: Locator, amount: string) {
    // Entries are listed once the extra income fetch finishes
    await expect(dialog.getByLabel('Extra', { exact: true })).toBeEnabled();

    const deleteButtons = dialog.getByRole('button', { name: /^delete / });
    while ((await deleteButtons.count()) > 0) {
        await deleteButtons.first().click();
    }

    await dialog.getByLabel('Amount').fill(amount);
    await dialog.getByLabel('Description').fill(`E2E extra ${String(Date.now())}`);
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(dialog.getByLabel('Extra', { exact: true })).toHaveValue(amount);
}

async function fillIncomeForm(dialog: Locator, pay: string, extra: string) {
    await dialog.getByLabel('Pay').fill(pay);
    await setExtraIncome(dialog, extra);
}

async function submitIncomeForm(dialog: Locator) {
    await dialog.getByRole('button', { name: 'Update' }).click();
    await expect(dialog).toBeHidden();
}

/**
 * Verifies the card's own arithmetic (Net = Income - Expenses) against whatever Income and
 * Expenses currently show
 * A predicted target can be invalidated by any other change to this account's current-month
 * data landing between the prediction and this assertion
 */
async function assertNetEqualsIncomeMinusExpenses(page: Page) {
    await expect(async () => {
        const income = await readCardAmount(page, 'Income');
        const expenses = await readCardAmount(page, 'Expenses'); // already negative-signed
        const net = await readCardAmount(page, 'Net');
        expect(net).toBeCloseTo(income + expenses, 2);
    }).toPass();
}

test.describe('Net Income card', () => {
    // These tests read the current month's Income/Expenses totals and act on them
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        // Income is stored per calendar month, so pin the range to a single month
        await setDateRangePreset(page, 'This Month');
    });

    test('Saves pay and extra income and shows their sum as Income, leaving Expenses unchanged', async ({ page }) => {
        const expensesBefore = await readCardAmount(page, 'Expenses');

        const dialog = await openIncomeForm(page);
        await fillIncomeForm(dialog, '3000.00', '250.00');
        await submitIncomeForm(dialog);

        await expect(netIncomeCard(page).locator('.MuiCard-root').filter({ hasText: 'Income' })).toContainText(
            '$3,250.00'
        );

        const expensesAfter = await readCardAmount(page, 'Expenses');
        expect(expensesAfter).toBe(expensesBefore);
    });

    test('Shows Net as income minus expenses, negative when expenses exceed income', async ({ page }) => {
        // Create a known expense so Net can be driven to a known value on both
        // sides of zero, regardless of whatever expenses already exist this month
        const expenseDialog = await openExpenseForm(page);
        await fillDate(expenseDialog, page, toDatePickerDigits(new Date()));
        await expenseDialog.getByLabel('Description').fill(`Net income test ${String(Date.now())}`);
        await expenseDialog.getByLabel('Amount').fill('100.00');
        await selectCategory(expenseDialog, page, 'Entertainment');
        await submitExpenseForm(expenseDialog);

        // The Expenses card displays its figure with a leading "-" (e.g. "-$45.00"), so the
        // parsed amount is negative - take its magnitude. Re-read it fresh right before each
        // income update rather than reusing one read, since other tests can still touch this
        // account's data outside this describe block's own serial run

        // Income $25 under expenses -> Net is negative
        const expensesBelow = Math.abs(await readCardAmount(page, 'Expenses'));
        const belowDialog = await openIncomeForm(page);
        await fillIncomeForm(belowDialog, (expensesBelow - 30).toFixed(2), '5.00');
        await submitIncomeForm(belowDialog);
        await assertNetEqualsIncomeMinusExpenses(page);
        expect(await readCardAmount(page, 'Net')).toBeLessThan(0);

        // Income $40 over expenses -> Net is positive, no leading minus sign
        const expensesAbove = Math.abs(await readCardAmount(page, 'Expenses'));
        const aboveDialog = await openIncomeForm(page);
        await fillIncomeForm(aboveDialog, (expensesAbove + 35).toFixed(2), '5.00');
        await submitIncomeForm(aboveDialog);
        await assertNetEqualsIncomeMinusExpenses(page);
        expect(await readCardAmount(page, 'Net')).toBeGreaterThan(0);
    });

    test('Requires a valid pay before saving', async ({ page }) => {
        const dialog = await openIncomeForm(page);

        await dialog.getByLabel('Pay').fill('');
        await dialog.getByRole('button', { name: 'Update' }).click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Field is required')).toHaveCount(1);

        await fillIncomeForm(dialog, '100.00', '10.00');
        await submitIncomeForm(dialog);
    });

    test('Requires an amount and description to add extra income, and only saves on Update', async ({ page }) => {
        const dialog = await openIncomeForm(page);
        await expect(dialog.getByLabel('Extra', { exact: true })).toBeEnabled();
        const extraBefore = await dialog.getByLabel('Extra', { exact: true }).inputValue();

        await dialog.getByRole('button', { name: 'Add' }).click();
        await expect(dialog.getByText('Field is required')).toBeVisible();
        await expect(dialog.getByText('Description is required')).toBeVisible();

        // A staged entry is discarded when the dialog closes without saving
        await dialog.getByLabel('Amount').fill('12.34');
        await dialog.getByLabel('Description').fill('Discarded entry');
        await dialog.getByRole('button', { name: 'Add' }).click();
        await expect(dialog.getByText('Discarded entry')).toBeVisible();
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(dialog).toBeHidden();

        const reopened = await openIncomeForm(page);
        await expect(reopened.getByLabel('Extra', { exact: true })).toHaveValue(extraBefore);
        await expect(reopened.getByText('Discarded entry')).toHaveCount(0);
    });
});
