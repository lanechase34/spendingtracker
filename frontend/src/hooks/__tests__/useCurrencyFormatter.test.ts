import { renderHook } from '@testing-library/react';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';

describe('useCurrencyFormatter', () => {
    it('Should format numbers as USD by default', () => {
        const { result } = renderHook(() => useCurrencyFormatter({}));

        const { formatCurrency } = result.current;
        expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('Should format numbers according to provided locale and currency', () => {
        const { result } = renderHook(() => useCurrencyFormatter({ locale: 'de-DE', currency: 'EUR' }));

        const { formatCurrency } = result.current;
        // In German locale, it uses comma for decimal separator and € symbol after number
        // Currency formatted has a nonbreaking space in it https://github.com/testing-library/jest-dom/issues/376
        expect(formatCurrency(1234.56).replace(/\u00a0/g, ' ')).toMatch(/1\.234,56 €/);
    });

    it('Should handle negative values correctly', () => {
        const { result } = renderHook(() => useCurrencyFormatter({}));

        const { formatCurrency } = result.current;
        expect(formatCurrency(-99.99)).toBe('-$99.99');
    });

    it('Should handle zero correctly', () => {
        const { result } = renderHook(() => useCurrencyFormatter({}));

        const { formatCurrency } = result.current;
        expect(formatCurrency(0)).toBe('$0.00');
    });

    it('Should use memoized formatter when locale and currency are unchanged', () => {
        const { result, rerender } = renderHook(({ locale, currency }) => useCurrencyFormatter({ locale, currency }), {
            initialProps: { locale: 'en-US', currency: 'USD' },
        });

        // Formatter should not change between re-renders if values didn't change
        const firstFormatter = result.current.formatCurrency;

        rerender({ locale: 'en-US', currency: 'USD' });
        const secondFormatter = result.current.formatCurrency;

        // Same formatter instance (memoized function)
        expect(firstFormatter).toBe(secondFormatter);
    });

    it('Should create a new formatter when locale or currency changes', () => {
        const { result, rerender } = renderHook(({ locale, currency }) => useCurrencyFormatter({ locale, currency }), {
            initialProps: { locale: 'en-US', currency: 'USD' },
        });

        const firstFormatter = result.current.formatCurrency;

        rerender({ locale: 'fr-FR', currency: 'EUR' });
        const secondFormatter = result.current.formatCurrency;

        // Formatter function reference changes because memo dependencies changed
        expect(firstFormatter).not.toBe(secondFormatter);
    });
});
