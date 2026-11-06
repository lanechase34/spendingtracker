/**
 * Validate the textField is valid money
 * @allowZero - accept $0 (e.g. income fields), otherwise the amount must be greater than zero
 */
export const validateMoney = (
    value: string | null,
    { allowZero = false }: { allowZero?: boolean } = {}
): string | null => {
    if (value === null || value === '') return 'Field is required';

    const trimmed = value.trim();

    // Regex ensures valid number with up to 2 decimals
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
        return 'Enter a valid amount with up to 2 decimal places';
    }

    const num = Number(trimmed);
    if (!allowZero && num <= 0) return 'Enter a positive amount greater than zero';
    return null;
};

/**
 * Validate the textField is valid money, allowing $0
 */
export const validateNonNegativeMoney = (value: string | null): string | null =>
    validateMoney(value, { allowZero: true });
