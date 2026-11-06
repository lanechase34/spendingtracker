import { expect, type Locator, type Page, test } from '@playwright/test';

import {
    BASE_PATH,
    generateTOTP,
    HOME_URL,
    logout,
    registerVerifiedUser,
    sessionRestores,
    submitLogin,
} from './helpers';

const RECOVERY_CODE = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/;

/**
 * Opens the Settings dialog from the account menu
 */
async function openSettings(page: Page): Promise<Locator> {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    return settings;
}

/**
 * The Settings dialog's 2FA status line
 */
function twoFactorStatus(settings: Locator): Locator {
    return settings.getByText(/^(Enabled|Disabled) - /);
}

/**
 * Enables 2FA from Settings the way a user would - reads the manual-entry secret off the setup
 * dialog in place of scanning the QR code, and keeps one of the recovery codes it shows
 * Leaves the Settings dialog open
 */
async function enable2FA(page: Page): Promise<{ settings: Locator; secret: string; recoveryCode: string }> {
    const settings = await openSettings(page);
    await expect(twoFactorStatus(settings)).toContainText('Disabled');
    await settings.getByRole('button', { name: 'Enable', exact: true }).click();

    const setup = page.getByRole('dialog', { name: 'Set Up Two-Factor Authentication' });
    await expect(setup.getByRole('img', { name: 'QR code for authenticator app' })).toBeVisible();
    const secret = (await setup.getByText(/^[A-Z2-7]+=*$/).innerText()).trim();

    // A wrong code doesn't enable 2FA
    const codeInput = setup.getByLabel('6-Digit Code');
    await codeInput.fill(generateTOTP(secret) === '000000' ? '111111' : '000000');
    await setup.getByRole('button', { name: 'Verify & Enable' }).click();
    await expect(setup.getByRole('alert')).toBeVisible();

    await codeInput.fill(generateTOTP(secret));
    await setup.getByRole('button', { name: 'Verify & Enable' }).click();

    // Recovery codes are shown once, and Done stays disabled until they're acknowledged
    const recovery = page.getByRole('dialog', { name: 'Save Your Recovery Codes' });
    const codes = recovery.getByText(RECOVERY_CODE);
    await expect(codes).toHaveCount(8);
    const [recoveryCode] = await codes.allInnerTexts();
    if (recoveryCode === undefined) throw new Error('No recovery codes were shown');

    const done = recovery.getByRole('button', { name: 'Done' });
    await expect(done).toBeDisabled();
    await recovery.getByRole('checkbox', { name: 'I have saved my recovery codes in a safe place.' }).check();
    await done.click();
    await expect(recovery).toBeHidden();

    await expect(twoFactorStatus(settings)).toContainText('Enabled');
    return { settings, secret, recoveryCode };
}

async function closeSettings(settings: Locator) {
    await settings.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(settings).toBeHidden();
}

/**
 * Submits the login form and waits for the 2FA prompt instead of the dashboard
 */
async function loginTo2FAPrompt(page: Page, email: string, password: string): Promise<Locator> {
    await submitLogin(page, email, password);
    const prompt = page.getByRole('dialog', { name: 'Two-Factor Authentication' });
    await expect(prompt).toBeVisible();
    await expect(page).toHaveURL(HOME_URL);
    return prompt;
}

async function submit2FACode(prompt: Locator, code: string) {
    await prompt.getByLabel('Authentication Code').fill(code);
    await prompt.getByRole('button', { name: 'Verify', exact: true }).click();
}

test.describe('Two-factor authentication', () => {
    // Each test registers its own account, so this is slower than the other specs
    test.slow();

    test('Enabling 2FA requires an authenticator code on login, and disabling it removes the prompt', async ({
        page,
    }) => {
        const { email, password } = await registerVerifiedUser(page);
        const { settings, secret } = await enable2FA(page);
        await closeSettings(settings);
        await logout(page);

        // The password alone no longer gets in - a wrong code is rejected
        const prompt = await loginTo2FAPrompt(page, email, password);
        await submit2FACode(prompt, generateTOTP(secret) === '000000' ? '111111' : '000000');
        await expect(prompt.getByRole('alert')).toBeVisible();
        await expect(page).toHaveURL(HOME_URL);

        await submit2FACode(prompt, generateTOTP(secret));
        await expect(prompt).toBeHidden();
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);

        // "Remember me" carries through 2FA - the session survives a reload without another code
        await page.reload();
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
        await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

        // Disabling needs a current code too
        const disableSettings = await openSettings(page);
        await disableSettings.getByRole('button', { name: 'Disable', exact: true }).click();
        const disable = page.getByRole('dialog', { name: 'Disable Two-Factor Authentication' });
        await disable.getByLabel('Authentication Code').fill(generateTOTP(secret));
        await disable.getByRole('button', { name: 'Disable 2FA' }).click();
        await expect(disable).toBeHidden();
        await expect(twoFactorStatus(disableSettings)).toContainText('Disabled');
        await closeSettings(disableSettings);
        await logout(page);

        // Back to a password-only login
        await submitLogin(page, email, password);
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
    });

    test('A password-only login waiting on the 2FA prompt gets no access', async ({ browser, context, page }) => {
        const { email, password } = await registerVerifiedUser(page);
        const { settings } = await enable2FA(page);
        await closeSettings(settings);
        await logout(page);

        await loginTo2FAPrompt(page, email, password);

        // No session is issued until the code is entered - not in this tab...
        await page.goto(`${BASE_PATH}/dashboard`);
        await expect(page).toHaveURL(HOME_URL);
        await expect(page.getByRole('dialog', { name: 'Two-Factor Authentication' })).toBeHidden();

        // ...and nothing a copy of the browser state could restore
        expect(await sessionRestores(browser, context)).toBe(false);
    });

    test('A recovery code logs in in place of the authenticator code, but only once', async ({ page }) => {
        const { email, password } = await registerVerifiedUser(page);
        const { settings, recoveryCode } = await enable2FA(page);
        await closeSettings(settings);
        await logout(page);

        // Uppercase, as if typed from a printout - the dialog normalizes it
        const prompt = await loginTo2FAPrompt(page, email, password);
        await submit2FACode(prompt, recoveryCode.toUpperCase());
        await expect(prompt).toBeHidden();
        await expect(page).toHaveURL(`${BASE_PATH}/dashboard`);
        await logout(page);

        // The code was consumed
        const retryPrompt = await loginTo2FAPrompt(page, email, password);
        await submit2FACode(retryPrompt, recoveryCode);
        await expect(retryPrompt.getByRole('alert')).toBeVisible();
        await expect(page).toHaveURL(HOME_URL);
    });
});
