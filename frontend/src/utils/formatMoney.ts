interface FormatMoneyOptions {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    /**
     * 'negative' (default): -$250, never -$0 for values that round to zero
     * 'exceptZero': +$250 / -$250 / $0, for showing a change
     */
    signDisplay?: 'negative' | 'exceptZero';
}

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats a dollar amount with the sign before the symbol (-$250), matching useCurrencyFormatter
 * Use this anywhere money is built into a string outside of React (chart callbacks, labels)
 */
export function formatMoney(
    value: number,
    { minimumFractionDigits = 0, maximumFractionDigits = 2, signDisplay = 'negative' }: FormatMoneyOptions = {}
): string {
    const min = Math.min(minimumFractionDigits, maximumFractionDigits);
    const key = `${String(min)}:${String(maximumFractionDigits)}:${signDisplay}`;

    let formatter = formatters.get(key);
    if (!formatter) {
        formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: min,
            maximumFractionDigits,
            signDisplay,
        });
        formatters.set(key, formatter);
    }

    return formatter.format(value);
}
