import { expect, test } from '@playwright/test';

import { BASE_PATH, E2E_PASSWORD, HOME_URL, login, registerVerifiedUser, sessionRestores } from './helpers';

test.describe('Changing password', () => {
    // Registers its own account, so this is slower than the other specs
    test.slow();

    test('Needs the current password, then revokes every existing session', async ({ browser, context, page }) => {
        const { email } = await registerVerifiedUser(page);
        const newPassword = 'e2enewpassword456';

        // A copy of this session, e.g. the same account open on another device
        const otherDevice = await browser.newContext({ storageState: await context.storageState() });

        try {
            await page.getByRole('button', { name: 'Account menu' }).click();
            await page.getByRole('menuitem', { name: 'Settings' }).click();
            const settings = page.getByRole('dialog', { name: 'Settings' });

            await settings.getByLabel('Change Password').fill(newPassword);
            await settings.getByLabel('Confirm New Password').fill(newPassword);

            // The wrong current password is rejected and nothing changes
            await settings.getByLabel('Current Password').fill('not-my-password');
            await settings.getByRole('button', { name: 'Save' }).click();
            await expect(page.getByText('Current password is incorrect.')).toBeVisible();
            await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);

            await settings.getByLabel('Current Password').fill(E2E_PASSWORD);
            await settings.getByRole('button', { name: 'Save' }).click();

            // This session is logged out...
            await expect(page.getByText('Password updated. Please log in again.')).toBeVisible();
            await expect(page).toHaveURL(HOME_URL);

            // ...and the server rejects the tokens of every session from before the change
            expect(await sessionRestores(browser, otherDevice)).toBe(false);

            // The new password works
            // (the old one isn't checked - the dev backend's impersonation flag accepts any password at login)
            await login(page, email, newPassword);
        } finally {
            await otherDevice.close();
        }
    });
});
