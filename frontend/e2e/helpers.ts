import { expect, type Locator, type Page } from '@playwright/test';

/**
 * App is served under this basename
 */
export const BASE_PATH = '/spendingtracker';

/**
 * Seeded dev users
 */
export const NORMAL_USER = { email: 'test2@gmail.com', password: 'mypassword' };
export const ADMIN_USER = { email: 'test1@gmail.com', password: 'mypassword' };

/**
 * User with an unknown email
 */
export const UNKNOWN_USER = { email: 'no-such-user@gmail.com', password: 'wrongpassword1' };

/**
 * Matches the home route with or without a trailing slash
 */
export const HOME_URL = new RegExp(`${BASE_PATH}/?$`);

/**
 * Opens the login dialog from the home page.
 * The navbar and the hero section both render a "Log In" button - scope to the navbar
 */
async function openLoginDialog(page: Page) {
    await page.goto(`${BASE_PATH}/`);
    await page.getByRole('banner').getByRole('button', { name: 'Log In', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Fills out and submits the login dialog, checking "Remember me" so the
 * refresh token cookie is set and the session survives a page reload/navigation
 */
export async function submitLogin(page: Page, email: string, password: string) {
    await openLoginDialog(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Password').fill(password);
    await dialog.getByRole('checkbox', { name: 'Remember me' }).check();
    await dialog.getByRole('button', { name: 'Log In' }).click();
}

/**
 * Logs in via the login dialog and waits for the app to redirect to the
 * dashboard, so the session is fully established before the caller continues
 */
export async function login(page: Page, email: string, password: string) {
    await submitLogin(page, email, password);
    await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
}

/**
 * Escapes regex special characters so arbitrary text can be used inside a `new RegExp(...)`.
 */
export function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Opens the "Track Expense" dialog from the dashboard navbar
 * Used for both plain expenses and subscriptions - the subscription checkbox
 * inside the same form is what turns a "Track Expense" submission into one
 */
export async function openExpenseForm(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'Track Expense' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
}

/**
 * Types a date into the DatePicker's segmented Month/Day/Year field
 * Clicking the Month section first ensures typing starts from a known section,
 * since clicking the field's center can land on a different section
 * @param digits MMDDYYYY, no separators - e.g. "01152026" for Jan 15, 2026
 */
export async function fillDate(dialog: Locator, page: Page, digits: string) {
    await dialog.getByRole('spinbutton', { name: 'Month' }).click();
    await page.keyboard.type(digits, { delay: 60 });
}

/**
 * Selects an existing category from the autocomplete dropdown
 */
export async function selectCategory(dialog: Locator, page: Page, category: string) {
    const categoryInput = dialog.getByRole('combobox', { name: 'Category' });
    await categoryInput.click();
    await categoryInput.fill(category);
    await page.getByRole('option', { name: category, exact: true }).click();
}

/**
 * Submits the form and waits for the dialog to close, which only happens
 * once the save request succeeds - so this doubles as the save assertion
 */
export async function submitExpenseForm(dialog: Locator) {
    await dialog.getByRole('button', { name: 'Track' }).click();
    await expect(dialog).toBeHidden();
}

/**
 * The dashboard also renders a Subscription List grid with an identical search box,
 * so every lookup is scoped to the Expense List grid specifically
 */
export function expenseListGrid(page: Page): Locator {
    return page.locator('.MuiDataGrid-root').filter({ hasText: 'Expense List' });
}

export async function searchExpenses(page: Page, query: string) {
    await expenseListGrid(page).getByRole('searchbox').fill(query);
}

export function expenseRow(page: Page, description: string): Locator {
    return expenseListGrid(page).getByRole('row', { name: new RegExp(escapeRegExp(description)) });
}

/**
 * Formats a Date as the 8-digit MMDDYYYY string `fillDate` expects.
 * Uses local date parts throughout (never toISOString, which is UTC and can
 * land on the wrong day depending on the runner's timezone/time-of-day)
 */
export function toDatePickerDigits(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}${dd}${date.getFullYear()}`;
}

/**
 * Formats a Date as the MM/DD/YYYY string the grids display
 */
export function toDisplayDate(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${mm}/${dd}/${date.getFullYear()}`;
}

/**
 * Formats a Date as the YYYY-MM-DD `data-day` attribute used by the custom
 * date-range calendar's day cells
 */
function toCalendarDay(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${mm}-${dd}`;
}

function monthsBetween(a: Date, b: Date): number {
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

async function openDateRangePicker(page: Page) {
    await page.getByRole('button', { name: 'Select date range' }).click();
}

/**
 * Clicks the calendar's month navigation buttons until the target month is on screen
 */
async function navigateCalendarToMonth(page: Page, target: Date) {
    for (let i = 0; i < 30; i++) {
        const captionText = await page.locator('.rdp-caption_label').first().innerText();
        const displayed = new Date(`${captionText} 1`);
        const diff = monthsBetween(displayed, target);
        if (diff === 0) return;
        const buttonName = diff > 0 ? 'Go to the Next Month' : 'Go to the Previous Month';
        await page.getByRole('button', { name: buttonName }).click();
    }
    throw new Error(`Could not navigate the date range calendar to ${target.toDateString()}`);
}

async function pickCalendarDay(page: Page, date: Date) {
    await navigateCalendarToMonth(page, date);
    await page.locator(`[data-day="${toCalendarDay(date)}"] .rdp-day_button`).click();
}

/**
 * Sets the dashboard's active date range to one of the picker's preset buttons
 * (e.g. "This Month", "This Year") - entries created by a test are filtered
 * out of the grids/widgets once they fall outside the active range
 */
export async function setDateRangePreset(page: Page, label: string) {
    await openDateRangePicker(page);
    await page.getByRole('button', { name: label, exact: true }).click();
}

/**
 * Sets a custom date range by navigating the calendar's month view and clicking
 * the start and end days directly - there's no faster way to reach a date outside
 * the visible months, since the picker offers no month/year dropdown
 */
export async function setCustomDateRange(page: Page, start: Date, end: Date) {
    await openDateRangePicker(page);
    await pickCalendarDay(page, start);
    await pickCalendarDay(page, end);
    await page.getByRole('button', { name: 'Done' }).click();
}

/**
 * Parses a formatted currency string (e.g. "-$1,234.56") into a number
 */
export function parseCurrency(text: string): number {
    const negative = text.trim().startsWith('-');
    const numeric = Number(text.replace(/[^0-9.]/g, ''));
    return negative ? -numeric : numeric;
}
