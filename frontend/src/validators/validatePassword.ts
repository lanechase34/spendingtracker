/**
 * Validate the password textField
 */
export const validatePassword = (value: string): string | null => {
    if (!value.trim() || value.trim().length < 10) return 'Please enter a valid password';
    return null;
};
