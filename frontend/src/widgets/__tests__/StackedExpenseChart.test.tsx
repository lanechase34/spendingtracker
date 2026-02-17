import { QueryClient } from '@tanstack/react-query';
import { render } from '@test-utils';
import { screen, waitFor } from '@testing-library/react';
import type { Bar } from 'react-chartjs-2';
import StackedExpenseChart from 'widgets/StackedExpenseChart';

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

// Mock Chart.js and react-chartjs-2 Bar component
jest.mock('react-chartjs-2', () => ({
    Bar: (props: React.ComponentProps<typeof Bar>) => (
        <div data-testid="stackedexpense-chart">Bar Chart Mock - labels: {props.data?.labels?.join(', ')}</div>
    ),
}));

// Mock Chart.js registration
jest.mock('chart.js', () => ({
    Chart: {
        register: jest.fn(),
    },
    CategoryScale: {},
    LinearScale: {},
    BarElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
}));

describe('StackedExpenseChart Component', () => {
    let queryClient: QueryClient;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        // Create a new QueryClient for each test to ensure isolation
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false, // Disable retries in tests
                    gcTime: 0, // Clear cache immediately
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

        render(<StackedExpenseChart />, { queryClient });
        expect(await screen.findByTestId('loading-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard on network error', async () => {
        mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

        render(<StackedExpenseChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard when response is not ok (bad http status)', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });

        render(<StackedExpenseChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard if API returns error flag', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                error: true,
            }),
        });

        render(<StackedExpenseChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders EmptyCard when API returns no datasets', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: { labels: ['A', 'B'], datasets: [] },
            }),
        });

        render(<StackedExpenseChart />, { queryClient });
        expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
    });

    it('Renders Stacked Expense Chart when API returns data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['A', 'B', 'C'],
                    datasets: [
                        {
                            label: 'A',
                            data: [10, 0, 0],
                            backgroundColor: '#ff0000',
                        },
                        {
                            label: 'B',
                            data: [0, 20, 0],
                            backgroundColor: '#00ff00',
                        },
                        {
                            label: 'C',
                            data: [0, 0, 30],
                            backgroundColor: '#0000ff',
                        },
                    ],
                },
            }),
        });

        render(<StackedExpenseChart />, { queryClient });

        // Initially shows loading
        expect(screen.getByTestId('loading-card')).toBeInTheDocument();

        // Wait for data to load and chart to render
        await waitFor(() => {
            expect(screen.getByTestId('stackedexpense-chart')).toBeInTheDocument();
            expect(screen.getByText(/A, B, C/)).toBeInTheDocument();
        });
    });

    it('Aborts fetch request on unmount', async () => {
        const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () =>
                new Promise((res) => setTimeout(() => res({ data: { labels: [], dataset: { data: [] } } }), 100)),
        });

        const { unmount } = render(<StackedExpenseChart />, { queryClient });

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
                    labels: ['Test'],
                    datasets: [{ label: 'Test', data: [100], backgroundColor: '#ff0000' }],
                },
            }),
        });

        render(<StackedExpenseChart />, { queryClient });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('startDate=01-01-2025&endDate=12-31-2025'),
                expect.objectContaining({ method: 'GET' })
            );
        });
    });
});
