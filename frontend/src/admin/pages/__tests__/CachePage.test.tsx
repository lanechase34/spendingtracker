import { createTheme } from '@mui/material/styles';
import { defined, render } from '@test-utils';
import { screen, within } from '@testing-library/react';
import CachePage from 'admin/pages/CachePage';
import type { ChartData } from 'chart.js';
import useAuthFetch from 'hooks/useAuthFetch';
import type { CacheKey } from 'types/CacheResponse.type';
import { API_BASE_URL } from 'utils/constants';

jest.mock('hooks/useAuthFetch');
jest.mock('components/ErrorCard', () => ({
    __esModule: true,
    default: () => <div data-testid="error-card" />,
}));
jest.mock('components/LoadingCard', () => ({
    __esModule: true,
    default: ({ loadingMessage }: { loadingMessage?: string }) => (
        <div data-testid="loading-card">{loadingMessage}</div>
    ),
}));
jest.mock('chart.js', () => ({
    Chart: { register: jest.fn() },
    ArcElement: {},
    Legend: {},
    Tooltip: {},
}));

/**
 * Capture the donut data so the fullness calculation can be checked
 */
let lastDonutData: ChartData<'doughnut'> | null = null;
jest.mock('react-chartjs-2', () => ({
    Doughnut: ({ data }: { data: ChartData<'doughnut'> }) => {
        lastDonutData = data;
        return <div data-testid="donut-chart" />;
    },
}));

const mockAuthFetch = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);
const theme = createTheme();

const cacheKey = (key: string, overrides: Partial<CacheKey> = {}): CacheKey => ({
    id: key,
    created: '2026-03-27T10:00:00',
    expired: false,
    hits: 3,
    key,
    lastaccesstimeout: 30,
    lastaccessed: '2026-03-27T11:00:00',
    timeout: 120,
    storage: 'memory',
    ...overrides,
});

const cacheData = (overrides: Record<string, unknown> = {}) => ({
    lastReapDateTime: '2026-03-27T09:00:00',
    hits: 90,
    misses: 10,
    evictionCount: 4,
    garbageCollections: 2,
    maxObjects: 10,
    data: [cacheKey('user_profile_1'), cacheKey('categories_page_1', { lastaccesstimeout: 0.5, timeout: 1440 })],
    ...overrides,
});

function mockResponse(ok: boolean, body: unknown) {
    return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) };
}

async function renderPage(data: ReturnType<typeof cacheData> = cacheData()) {
    mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data }));
    render(<CachePage />);
    await screen.findByText(`${String(data.hits)} hits / ${String(data.misses)} misses`);
}

// The summary card whose heading is the given text
const card = (heading: string) => {
    const el = screen.getByText(heading).closest('.MuiCard-root');
    if (!(el instanceof HTMLElement)) throw new Error(`No card for ${heading}`);
    return within(el);
};

describe('<CachePage />', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        lastDonutData = null;
        jest.spyOn(console, 'error').mockImplementation(() => {
            /* Silence expected query errors */
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Should show only a loading card until the first response arrives', async () => {
        let resolve: (value: unknown) => void = () => undefined;
        mockAuthFetch.mockReturnValue(
            new Promise((r) => {
                resolve = r;
            })
        );
        render(<CachePage />);

        expect(screen.getByTestId('loading-card')).toHaveTextContent('Loading cache data...');
        expect(screen.queryByText('Hit Rate')).not.toBeInTheDocument();
        expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
        expect(screen.queryByTestId('donut-chart')).not.toBeInTheDocument();

        resolve(mockResponse(true, { error: false, data: cacheData() }));

        expect(await screen.findByText('90 hits / 10 misses')).toBeInTheDocument();
        expect(screen.queryByTestId('loading-card')).not.toBeInTheDocument();
    });

    it('Should request the cache data', async () => {
        await renderPage();

        expect(mockAuthFetch).toHaveBeenCalledWith(
            expect.objectContaining({ url: `${API_BASE_URL}/admin/cachedata`, method: 'GET' })
        );
    });

    describe('Hit rate', () => {
        it('Should show hits as a percentage of all lookups', async () => {
            await renderPage();

            expect(card('Hit Rate').getByText('90.0%')).toBeInTheDocument();
            expect(card('Hit Rate').getByText('90 hits / 10 misses')).toBeInTheDocument();
        });

        it('Should show 0% when there have been no lookups', async () => {
            await renderPage(cacheData({ hits: 0, misses: 0 }));

            expect(card('Hit Rate').getByText('0.0%')).toBeInTheDocument();
        });

        it('Should round to one decimal place', async () => {
            await renderPage(cacheData({ hits: 1, misses: 2 }));

            expect(card('Hit Rate').getByText('33.3%')).toBeInTheDocument();
        });
    });

    describe('Fullness', () => {
        it('Should show how many of the max keys are used', async () => {
            await renderPage();

            expect(card('Utilization').getByText('20.0%')).toBeInTheDocument();
            expect(card('Utilization').getByText('2 / 10 keys')).toBeInTheDocument();
            expect(defined(lastDonutData, 'donut data').datasets[0]?.data).toEqual([2, 8]);
            expect(screen.queryByText('Warning: Cache nearly full')).not.toBeInTheDocument();
        });

        it('Should warn when the cache is over 80% full', async () => {
            const keys = Array.from({ length: 9 }, (_, i) => cacheKey(`key_${String(i)}`));
            await renderPage(cacheData({ data: keys }));

            expect(card('Utilization').getByText('90.0%')).toBeInTheDocument();
            expect(screen.getByText('Warning: Cache nearly full')).toBeInTheDocument();
            expect(defined(lastDonutData, 'donut data').datasets[0]?.backgroundColor).toEqual([
                theme.palette.warning.main,
                theme.palette.grey[700],
            ]);
        });

        it('Should not show negative space remaining when over capacity', async () => {
            const keys = Array.from({ length: 12 }, (_, i) => cacheKey(`key_${String(i)}`));
            await renderPage(cacheData({ data: keys }));

            expect(defined(lastDonutData, 'donut data').datasets[0]?.data).toEqual([12, 0]);
        });

        it('Should show 0% without a max object limit', async () => {
            await renderPage(cacheData({ maxObjects: 0 }));

            expect(card('Utilization').getByText('0.0%')).toBeInTheDocument();
            expect(card('Utilization').getByText('2 / 0 keys')).toBeInTheDocument();
        });
    });

    it('Should show eviction and garbage collection counts', async () => {
        await renderPage();

        expect(card('Evictions').getByText('4')).toBeInTheDocument();
        expect(card('GC Count').getByText('2')).toBeInTheDocument();
    });

    it('Should list each cache key with readable timeouts', async () => {
        await renderPage();

        const row = screen.getByText('categories_page_1').closest('[role="row"]');
        if (!(row instanceof HTMLElement)) throw new Error('No row for categories_page_1');
        expect(within(row).getByText('30s')).toBeInTheDocument();
        expect(within(row).getByText('1d')).toBeInTheDocument();
        expect(within(row).getByText('03/27/2026 10:00:00')).toBeInTheDocument();
        expect(screen.getByText('user_profile_1')).toBeInTheDocument();
    });

    it.each([
        ['there is no response', null],
        ['the response is not ok', mockResponse(false, {})],
        ['the API reports an error', mockResponse(true, { error: true, messages: ['Cache unavailable'] })],
        ['the body is malformed', mockResponse(true, { error: false, data: { hits: -1 } })],
    ])('Should show the error card when %s', async (_label, response) => {
        mockAuthFetch.mockResolvedValue(response);
        render(<CachePage />);

        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
        expect(screen.queryByTestId('donut-chart')).not.toBeInTheDocument();
    });
});
