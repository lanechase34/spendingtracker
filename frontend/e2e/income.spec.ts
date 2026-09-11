import { expect, type Locator, type Page, test } from '@playwright/test';

import {
    fillDate,
    login,
    NORMAL_USER,
    openExpenseForm,
    parseCurrency,
    selectCategory,
    setDateRangePreset,
    submitExpenseForm,
    toDatePickerDigits,
} from './helpers';

/**
 * The Net Income card, scoped by its "Net Income" title so it isn't confused
 * with any other card on the dashboard
 */
function netIncomeCard(page: Page): Locator {
    return page.locator('.MuiCard-root').filter({ hasText: 'Net Income' });
}

/**
 * Reads the dollar amount out of one of the Net Income card's three inner
 * cards ("Income", "Expenses", "Net"), identified by its label
 */
async function readCardAmount(page: Page, label: string): Promise<number> {
    const subCard = netIncomeCard(page).locator('.MuiCard-root').filter({ hasText: label });
    const text = await subCard.innerText();
    const match = /-?\$[\d,]+\.\d{2}/.exec(text);
    if (!match) throw new Error(`Could not find a currency amount in the "${label}" card: ${text}`);
    return parseCurrency(match[0]);
}

/**
 * Opens the Net Income card's Edit Income dialog
 */
async function openIncomeForm(page: Page): Promise<Locator> {
    await netIncomeCard(page).getByRole('button', { name: 'edit' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
}

async function fillIncomeForm(dialog: Locator, pay: string, extra: string) {
    await dialog.getByLabel('Pay').fill(pay);
    await dialog.getByLabel('Extra').fill(extra);
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
        await expenseDialog.getByLabel('Description').fill(`Net income test ${Date.now()}`);
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

    test('Requires pay and extra before saving', async ({ page }) => {
        const dialog = await openIncomeForm(page);

        await dialog.getByLabel('Pay').fill('');
        await dialog.getByLabel('Extra').fill('');
        await dialog.getByRole('button', { name: 'Update' }).click();

        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Field is required')).toHaveCount(2);

        await fillIncomeForm(dialog, '100.00', '10.00');
        await submitIncomeForm(dialog);
    });
});
