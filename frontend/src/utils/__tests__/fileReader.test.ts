import { formatBytes, getLineColor } from 'utils/fileReader';

describe('formatBytes', () => {
    it.each([
        [0, '0 B'],
        [1, '1 B'],
        [1023, '1023 B'],
        [1024, '1 KB'],
        [1536, '1.5 KB'],
        [1024 * 1024, '1 MB'],
        [5.25 * 1024 * 1024, '5.3 MB'],
        [1024 ** 3, '1 GB'],
    ])('Should format %i bytes as %s', (bytes, expected) => {
        expect(formatBytes(bytes)).toBe(expected);
    });
});

describe('getLineColor', () => {
    const LIGHT = { error: '#b91c1c', warn: '#92400e', shutdown: '#6d28d9', success: '#065f46', plain: '#334155' };
    const DARK = { error: '#fca5a5', warn: '#fcd34d', shutdown: '#a78bfa', success: '#6ee7b7', plain: '#cbd5e1' };

    it.each([
        ['error', 'ERROR: database down'],
        ['error', 'java.lang.NullPointerException'],
        ['error', 'Fatal crash'],
        ['warn', 'WARN slow query'],
        ['shutdown', '† Server stopping'],
        ['shutdown', 'Shutdown complete'],
        ['success', '√ Module loaded'],
        ['success', 'Server is ready'],
        ['success', 'Started in 3s'],
        ['success', 'Migration success'],
        ['plain', 'GET /api/v1/expenses 200'],
    ] as const)('Should color a line as %s: %s', (kind, line) => {
        expect(getLineColor(line, false)).toBe(LIGHT[kind]);
        expect(getLineColor(line, true)).toBe(DARK[kind]);
    });

    it('Should treat errors as more important than other keywords', () => {
        expect(getLineColor('WARN: error while starting', false)).toBe(LIGHT.error);
        expect(getLineColor('started with exception', false)).toBe(LIGHT.error);
    });

    it('Should treat warnings as more important than success keywords', () => {
        expect(getLineColor('warning: server ready with degraded cache', false)).toBe(LIGHT.warn);
    });
});
