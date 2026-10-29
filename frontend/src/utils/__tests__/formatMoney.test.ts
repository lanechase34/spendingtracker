import { formatMoney } from 'utils/formatMoney';

describe('formatMoney', () => {
    it.each([
        [0, '$0'],
        [5, '$5'],
        [1234.5, '$1,234.5'],
        [1234.567, '$1,234.57'],
        [1000000, '$1,000,000'],
    ])('Should format %d as %s by default', (value, expected) => {
        expect(formatMoney(value)).toBe(expected);
    });

    it.each([
        [-250, '-$250'],
        [-250.5, '-$250.5'],
        [-1234.567, '-$1,234.57'],
    ])('Should put the minus sign before the dollar sign for %d', (value, expected) => {
        expect(formatMoney(value)).toBe(expected);
    });

    it('Should never show -$0 for values that round to zero', () => {
        expect(formatMoney(-0)).toBe('$0');
        expect(formatMoney(-0.001)).toBe('$0');
        expect(formatMoney(-0.4, { maximumFractionDigits: 0 })).toBe('$0');
    });

    it('Should pad to cents when asked', () => {
        expect(formatMoney(12.5, { minimumFractionDigits: 2 })).toBe('$12.50');
        expect(formatMoney(-12, { minimumFractionDigits: 2 })).toBe('-$12.00');
    });

    it('Should round to whole dollars', () => {
        expect(formatMoney(1999.6, { maximumFractionDigits: 0 })).toBe('$2,000');
        expect(formatMoney(-1999.4, { maximumFractionDigits: 0 })).toBe('-$1,999');
    });

    it('Should not throw when the minimum digits exceed the maximum', () => {
        expect(formatMoney(12.345, { minimumFractionDigits: 2, maximumFractionDigits: 0 })).toBe('$12');
    });

    it('Should show + for gains and nothing for zero when signing changes', () => {
        const signed = { minimumFractionDigits: 2, signDisplay: 'exceptZero' } as const;

        expect(formatMoney(1000, signed)).toBe('+$1,000.00');
        expect(formatMoney(-500, signed)).toBe('-$500.00');
        expect(formatMoney(0, signed)).toBe('$0.00');
        expect(formatMoney(-0.001, signed)).toBe('$0.00');
    });

    it('Should match useCurrencyFormatter for cents', () => {
        const intl = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

        for (const value of [-1234.5, -0.5, 0, 0.5, 1234.5]) {
            expect(formatMoney(value, { minimumFractionDigits: 2 })).toBe(intl.format(value));
        }
    });
});
