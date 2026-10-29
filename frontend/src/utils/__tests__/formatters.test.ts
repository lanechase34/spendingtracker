import { formatDateKey } from 'utils/dates';
import { safeJson } from 'utils/safeJson';
import { formatMinutesToTime, formatSecondsToTime } from 'utils/timeFormatter';

describe('formatDateKey', () => {
    it('Should format a date as YYYY-MM-DD', () => {
        expect(formatDateKey(new Date(2026, 2, 27))).toBe('2026-03-27');
    });

    it('Should zero pad single digit months and days', () => {
        expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('Should use the local date rather than UTC', () => {
        expect(formatDateKey(new Date(2026, 11, 31, 23, 59, 59))).toBe('2026-12-31');
    });
});

describe('formatSecondsToTime', () => {
    it.each([
        [0, '0:00'],
        [5, '0:05'],
        [59, '0:59'],
        [60, '1:00'],
        [125, '2:05'],
        [3600, '60:00'],
    ])('Should format %i seconds as %s', (seconds, expected) => {
        expect(formatSecondsToTime(seconds)).toBe(expected);
    });
});

describe('formatMinutesToTime', () => {
    it.each([
        [0, '0s'],
        [0.5, '30s'],
        [1, '1m'],
        [59, '59m'],
        [60, '1h'],
        [90, '1h'],
        [1439, '23h'],
        [1440, '1d'],
        [4320, '3d'],
    ])('Should format %d minutes as %s', (minutes, expected) => {
        expect(formatMinutesToTime(minutes)).toBe(expected);
    });
});

// jsdom has no Response global, so mimic the json() contract
function mockResponse(body: string) {
    return {
        json: () => Promise.resolve().then((): unknown => JSON.parse(body)),
    } as unknown as Response;
}

describe('safeJson', () => {
    it('Should return the parsed body', async () => {
        const response = mockResponse(JSON.stringify({ error: false, data: [1, 2] }));
        await expect(safeJson(response)).resolves.toEqual({ error: false, data: [1, 2] });
    });

    it('Should return null for an empty body', async () => {
        await expect(safeJson(mockResponse(''))).resolves.toBeNull();
    });

    it('Should return null for malformed JSON', async () => {
        await expect(safeJson(mockResponse('<html>Bad Gateway</html>'))).resolves.toBeNull();
    });

    it('Should return null when json() throws', async () => {
        const response = { json: () => Promise.reject(new Error('stream already read')) } as unknown as Response;
        await expect(safeJson(response)).resolves.toBeNull();
    });
});
