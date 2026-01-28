import { screen, waitFor } from '@testing-library/react';
import { render } from '@test-utils';
import '@testing-library/jest-dom';
import DonutChart from 'widgets/DonutChart';
import type { Doughnut } from 'react-chartjs-2';
import { QueryClient } from '@tanstack/react-query';

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

// Mock Chart.js and react-chartjs-2 Doughnut component
jest.mock('react-chartjs-2', () => ({
    Doughnut: (props: React.ComponentProps<typeof Doughnut>) => (
        <div data-testid="doughnut-chart">Doughnut Chart Mock - labels: {props.data?.labels?.join(', ')}</div>
    ),
}));

// Mock Chart.js registration
jest.mock('chart.js', () => ({
    Chart: {
        register: jest.fn(),
    },
    ArcElement: {},
    Tooltip: {},
    Legend: {},
}));

describe('DonutChart Component', () => {
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

        render(<DonutChart />, { queryClient });
        expect(await screen.findByTestId('loading-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard on network error', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        render(<DonutChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard when response is not ok (bad http status)', async () => {
        mockFetch.mockResolvedValueOnce({ ok: false });

        render(<DonutChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders ErrorCard if API returns error flag', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                error: true,
            }),
        });

        render(<DonutChart />, { queryClient });
        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Renders EmptyCard when API returns no labels', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: { labels: [], dataset: { data: [] } },
            }),
        });

        render(<DonutChart />, { queryClient });
        expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
    });

    it('Renders Doughnut chart when API returns data', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: {
                    labels: ['A', 'B', 'C'],
                    dataset: { data: [10, 20, 30], backgroundColor: ['#ff0000', '#00ff00', '#0000ff'] },
                },
            }),
        });

        render(<DonutChart />, { queryClient });

        // Initially shows loading
        expect(screen.getByTestId('loading-card')).toBeInTheDocument();

        // Wait for data to load and chart to render
        await waitFor(() => {
            expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
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

        const { unmount } = render(<DonutChart />, { queryClient });

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
                    dataset: { data: [100] },
                },
            }),
        });

        render(<DonutChart />, { queryClient });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('startDate=01-01-2025&endDate=12-31-2025'),
                expect.objectContaining({ method: 'GET' })
            );
        });
    });
});
