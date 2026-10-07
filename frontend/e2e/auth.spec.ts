import { expect, type Page, test } from '@playwright/test';

import { ADMIN_USER, BASE_PATH, HOME_URL, login, NORMAL_USER, submitLogin, UNKNOWN_USER } from './helpers';

async function logout(page: Page) {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(HOME_URL);
}

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
