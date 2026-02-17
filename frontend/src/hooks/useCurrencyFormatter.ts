import { useCallback,useMemo } from 'react';

interface CurrencyFormatter {
    locale?: string;
    currency?: string;
}

interface UseCurrencyFormatterReturn {
    formatCurrency: (amount: number) => string;
}
export default function useCurrencyFormatter({
    locale = 'en-US',
    currency = 'USD',
}: CurrencyFormatter): UseCurrencyFormatterReturn {
    const formatter = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency }), [locale, currency]);

    const formatCurrency = useCallback((amount: number) => formatter.format(amount), [formatter]);

    return { formatCurrency };
}
