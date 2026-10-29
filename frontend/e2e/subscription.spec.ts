import { expect, type Locator, type Page, test } from '@playwright/test';

import {
    escapeRegExp,
    expenseListGrid,
    fillDate,
    login,
    NORMAL_USER,
    openExpenseForm,
    searchExpenses,
    selectCategory,
    setCustomDateRange,
    submitExpenseForm,
    toDatePickerDigits,
    toDisplayDate,
} from './helpers';

interface SubscriptionInput {
    date: Date;
    description: string;
    amount: string;
    category: string;
    interval: 'Y' | 'M';
}

function addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
}

function addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
}

async function fillSubscriptionForm(dialog: Locator, page: Page, sub: SubscriptionInput) {
    await fillDate(dialog, page, toDatePickerDigits(sub.date));
    await dialog.getByLabel('Description').fill(sub.description);
    await dialog.getByLabel('Amount').fill(sub.amount);
    await selectCategory(dialog, page, sub.category);
    await dialog.getByRole('checkbox', { name: 'Subscription' }).check();
    await dialog.getByRole('radio', { name: sub.interval === 'Y' ? 'Yearly' : 'Monthly' }).check();
}

/**
 * The dashboard also renders an Expense List grid with an identical search box,
 * so every lookup is scoped to the Subscription List grid specifically
 */
function subscriptionListGrid(page: Page): Locator {
    return page.locator('.MuiDataGrid-root').filter({ hasText: 'Subscription List' });
}

async function searchSubscriptions(page: Page, query: string) {
    await subscriptionListGrid(page).getByRole('searchbox').fill(query);
}

function subscriptionRow(page: Page, description: string): Locator {
    return subscriptionListGrid(page).getByRole('row', { name: new RegExp(escapeRegExp(description)) });
}

/**
 * Rows matching a description in the Expense List - plural because a backfilled
 * subscription creates one expense per period passed, all sharing that description
 */
function expenseRows(page: Page, description: string): Locator {
    return expenseListGrid(page).getByRole('row').filter({ hasText: description });
}

test.describe('Track Expense form - subscription option', () => {
    test.beforeEach(async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);

        // Widen the active date range to cover a year back, since a backfilled yearly
        // subscription's earliest charge lands close to a year before today.
        const today = new Date();
        await setCustomDateRange(page, addYears(today, -1), today);
    });

    test('Saves a Monthly subscription and charges it immediately', async ({ page }) => {
        const today = new Date();
        const stamp = Date.now();
        const sub: SubscriptionInput = {
            date: today,
            description: `Monthly Sub ${String(stamp)}`,
            amount: '9.99',
            category: 'Entertainment',
            interval: 'M',
        };

        const dialog = await openExpenseForm(page);
        await fillSubscriptionForm(dialog, page, sub);
        await submitExpenseForm(dialog);

        await searchSubscriptions(page, sub.description);
        const row = subscriptionRow(page, sub.description);
        await expect(row).toBeVisible();
        await expect(row).toContainText('$9.99');
        await expect(row).toContainText(sub.category);
        await expect(row).toContainText('Monthly');
        await expect(row).toContainText(toDisplayDate(addMonths(today, 1)));

        // A subscription that starts today or earlier is charged for its first period immediately
        await searchExpenses(page, sub.description);
        const rows = expenseRows(page, sub.description);
        await expect(rows).toHaveCount(1);
        await expect(rows).toContainText(toDisplayDate(today));
    });

    test('Saves a Yearly subscription and charges it immediately', async ({ page }) => {
        const today = new Date();
        const stamp = Date.now();
        const sub: SubscriptionInput = {
            date: today,
            description: `Yearly Sub ${String(stamp)}`,
            amount: '199.00',
            category: 'Insurance',
            interval: 'Y',
        };

        const dialog = await openExpenseForm(page);
        await fillSubscriptionForm(dialog, page, sub);
        await submitExpenseForm(dialog);

        await searchSubscriptions(page, sub.description);
        const row = subscriptionRow(page, sub.description);
        await expect(row).toBeVisible();
        await expect(row).toContainText('$199.00');
        await expect(row).toContainText(sub.category);
        await expect(row).toContainText('Yearly');
        await expect(row).toContainText(toDisplayDate(addYears(today, 1)));

        await searchExpenses(page, sub.description);
        const rows = expenseRows(page, sub.description);
        await expect(rows).toHaveCount(1);
        await expect(rows).toContainText(toDisplayDate(today));
    });

    test('Backfills an expense for every month a Monthly subscription missed', async ({ page }) => {
        const today = new Date();
        const start = addMonths(today, -2);
        const stamp = Date.now();
        const sub: SubscriptionInput = {
            date: start,
            description: `Monthly Backfill ${String(stamp)}`,
            amount: '45.00',
            category: 'Gym',
            interval: 'M',
        };

        const dialog = await openExpenseForm(page);
        await fillSubscriptionForm(dialog, page, sub);
        await submitExpenseForm(dialog);

        // Next charge skips past every backfilled month, landing one month after today
        await searchSubscriptions(page, sub.description);
        const row = subscriptionRow(page, sub.description);
        await expect(row).toBeVisible();
        await expect(row).toContainText(toDisplayDate(addMonths(start, 3)));

        // One expense per missed month: the start month, the month after, and today
        await searchExpenses(page, sub.description);
        const rows = expenseRows(page, sub.description);
        await expect(rows).toHaveCount(3);
        for (const chargeDate of [start, addMonths(start, 1), addMonths(start, 2)]) {
            await expect(rows.filter({ hasText: toDisplayDate(chargeDate) })).toHaveCount(1);
        }
    });

    test('Backfills an expense for every year a Yearly subscription missed', async ({ page }) => {
        const today = new Date();
        const start = addYears(today, -1);
        const stamp = Date.now();
        const sub: SubscriptionInput = {
            date: start,
            description: `Yearly Backfill ${String(stamp)}`,
            amount: '120.00',
            category: 'Insurance',
            interval: 'Y',
        };

        const dialog = await openExpenseForm(page);
        await fillSubscriptionForm(dialog, page, sub);
        await submitExpenseForm(dialog);

        // Next charge skips past the backfilled year, landing one year after today
        await searchSubscriptions(page, sub.description);
        const row = subscriptionRow(page, sub.description);
        await expect(row).toBeVisible();
        await expect(row).toContainText(toDisplayDate(addYears(start, 2)));

        // One expense for the missed year and one for the current year
        await searchExpenses(page, sub.description);
        const rows = expenseRows(page, sub.description);
        await expect(rows).toHaveCount(2);
        for (const chargeDate of [start, addYears(start, 1)]) {
            await expect(rows.filter({ hasText: toDisplayDate(chargeDate) })).toHaveCount(1);
        }
    });

    test('Requires an interval to be selected when Subscription is checked', async ({ page }) => {
        const dialog = await openExpenseForm(page);
        await fillDate(dialog, page, toDatePickerDigits(new Date()));
        await dialog.getByLabel('Description').fill('Interval required test');
        await dialog.getByLabel('Amount').fill('5.00');
        await selectCategory(dialog, page, 'Entertainment');
        await dialog.getByRole('checkbox', { name: 'Subscription' }).check();

        await dialog.getByRole('button', { name: 'Track' }).click();
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('Please select an interval')).toBeVisible();

        // Selecting an interval allows the save to go through
        await dialog.getByRole('radio', { name: 'Monthly' }).check();
        await submitExpenseForm(dialog);
    });
});
