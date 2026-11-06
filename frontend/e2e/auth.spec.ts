import { expect, test } from '@playwright/test';

import {
    ADMIN_USER,
    BASE_PATH,
    HOME_URL,
    login,
    logout,
    NORMAL_USER,
    sessionRestores,
    submitLogin,
    UNKNOWN_USER,
} from './helpers';

test.describe('Unauthenticated access', () => {
    test('Redirects away from the dashboard', async ({ page }) => {
        await page.goto(`${BASE_PATH}/dashboard`);
        await expect(page).toHaveURL(HOME_URL);
    });

    test('Redirects away from the admin area', async ({ page }) => {
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

    test('Without "Remember me" the session ends when the page is reloaded', async ({ page }) => {
        await submitLogin(page, NORMAL_USER.email, NORMAL_USER.password, { rememberMe: false });
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);

        // No refresh token cookie was set, so the in-memory session can't be restored
        await page.reload();
        await expect(page).toHaveURL(HOME_URL);
        await expect(page.getByRole('banner').getByRole('button', { name: 'Log In', exact: true })).toBeVisible();
    });

    test('A logged in user visiting home is offered the dashboard, not login or register', async ({ page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);

        await page.goto(`${BASE_PATH}/`);
        const banner = page.getByRole('banner');
        await expect(banner.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible();
        await expect(banner.getByRole('button', { name: 'Log In', exact: true })).toBeHidden();
        await expect(banner.getByRole('button', { name: 'Register', exact: true })).toBeHidden();
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

    test('Revokes the refresh token server side, so a copy of the session no longer works', async ({
        browser,
        context,
        page,
    }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        const beforeLogout = await browser.newContext({ storageState: await context.storageState() });

        try {
            await logout(page);

            // Replay the cookies captured before logout - the server must reject that refresh token now
            // (the remembered-session test below shows the same replay works while the session is live)
            expect(await sessionRestores(browser, beforeLogout)).toBe(false);
        } finally {
            await beforeLogout.close();
        }
    });
});

test.describe('Remembered session', () => {
    test('Restores from the refresh token cookie in a new browser context', async ({ browser, context, page }) => {
        await login(page, NORMAL_USER.email, NORMAL_USER.password);
        expect(await sessionRestores(browser, context)).toBe(true);
    });
});
