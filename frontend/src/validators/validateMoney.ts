/**
 * Validate the textField is valid money
 */
export const validateMoney = (value: string | null): string | null => {
    if (!value) return 'Field is required';

    const trimmed = value.trim();

    // Regex ensures valid number with up to 2 decimals
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
        return 'Enter a valid amount with up to 2 decimal places';
    }

    const num = Number(trimmed);
    if (num < 0) return 'Enter a positive amount';
    return null;
};
