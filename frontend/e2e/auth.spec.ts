import { expect, type Page, test } from '@playwright/test';

import { ADMIN_USER, BASE_PATH, HOME_URL, NORMAL_USER, UNKNOWN_USER } from './helpers';

async function openLoginDialog(page: Page) {
    await page.goto(`${BASE_PATH}/`);
    // The navbar and the hero section both render a "Log In" button - scope to the navbar
    await page.getByRole('banner').getByRole('button', { name: 'Log In', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * Fills out and submits the login dialog, checking "Remember me" so the
 * refresh token cookie is set and the session survives a page reload/navigation.
 * Does not wait for the outcome - use `login` for the happy path, or this
 * directly when asserting on a failed login attempt.
 */
async function submitLogin(page: Page, email: string, password: string) {
    await openLoginDialog(page);

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Password').fill(password);
    await dialog.getByRole('checkbox', { name: 'Remember me' }).check();
    await dialog.getByRole('button', { name: 'Log In' }).click();
}

/**
 * Logs in via the login dialog and waits for the app to redirect to the
 * dashboard, so the session is fully established before the caller continues.
 */
async function login(page: Page, email: string, password: string) {
    await submitLogin(page, email, password);
    await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
}

async function logout(page: Page) {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(HOME_URL);
}

test.describe('Unauthenticated access', () => {
    test('redirects away from the dashboard', async ({ page }) => {
        await page.goto(`${BASE_PATH}/dashboard`);
        await expect(page).toHaveURL(HOME_URL);
    });

    test('redirects away from the admin area', async ({ page }) => {
        await page.goto(`${BASE_PATH}/admin`);
        await expect(page).toHaveURL(HOME_URL);
    });
});

test.describe('Login', () => {
    test('Rejects invalid credentials and stays logged out', async ({ page }) => {
        await submitLogin(page, UNKNOWN_USER.email, UNKNOWN_USER.password);

        await expect(page.getByRole('alert')).toBeVisible();
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page).toHaveURL(HOME_URL);

        // Protected routes remain blocked
        await page.goto(`${BASE_PATH}/dashboard`);
        await expect(page).toHaveURL(HOME_URL);
    });

    test('Logs in a valid user and redirects to the dashboard', async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);

        // Session persists across a reload
        await page.reload();
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
    });

    test('Logs in a valid admin and redirects to the dashboard', async ({ page }) => {
        await login(page, ADMIN_USER.email, ADMIN_USER.password);
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
    });
});

test.describe('Authorization', () => {
    test('A normal user can reach the dashboard but not the admin area', async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);

        await page.goto(`${BASE_PATH}/admin`);
        await expect(page).toHaveURL(`${BASE_PATH}/unauthorized`);
        await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    });

    test('An admin can reach the admin area', async ({ page }) => {
        await login(page, ADMIN_USER.email, ADMIN_USER.password);

        await page.goto(`${BASE_PATH}/admin`);
        await expect(page).toHaveURL(`${BASE_PATH}/admin`);
    });
});

test.describe('Logout', () => {
    test('Logs out and blocks access to protected routes again', async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);

        await logout(page);

        await page.goto(`${BASE_PATH}/dashboard`);
        await expect(page).toHaveURL(HOME_URL);
    });
});
