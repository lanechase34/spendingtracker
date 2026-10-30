import { expect, type Locator, type Page, test } from '@playwright/test';

import { login, NORMAL_USER, openIncomeForm, readCardAmount, setCustomDateRange } from './helpers';

/**
 * Every test works in a month three months back so it never collides with income.spec.ts,
 * which edits the current month and can run in parallel with this file
 */
const now = new Date();
const TARGET_MONTH = new Date(now.getFullYear(), now.getMonth() - 3, 1);
const TARGET_MONTH_END = new Date(TARGET_MONTH.getFullYear(), TARGET_MONTH.getMonth() + 1, 0);
const PREVIOUS_MONTH = new Date(TARGET_MONTH.getFullYear(), TARGET_MONTH.getMonth() - 1, 1);
const NEXT_MONTH = new Date(TARGET_MONTH.getFullYear(), TARGET_MONTH.getMonth() + 1, 1);

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * MMDDYYYY digits for a day in the target month, as the date picker field expects them typed
 */
const dayDigits = (day: number, month: Date = TARGET_MONTH) =>
    `${pad(month.getMonth() + 1)}${pad(day)}${String(month.getFullYear())}`;

/**
 * How the entry list displays a day in the target month, e.g. "Jul 5, 2026"
 */
const displayDay = (day: number) =>
    new Date(TARGET_MONTH.getFullYear(), TARGET_MONTH.getMonth(), day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

const SAVE_FAILED = 'Some changes could not be saved. Please try again.';

/**
 * Dialog locators
 */
const payInput = (dialog: Locator) => dialog.getByLabel('Pay');
const extraTotal = (dialog: Locator) => dialog.getByLabel('Extra', { exact: true });
const entryRows = (dialog: Locator) => dialog.getByRole('list', { name: 'extra income entries' }).getByRole('listitem');
const entryRow = (dialog: Locator, description: string) => entryRows(dialog).filter({ hasText: description });
const updateButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Update' });
const addButton = (dialog: Locator) => dialog.getByRole('button', { name: 'Add', exact: true });
const dateField = (dialog: Locator, label: string) => dialog.getByRole('group', { name: label });
// Scoped to the footer, an error alert in the dialog has its own "Close" button
const closeButton = (dialog: Locator) =>
    dialog.locator('.MuiDialogActions-root').getByRole('button', { name: 'Close', exact: true });

/**
 * Wait for both the income and the extra income fetches to finish
 */
async function waitForLoaded(dialog: Locator) {
    await expect(payInput(dialog)).toBeEnabled();
    await expect(extraTotal(dialog)).toBeEnabled();
}

async function openLoadedIncomeForm(page: Page): Promise<Locator> {
    const dialog = await openIncomeForm(page);
    await waitForLoaded(dialog);
    return dialog;
}

/**
 * Types MMDDYYYY (or MMYYYY for the month picker) into a picker field, starting from its Month section
 */
async function typeDate(dialog: Locator, page: Page, label: string, digits: string) {
    await dateField(dialog, label).getByRole('spinbutton', { name: 'Month' }).click();
    await page.keyboard.type(digits, { delay: 60 });
}

/**
 * Move the month picker back one month
 * Its Month section shows month names, so step it with the arrow keys rather than typing
 */
async function stepMonthBack(dialog: Locator, page: Page) {
    const monthField = dateField(dialog, 'Month');
    await monthField.getByRole('spinbutton', { name: 'Month' }).click();
    await page.keyboard.press('ArrowDown');
    if (PREVIOUS_MONTH.getFullYear() !== TARGET_MONTH.getFullYear()) {
        await monthField.getByRole('spinbutton', { name: 'Year' }).click();
        await page.keyboard.press('ArrowDown');
    }
}

interface EntryInput {
    day?: number;
    amount: string;
    description: string;
}

/**
 * Stage a new extra income entry, optionally on a specific day of the target month
 */
async function stageEntry(dialog: Locator, page: Page, entry: EntryInput) {
    if (entry.day !== undefined) {
        await typeDate(dialog, page, 'Date Received', dayDigits(entry.day));
    }
    await dialog.getByLabel('Amount').fill(entry.amount);
    await dialog.getByLabel('Description').fill(entry.description);
    await addButton(dialog).click();
    await expect(entryRow(dialog, entry.description)).toBeVisible();
}

/**
 * Stage removal of every saved entry in the month
 */
async function stageRemoveAll(dialog: Locator) {
    const deleteButtons = dialog.getByRole('button', { name: /^delete / });
    while ((await deleteButtons.count()) > 0) {
        await deleteButtons.first().click();
    }
    await expect(extraTotal(dialog)).toHaveValue('0.00');
}

async function submit(dialog: Locator) {
    await updateButton(dialog).click();
    await expect(dialog).toBeHidden();
}

/**
 * Put the target month into a known state: the given pay and exactly the given saved entries
 */
async function seedMonth(page: Page, pay: string, entries: EntryInput[]) {
    const dialog = await openLoadedIncomeForm(page);
    await stageRemoveAll(dialog);
    await payInput(dialog).fill(pay);
    for (const entry of entries) {
        await stageEntry(dialog, page, entry);
    }

    if (await updateButton(dialog).isEnabled()) {
        await submit(dialog);
    } else {
        await closeButton(dialog).click();
        await expect(dialog).toBeHidden();
    }
}

/**
 * Record every income write request (method + path) made while the callback runs
 */
async function recordIncomeWrites(page: Page, action: () => Promise<void>): Promise<string[]> {
    const writes: string[] = [];
    const listener = (request: { method: () => string; url: () => string }) => {
        const url = new URL(request.url());
        if (request.method() !== 'GET' && url.pathname.includes('/api/v1/income')) {
            writes.push(`${request.method()} ${url.pathname.replace(/^.*\/api\/v1/, '')}`);
        }
    };
    page.on('request', listener);
    try {
        await action();
    } finally {
        page.off('request', listener);
    }
    return writes;
}

async function expectIncomeCard(page: Page, amount: number) {
    await expect(async () => {
        expect(await readCardAmount(page, 'Income')).toBeCloseTo(amount, 2);
    }).toPass();
}

test.describe('Edit Income dialog', () => {
    // Every test reads and rewrites the same month for the same user
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        await setCustomDateRange(page, TARGET_MONTH, TARGET_MONTH_END);
    });

    test('Opens on the dashboard month and closes from either close button but not escape', async ({ page }) => {
        const dialog = await openLoadedIncomeForm(page);

        const monthField = dateField(dialog, 'Month');
        await expect(monthField.getByRole('spinbutton', { name: 'Month' })).toHaveAttribute(
            'aria-valuenow',
            String(TARGET_MONTH.getMonth() + 1)
        );
        await expect(monthField.getByRole('spinbutton', { name: 'Year' })).toHaveAttribute(
            'aria-valuenow',
            String(TARGET_MONTH.getFullYear())
        );

        await page.keyboard.press('Escape');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: 'close', exact: true }).click();
        await expect(dialog).toBeHidden();

        const reopened = await openLoadedIncomeForm(page);
        await closeButton(reopened).click();
        await expect(reopened).toBeHidden();
    });

    test('Shows the saved pay, the extra total and every entry newest first', async ({ page }) => {
        await seedMonth(page, '2000', [
            { day: 5, amount: '100.50', description: 'E2E Early entry' },
            { day: 20, amount: '200', description: 'E2E Late entry' },
        ]);
        await expectIncomeCard(page, 2300.5);

        const dialog = await openLoadedIncomeForm(page);

        await expect(payInput(dialog)).toHaveValue('2000');
        await expect(extraTotal(dialog)).toHaveValue('300.50');
        await expect(extraTotal(dialog)).not.toBeEditable();

        await expect(entryRows(dialog)).toHaveCount(2);
        await expect(entryRows(dialog).nth(0)).toContainText('E2E Late entry');
        await expect(entryRows(dialog).nth(0)).toContainText(`${displayDay(20)} · $200.00`);
        await expect(entryRows(dialog).nth(1)).toContainText('E2E Early entry');
        await expect(entryRows(dialog).nth(1)).toContainText(`${displayDay(5)} · $100.50`);
        await expect(dialog.getByText('New', { exact: true })).toHaveCount(0);

        await expect(updateButton(dialog)).toBeDisabled();
    });

    test('Shows an empty state when the month has no extra income', async ({ page }) => {
        await seedMonth(page, '1500', []);

        const dialog = await openLoadedIncomeForm(page);

        await expect(dialog.getByText('No extra income this month')).toBeVisible();
        await expect(extraTotal(dialog)).toHaveValue('0.00');
        await expect(updateButton(dialog)).toBeDisabled();
    });

    test('Validates a new entry before adding it', async ({ page }) => {
        await seedMonth(page, '1500', []);
        const dialog = await openLoadedIncomeForm(page);

        // Entry date defaults to the first of a month that isn't the current one
        await expect(dateField(dialog, 'Date Received').getByRole('spinbutton', { name: 'Day' })).toHaveAttribute(
            'aria-valuenow',
            '1'
        );

        await addButton(dialog).click();
        await expect(dialog.getByText('Field is required')).toBeVisible();
        await expect(dialog.getByText('Description is required')).toBeVisible();

        await dialog.getByLabel('Description').fill('E2E Invalid entry');
        const invalidAmounts = [
            { amount: '12.345', message: 'Enter a valid amount with up to 2 decimal places' },
            { amount: '0', message: 'Enter a positive amount greater than zero' },
            { amount: 'abc', message: 'Enter a valid amount with up to 2 decimal places' },
        ];
        for (const { amount, message } of invalidAmounts) {
            await dialog.getByLabel('Amount').fill(amount);
            await addButton(dialog).click();
            await expect(dialog.getByText(message)).toBeVisible();
        }

        // A date outside the selected month is rejected
        await dialog.getByLabel('Amount').fill('10');
        await typeDate(dialog, page, 'Date Received', dayDigits(1, NEXT_MONTH));
        await expect(dialog.getByText('Please select a date within the selected month')).toBeVisible();
        await addButton(dialog).click();

        await expect(dialog.getByText('No extra income this month')).toBeVisible();
        await expect(updateButton(dialog)).toBeDisabled();
    });

    test('Stages adds and removals locally without saving until Update', async ({ page }) => {
        await seedMonth(page, '1500', [{ day: 10, amount: '50', description: 'E2E Saved entry' }]);

        const writes = await recordIncomeWrites(page, async () => {
            const dialog = await openLoadedIncomeForm(page);

            // Pressing Enter in the description adds the entry
            await dialog.getByLabel('Amount').fill('25.25');
            await dialog.getByLabel('Description').fill('E2E Staged entry');
            await dialog.getByLabel('Description').press('Enter');

            const staged = entryRow(dialog, 'E2E Staged entry');
            await expect(staged).toBeVisible();
            await expect(staged.getByText('New', { exact: true })).toBeVisible();
            await expect(extraTotal(dialog)).toHaveValue('75.25');
            await expect(dialog.getByLabel('Amount')).toHaveValue('');
            await expect(dialog.getByLabel('Description')).toHaveValue('');
            await expect(updateButton(dialog)).toBeEnabled();

            // Removing the staged entry leaves nothing to save
            await dialog.getByRole('button', { name: 'delete E2E Staged entry' }).click();
            await expect(staged).toHaveCount(0);
            await expect(extraTotal(dialog)).toHaveValue('50.00');
            await expect(updateButton(dialog)).toBeDisabled();

            // Removing a saved entry is staged too
            await dialog.getByRole('button', { name: 'delete E2E Saved entry' }).click();
            await expect(entryRow(dialog, 'E2E Saved entry')).toHaveCount(0);
            await expect(extraTotal(dialog)).toHaveValue('0.00');
            await expect(updateButton(dialog)).toBeEnabled();

            // Closing discards everything staged
            await closeButton(dialog).click();
            await expect(dialog).toBeHidden();

            const reopened = await openLoadedIncomeForm(page);
            await expect(entryRow(reopened, 'E2E Saved entry')).toBeVisible();
            await expect(extraTotal(reopened)).toHaveValue('50.00');
            await closeButton(reopened).click();
        });

        expect(writes).toEqual([]);
        await expectIncomeCard(page, 1550);
    });

    test('Sends only the request for what changed', async ({ page }) => {
        await seedMonth(page, '1500', [{ day: 10, amount: '50', description: 'E2E Existing entry' }]);

        // Pay only
        let writes = await recordIncomeWrites(page, async () => {
            const dialog = await openLoadedIncomeForm(page);
            await payInput(dialog).fill('1600');
            await submit(dialog);
        });
        expect(writes).toEqual(['PUT /income']);
        await expectIncomeCard(page, 1650);

        // New entry only - pay is untouched so it isn't resent
        writes = await recordIncomeWrites(page, async () => {
            const dialog = await openLoadedIncomeForm(page);
            await stageEntry(dialog, page, { day: 15, amount: '30', description: 'E2E Added entry' });
            await submit(dialog);
        });
        expect(writes).toEqual(['POST /income/extra']);
        await expectIncomeCard(page, 1680);

        // Removal only
        writes = await recordIncomeWrites(page, async () => {
            const dialog = await openLoadedIncomeForm(page);
            await dialog.getByRole('button', { name: 'delete E2E Existing entry' }).click();
            await submit(dialog);
        });
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatch(/^DELETE \/income\/extra\/\d+$/);
        await expectIncomeCard(page, 1630);
    });

    test('Saves pay, new entries and removals together and they persist', async ({ page }) => {
        await seedMonth(page, '1500', [
            { day: 3, amount: '40', description: 'E2E Remove me' },
            { day: 4, amount: '60', description: 'E2E Keep me' },
        ]);

        const dialog = await openLoadedIncomeForm(page);
        await payInput(dialog).fill('2500.75');
        await dialog.getByRole('button', { name: 'delete E2E Remove me' }).click();
        await stageEntry(dialog, page, { day: 25, amount: '99.99', description: 'E2E Bonus' });
        await stageEntry(dialog, page, { day: 12, amount: '0.01', description: 'E2E Penny' });
        await expect(extraTotal(dialog)).toHaveValue('160.00');
        await submit(dialog);

        // 2500.75 pay + 60 + 99.99 + 0.01 extra
        await expectIncomeCard(page, 2660.75);

        await page.reload();
        await expectIncomeCard(page, 2660.75);

        const reopened = await openLoadedIncomeForm(page);
        await expect(payInput(reopened)).toHaveValue('2500.75');
        await expect(extraTotal(reopened)).toHaveValue('160.00');
        await expect(entryRows(reopened)).toHaveCount(3);
        await expect(entryRows(reopened).nth(0)).toContainText('E2E Bonus');
        await expect(entryRows(reopened).nth(1)).toContainText('E2E Penny');
        await expect(entryRows(reopened).nth(2)).toContainText('E2E Keep me');
        await expect(entryRow(reopened, 'E2E Remove me')).toHaveCount(0);
        await expect(reopened.getByText('New', { exact: true })).toHaveCount(0);
    });

    test('Requires a valid pay before saving', async ({ page }) => {
        await seedMonth(page, '1500', []);

        const writes = await recordIncomeWrites(page, async () => {
            const dialog = await openLoadedIncomeForm(page);

            await payInput(dialog).fill('');
            await updateButton(dialog).click();
            await expect(dialog.getByText('Field is required')).toBeVisible();

            await payInput(dialog).fill('12.345');
            await updateButton(dialog).click();
            await expect(dialog.getByText('Enter a valid amount with up to 2 decimal places')).toBeVisible();

            await expect(dialog).toBeVisible();
            await closeButton(dialog).click();
        });

        expect(writes).toEqual([]);
    });

    test('Changing the month drops staged changes and loads that month', async ({ page }) => {
        await seedMonth(page, '1500', [{ day: 8, amount: '20', description: 'E2E Target month entry' }]);

        const dialog = await openLoadedIncomeForm(page);
        await payInput(dialog).fill('9999');
        await stageEntry(dialog, page, { amount: '5', description: 'E2E Staged before switch' });

        await stepMonthBack(dialog, page);
        await waitForLoaded(dialog);
        await expect(dialog.getByText('Failed to load income data')).toHaveCount(0);

        await expect(entryRow(dialog, 'E2E Staged before switch')).toHaveCount(0);
        await expect(entryRow(dialog, 'E2E Target month entry')).toHaveCount(0);
        await expect(payInput(dialog)).not.toHaveValue('9999');
        await expect(dateField(dialog, 'Date Received').getByRole('spinbutton', { name: 'Month' })).toHaveAttribute(
            'aria-valuenow',
            String(PREVIOUS_MONTH.getMonth() + 1)
        );
        await expect(updateButton(dialog)).toBeDisabled();

        await closeButton(dialog).click();
        await expectIncomeCard(page, 1520);
    });

    test('Keeps only the failed changes staged and retries just those', async ({ page }) => {
        await seedMonth(page, '1500', [{ day: 6, amount: '10', description: 'E2E Delete fails' }]);

        // Fail the POST for one entry and every DELETE
        await page.route('**/api/v1/income/extra', (route) =>
            route.request().method() === 'POST' && (route.request().postData() ?? '').includes('E2E Will fail')
                ? route.fulfill({ status: 500, json: { error: true, messages: ['Server error'] } })
                : route.fallback()
        );
        await page.route('**/api/v1/income/extra/*', (route) =>
            route.request().method() === 'DELETE'
                ? route.fulfill({ status: 500, json: { error: true, messages: ['Server error'] } })
                : route.fallback()
        );

        const dialog = await openLoadedIncomeForm(page);
        await payInput(dialog).fill('1700');
        await stageEntry(dialog, page, { day: 14, amount: '11', description: 'E2E Will save' });
        await stageEntry(dialog, page, { day: 15, amount: '22', description: 'E2E Will fail' });
        await dialog.getByRole('button', { name: 'delete E2E Delete fails' }).click();
        await updateButton(dialog).click();

        await expect(dialog.getByText(SAVE_FAILED)).toBeVisible();
        await expect(dialog).toBeVisible();

        // The saved entry is now a server row, the failed ones are still staged
        await expect(entryRow(dialog, 'E2E Will save')).toBeVisible();
        await expect(entryRow(dialog, 'E2E Will save').getByText('New', { exact: true })).toHaveCount(0);
        await expect(entryRow(dialog, 'E2E Will fail').getByText('New', { exact: true })).toBeVisible();
        await expect(entryRow(dialog, 'E2E Delete fails')).toHaveCount(0);
        await expect(payInput(dialog)).toHaveValue('1700');
        await expect(updateButton(dialog)).toBeEnabled();

        // Pay and "Will save" already landed
        await expectIncomeCard(page, 1721);

        // The error can be dismissed
        await dialog.getByRole('alert').getByRole('button', { name: 'Close' }).click();
        await expect(dialog.getByText(SAVE_FAILED)).toHaveCount(0);

        await page.unrouteAll({ behavior: 'wait' });

        const writes = await recordIncomeWrites(page, async () => {
            await submit(dialog);
        });
        expect(writes).toHaveLength(2);
        expect(writes).toContain('POST /income/extra');
        expect(writes.some((write) => /^DELETE \/income\/extra\/\d+$/.test(write))).toBe(true);

        // 1700 pay + 11 + 22
        await expectIncomeCard(page, 1733);

        const reopened = await openLoadedIncomeForm(page);
        await expect(entryRows(reopened)).toHaveCount(2);
        await expect(entryRow(reopened, 'E2E Delete fails')).toHaveCount(0);
    });

    test('Shows the error when a save request fails outright', async ({ page }) => {
        await seedMonth(page, '1500', []);
        await page.route('**/api/v1/income', (route) =>
            route.request().method() === 'PUT'
                ? route.fulfill({ status: 500, json: { error: true, messages: ['Server error'] } })
                : route.fallback()
        );

        const dialog = await openLoadedIncomeForm(page);
        await payInput(dialog).fill('1800');
        await updateButton(dialog).click();

        await expect(dialog.getByText(SAVE_FAILED)).toBeVisible();
        await expect(payInput(dialog)).toHaveValue('1800');
        await expect(updateButton(dialog)).toBeEnabled();
        await expectIncomeCard(page, 1500);
    });

    for (const [label, pattern] of [
        ['income', '**/api/v1/income?*'],
        ['extra income', '**/api/v1/income/extra?*'],
    ] as const) {
        test(`Shows a load error when the ${label} fetch fails`, async ({ page }) => {
            await page.route(pattern, (route) =>
                route.fulfill({ status: 500, json: { error: true, messages: ['Server error'] } })
            );

            const dialog = await openIncomeForm(page);

            await expect(dialog.getByText('Failed to load income data')).toBeVisible();
            await expect(updateButton(dialog)).toBeDisabled();
        });
    }
});
