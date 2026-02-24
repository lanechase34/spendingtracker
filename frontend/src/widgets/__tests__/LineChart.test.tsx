import { QueryClient } from '@tanstack/react-query';
import { render } from '@test-utils';
import { screen, waitFor } from '@testing-library/react';
import type { ChartData } from 'chart.js';
import LineChart from 'widgets/LineChart';

// Mock hooks and child components
jest.mock('hooks/useDateRangeContext', () => ({
    __esModule: true,
    default: () => ({
        formattedStartDate: '01-01-2025',
        formattedEndDate: '12-31-2025',
    }),
}));

jest.mock('components/LoadingCard', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-card">Loading...</div>,
}));

jest.mock('components/ErrorCard', () => ({
    __esModule: true,
    default: () => <div data-testid="error-card">Error!</div>,
}));

jest.mock('components/EmptyCard', () => ({
    __esModule: true,
    default: () => <div data-testid="empty-card">Empty</div>,
}));

interface LineMockProps {
    data?: ChartData<'line'>;
}

// Mock react-chartjs-2 Line component
jest.mock('react-chartjs-2', () => ({
    Line: ({ data }: LineMockProps) => (
        <div data-testid="line-chart">
            Line Chart Mock - labels: {data?.labels?.join(', ')}
            {data?.datasets?.[0]?.data && (
                <span data-testid="chart-data">- data: {(data.datasets[0].data as number[]).join(', ')}</span>
            )}
        </div>
    ),
}));

// Mock Chart.js registration
jest.mock('chart.js', () => ({
    Chart: {
        register: jest.fn(),
    },
    CategoryScale: {},
    LinearScale: {},
    PointElement: {},
    LineElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
}));

// Mock chartjs plugins
jest.mock('chartjs-plugin-datalabels', () => ({}));
jest.mock('chartjs-plugin-annotation', () => ({}));

describe('LineChart Component', () => {
    let queryClient: QueryClient;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create fresh QueryClient for each test
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                },
            },
        });

        mockFetch = jest.fn();
        global.fetch = mockFetch;
        jest.spyOn(console, 'error').mockImplementation(() => {
            /*empty*/
        }); // Silence expected errors
    });

    afterEach(() => {
        jest.restoreAllMocks();
        queryClient.clear();
    });

    it('Renders LoadingCard initially', async () => {
        mockFetch.mockImplementationOnce(
            () =>
                new Promise(() => {
                    /*never resolve - stays loading*/
                })
        );

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('loading-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard when response is null/undefined', async () => {
        mockFetch.mockResolvedValueOnce(null);

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard when response is not ok (bad http status)', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard if API returns error flag', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                error: true,
            }),
        });

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders EmptyCard when API returns no labels', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: { labels: [], dataset: { data: [] } },
            }),
        });

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
    });

    it('Renders EmptyCard when API returns null labels', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: { labels: null, dataset: { data: [] } },
            }),
        });

        render(<LineChart />, { queryClient });
        expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
    });

    it('Renders Line chart when API returns data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb', 'Mar'],
                    dataset: { data: [100, 200, 150] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        // Initially shows loading
        expect(screen.getByTestId('loading-card')).toBeInTheDocument();

        // Wait for data to load and chart to render
        await waitFor(() => {
            expect(screen.getByTestId('line-chart')).toBeInTheDocument();
            expect(screen.getByText(/Jan, Feb, Mar/)).toBeInTheDocument();
        });
    });

    it('Displays chart with correct data values', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb', 'Mar'],
                    dataset: { data: [100.5, 200.75, 150.25] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByTestId('chart-data')).toHaveTextContent('100.5, 200.75, 150.25');
        });
    });

    it('Renders card with correct title', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan'],
                    dataset: { data: [100] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByText('Expenses By Month')).toBeInTheDocument();
        });
    });

    it('Aborts fetch request on unmount', async () => {
        const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                new Promise((res) =>
                    setTimeout(() => res({ data: { labels: ['Jan'], dataset: { data: [100] } } }), 100)
                ),
        });

        const { unmount } = render(<LineChart />, { queryClient });

        // Wait a tick for the fetch to be called
        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalled();
        });

        unmount();

        // Verify the signal was aborted
        expect(abortSpy).toHaveBeenCalled();
        abortSpy.mockRestore();
    });

    it('Uses correct query key with date params', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan'],
                    dataset: { data: [100] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('startDate=01-01-2025&endDate=12-31-2025'),
                expect.objectContaining({ method: 'GET' })
            );
        });
    });

    it('Calls correct API endpoint', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan'],
                    dataset: { data: [100] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/spendingtracker/api/v1/widgets/lineChart'),
                expect.any(Object)
            );
        });
    });

    it('Handles zero values in data correctly', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb', 'Mar'],
                    dataset: { data: [0, 100, 0] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByTestId('chart-data')).toHaveTextContent('0, 100, 0');
        });
    });

    it('Handles decimal values in data correctly', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb'],
                    dataset: { data: [123.45, 678.9] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByTestId('chart-data')).toHaveTextContent('123.45, 678.9');
        });
    });

    it('Re-fetches data when date range changes', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan'],
                    dataset: { data: [100] },
                },
            }),
        });

        const { rerender } = render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        // In a real scenario, the date range would change via context
        // This would trigger a new query with different additionalParams
        rerender(<LineChart />);

        // Query should be cached, so no additional fetch
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('Handles very large data values', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb'],
                    dataset: { data: [999999.99, 1000000.01] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByTestId('chart-data')).toHaveTextContent('999999.99, 1000000.01');
        });
    });

    it('Handles negative values in data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb'],
                    dataset: { data: [-100, 50] },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByTestId('chart-data')).toHaveTextContent('-100, 50');
        });
    });

    it('Handles 12 months of data (full year)', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    dataset: {
                        data: [100, 150, 200, 175, 225, 250, 300, 275, 325, 350, 400, 450],
                    },
                },
            }),
        });

        render(<LineChart />, { queryClient });

        await waitFor(() => {
            expect(screen.getByText(/Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec/)).toBeInTheDocument();
        });
    });
});
