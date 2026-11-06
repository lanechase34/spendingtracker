/**
 * Validates a 6-digit TOTP code
 */
export function validateTOTPCode(value: string): string | null {
    if (!value.length) return 'Please enter the 6-digit code.';
    if (!/^\d{6}$/.test(value)) return 'Code must be exactly 6 digits.';
    return null;
}

/**
 * Normalize an entered 2FA code before validating / sending
 * Strips whitespace (e.g. "123 456" or a pasted code with spaces) and lowercases,
 * recovery codes are lowercase and the backend matches them case-sensitively
 */
export function normalize2FACode(value: string): string {
    return value.replace(/\s+/g, '').toLowerCase();
}

/**
 * Validates a 2FA code - accepts either a 6-digit TOTP code or a recovery code
 * in the format xxxx-xxxx-xxxx-xxxx
 * The value is normalized first (see normalize2FACode), send the normalized value
 */
export function validate2FACode(rawValue: string): string | null {
    const value = normalize2FACode(rawValue);
    if (!value.length) return 'Please enter your code.';
    const isTOTP = /^\d{6}$/.test(value);
    const isRecovery = /^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(value);
    if (!isTOTP && !isRecovery) return 'Enter a 6-digit code or recovery code (xxxx-xxxx-xxxx-xxxx).';
    return null;
}
