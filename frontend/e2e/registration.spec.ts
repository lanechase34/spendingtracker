import { expect, test } from '@playwright/test';

import {
    BASE_PATH,
    E2E_PASSWORD,
    expectNoEmailTo,
    HOME_URL,
    login,
    NORMAL_USER,
    readVerificationCode,
    snapshotTestEmails,
    submitLogin,
    submitRegistration,
    uniqueEmail,
    verifyDialog,
} from './helpers';

test.describe('Registration', () => {
    test('Registers a new account and verifies it with the emailed code', async ({ page }) => {
        const email = uniqueEmail();
        const inbox = await snapshotTestEmails();

        // Register dialog swaps for the verify dialog
        const dialog = await submitRegistration(page, email, E2E_PASSWORD);
        const code = await readVerificationCode(email, inbox);

        // A wrong code is rejected and leaves the user unverified
        const codeInput = dialog.getByLabel('Verification Code');
        await codeInput.fill(code === 'AAAAAAAA' ? 'BBBBBBBB' : 'AAAAAAAA');
        await dialog.getByRole('button', { name: 'Verify', exact: true }).click();
        // The dialog's instructions are also an alert - the error is the other one
        await expect(dialog.getByRole('alert').filter({ hasNotText: 'Check your email' })).toBeVisible();
        await expect(page).toHaveURL(HOME_URL);

        // Lowercase with spaces, as if pasted from the email - the dialog normalizes it
        await codeInput.fill(` ${code.slice(0, 4).toLowerCase()} ${code.slice(4).toLowerCase()} `);
        await dialog.getByRole('button', { name: 'Verify', exact: true }).click();

        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);

        // The account is verified - a fresh login goes straight to the dashboard
        await page.context().clearCookies();
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await login(page, email, E2E_PASSWORD);
    });

    test('An unverified account is kept off the dashboard and sent to verify when it logs in', async ({
        browser,
        page,
    }) => {
        const email = uniqueEmail();
        const inbox = await snapshotTestEmails();

        // Register, then walk away without verifying
        const registerDialog = await submitRegistration(page, email, E2E_PASSWORD);
        const code = await readVerificationCode(email, inbox);
        await registerDialog.getByRole('button', { name: 'close' }).click();
        await expect(registerDialog).toBeHidden();

        await page.goto(`${BASE_PATH}/dashboard`);
        await expect(page).toHaveURL(HOME_URL);

        // Come back on another device - a fresh context, so none of the first one's state carries over
        const otherDevice = await browser.newContext();
        try {
            const otherPage = await otherDevice.newPage();
            await submitLogin(otherPage, email, E2E_PASSWORD);

            // Logging in unverified opens the verify dialog instead of the dashboard
            const dialog = verifyDialog(otherPage);
            await expect(dialog).toBeVisible();
            await expect(otherPage).toHaveURL(HOME_URL);

            // Login doesn't email a code, so resend is offered straight away - but the server still
            // enforces the cooldown from the registration email
            await dialog.getByRole('button', { name: 'Resend verification code' }).click();
            await expect(dialog.getByText('Please wait before requesting another verification email.')).toBeVisible();

            // The code from the registration email still works
            await dialog.getByLabel('Verification Code').fill(code);
            await dialog.getByRole('button', { name: 'Verify', exact: true }).click();
            await expect(dialog).toBeHidden();
            await expect(otherPage).toHaveURL(`${BASE_PATH}/dashboard`);
        } finally {
            await otherDevice.close();
        }
    });

    test("Registering an email that's already verified looks the same, but sends no email", async ({ page }) => {
        const inbox = await snapshotTestEmails();

        // Same response as a new account (straight to the verify dialog), so registration
        // can't be used to find which emails exist
        await submitRegistration(page, NORMAL_USER.email, 'someone-elses-password');
        await expect(verifyDialog(page)).toBeVisible();

        await expectNoEmailTo(NORMAL_USER.email, inbox);
    });
});
