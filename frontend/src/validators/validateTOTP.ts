/**
 * Validates a 6-digit TOTP code
 */
export function validateTOTPCode(value: string): string | null {
    if (!value.length) return 'Please enter the 6-digit code.';
    if (!/^\d{6}$/.test(value)) return 'Code must be exactly 6 digits.';
    return null;
}

/**
 * Validates a 2FA code - accepts either a 6-digit TOTP code or a recovery code
 * in the format xxxx-xxxx-xxxx-xxxx
 */
export function validate2FACode(value: string): string | null {
    if (!value.length) return 'Please enter your code.';
    const isTOTP = /^\d{6}$/.test(value);
    const isRecovery = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(value);
    if (!isTOTP && !isRecovery) return 'Enter a 6-digit code or recovery code (xxxx-xxxx-xxxx-xxxx).';
    return null;
}
