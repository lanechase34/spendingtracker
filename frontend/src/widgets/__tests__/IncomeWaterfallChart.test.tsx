import { createTheme } from '@mui/material/styles';
import { defined, render } from '@test-utils';
import { screen } from '@testing-library/react';
import type { ChartData, ChartOptions } from 'chart.js';
import useAuthFetch from 'hooks/useAuthFetch';
import { API_BASE_URL } from 'utils/constants';
import IncomeWaterfallChart from 'widgets/IncomeWaterfallChart';

jest.mock('hooks/useAuthFetch');
jest.mock('hooks/useDateRangeContext', () => ({
    __esModule: true,
    default: () => ({ formattedStartDate: '01-01-2026', formattedEndDate: '03-31-2026' }),
}));
jest.mock('components/LoadingCard', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-card" />,
}));
jest.mock('components/ErrorCard', () => ({
    __esModule: true,
    default: () => <div data-testid="error-card" />,
}));
jest.mock('components/EmptyCard', () => ({
    __esModule: true,
    default: () => <div data-testid="empty-card" />,
}));
jest.mock('chart.js', () => ({
    Chart: { register: jest.fn() },
    BarElement: {},
    CategoryScale: {},
    LinearScale: {},
    Legend: {},
    Title: {},
    Tooltip: {},
}));
jest.mock('chartjs-plugin-annotation', () => ({}));
jest.mock('chartjs-plugin-datalabels', () => ({}));

/**
 * Capture what the component hands to the chart so its calculations can be checked
 */
let lastBarProps: { data: ChartData<'bar'>; options: ChartOptions<'bar'> } | null = null;
jest.mock('react-chartjs-2', () => ({
    Bar: (props: { data: ChartData<'bar'>; options: ChartOptions<'bar'> }) => {
        lastBarProps = props;
        return <div data-testid="bar-chart" />;
    },
}));

const mockAuthFetch = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);

const theme = createTheme();
const GREEN = theme.palette.success.main;
const RED = theme.palette.error.main;
const BLUE = theme.palette.info.main;

function mockResponse(ok: boolean, body: unknown) {
    return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) };
}

const waterfall = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    segments: [
        { net: 1000, savings: 200, runningTotal: 1000 }, // gain with savings
        { net: -500, savings: 0, runningTotal: 500 }, // loss
        { net: 300, savings: 500, runningTotal: 800 }, // savings larger than the gain
        { net: 0, savings: 0, runningTotal: 800 }, // flat month
    ],
};

// Plugin callbacks only read dataIndex from their context
type Callback = (...args: unknown[]) => unknown;
const ctxAt = (dataIndex: number) => ({ dataIndex });

async function renderChart(data: unknown = waterfall) {
    mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data }));
    render(<IncomeWaterfallChart />);
    await screen.findByTestId('bar-chart');
    return defined(lastBarProps, 'chart props');
}

describe('<IncomeWaterfallChart />', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        lastBarProps = null;
        jest.spyOn(console, 'error').mockImplementation(() => {
            /* Silence expected errors */
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('States', () => {
        it('Should request the selected date range', async () => {
            await renderChart();

            expect(mockAuthFetch).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: `${API_BASE_URL}/widgets/incomeWaterfall?startDate=01-01-2026&endDate=03-31-2026`,
                    method: 'GET',
                })
            );
            expect(screen.getByText('Net Income By Month')).toBeInTheDocument();
        });

        it('Should show the loading card while fetching', () => {
            mockAuthFetch.mockReturnValue(
                new Promise(() => {
                    /* never resolves */
                })
            );
            render(<IncomeWaterfallChart />);

            expect(screen.getByTestId('loading-card')).toBeInTheDocument();
        });

        it.each([
            ['there is no response', null],
            ['the response is not ok', mockResponse(false, {})],
            ['the API reports an error', mockResponse(true, { error: true, messages: ['x'] })],
            ['the body is malformed', mockResponse(true, { error: false, data: { labels: [] } })],
        ])('Should show the error card when %s', async (_label, response) => {
            mockAuthFetch.mockResolvedValue(response);
            render(<IncomeWaterfallChart />);

            expect(await screen.findByTestId('error-card')).toBeInTheDocument();
        });

        it('Should show the empty card when there are no months', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: { labels: [], segments: [] } }));
            render(<IncomeWaterfallChart />);

            expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
        });
    });

    describe('Bars', () => {
        it('Should float each bar from the previous running total to the new one', async () => {
            const { data } = await renderChart();

            expect(data.labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr']);
            expect(data.datasets[0]?.data).toEqual([
                [0, 1000],
                [1000, 500],
                [500, 800],
                [800, 800],
            ]);
        });

        it('Should color gains and flat months green and losses red', async () => {
            const { data } = await renderChart();

            expect(data.datasets[0]?.backgroundColor).toEqual([GREEN, RED, GREEN, GREEN]);
        });
    });

    describe('Savings overlay', () => {
        it('Should draw savings only on months with a gain and savings', async () => {
            const { options } = await renderChart();
            const annotations = defined(options.plugins?.annotation?.annotations, 'annotations');

            expect(Object.keys(annotations)).toEqual(['savings_0', 'savings_2']);
        });

        it('Should cover the top of the bar by the savings amount', async () => {
            const { options } = await renderChart();
            const annotations = defined(options.plugins?.annotation?.annotations, 'annotations') as Record<
                string,
                Record<string, unknown>
            >;

            expect(annotations['savings_0']).toMatchObject({
                type: 'box',
                xMin: -0.355,
                xMax: 0.355,
                yMin: 800,
                yMax: 1000,
                backgroundColor: BLUE,
            });
        });

        it('Should not let savings extend below the bottom of the bar', async () => {
            const { options } = await renderChart();
            const annotations = defined(options.plugins?.annotation?.annotations, 'annotations') as Record<
                string,
                Record<string, unknown>
            >;

            // Savings of 500 on a 300 gain is clamped to the bar's 500-800 range
            expect(annotations['savings_2']).toMatchObject({ yMin: 500, yMax: 800 });
        });
    });

    describe('Axis', () => {
        it('Should pad the y axis by 5% of the running total range, always including zero', async () => {
            const { options } = await renderChart();

            expect(options.scales?.['y']?.suggestedMin).toBe(-50);
            expect(options.scales?.['y']?.suggestedMax).toBe(1050);
        });

        it('Should extend the y axis below zero for negative running totals', async () => {
            const { options } = await renderChart({
                labels: ['Jan', 'Feb'],
                segments: [
                    { net: -1000, savings: 0, runningTotal: -1000 },
                    { net: 2000, savings: 0, runningTotal: 1000 },
                ],
            });

            expect(options.scales?.['y']?.suggestedMin).toBe(-1100);
            expect(options.scales?.['y']?.suggestedMax).toBe(1100);
        });

        it('Should format y axis ticks as money', async () => {
            const { options } = await renderChart();
            const callback = options.scales?.['y']?.ticks?.callback as Callback;

            expect(callback(1500)).toBe('$1,500');
            expect(callback(0.125)).toBe('$0.13');
            expect(callback(-250.5)).toBe('-$250.5');
            expect(callback(0)).toBe('$0');
        });
    });

    describe('Tooltip and labels', () => {
        it('Should summarize net, savings, and running total for the hovered month', async () => {
            const { options } = await renderChart();
            const label = options.plugins?.tooltip?.callbacks?.label as Callback;

            expect(label(ctxAt(0))).toEqual(['Net: +$1,000.00', 'Of which savings: $200.00', 'Running: +$1,000.00']);
            expect(label(ctxAt(1))).toEqual(['Net: -$500.00', 'Of which savings: $0.00', 'Running: +$500.00']);
            expect(label(ctxAt(99))).toBe('');
        });

        it('Should not sign a month with no change', async () => {
            const { options } = await renderChart();
            const label = options.plugins?.tooltip?.callbacks?.label as Callback;

            expect(label(ctxAt(3))).toEqual(['Net: $0.00', 'Of which savings: $0.00', 'Running: +$800.00']);
        });

        it('Should show a negative running total with a minus sign', async () => {
            const { options } = await renderChart({
                labels: ['Jan'],
                segments: [{ net: -42.5, savings: 0, runningTotal: -42.5 }],
            });
            const label = options.plugins?.tooltip?.callbacks?.label as Callback;

            expect(label(ctxAt(0))).toEqual(['Net: -$42.50', 'Of which savings: $0.00', 'Running: -$42.50']);
        });

        it('Should label each bar with its signed net change and hide flat months', async () => {
            const { options } = await renderChart();
            const datalabels = options.plugins?.datalabels as Record<string, Callback>;

            expect(datalabels['formatter']?.(null, ctxAt(0))).toBe('+$1,000.00');
            expect(datalabels['formatter']?.(null, ctxAt(1))).toBe('-$500.00');
            expect(datalabels['formatter']?.(null, ctxAt(99))).toBe('');
            expect(datalabels['display']?.(ctxAt(0))).toBe(true);
            expect(datalabels['display']?.(ctxAt(3))).toBe(false);
        });

        it('Should place labels above gains and below losses', async () => {
            const { options } = await renderChart();
            const datalabels = options.plugins?.datalabels as Record<string, Callback>;

            expect(datalabels['align']?.(ctxAt(0))).toBe('end');
            expect(datalabels['anchor']?.(ctxAt(0))).toBe('end');
            expect(datalabels['align']?.(ctxAt(1))).toBe('start');
            expect(datalabels['anchor']?.(ctxAt(1))).toBe('start');
        });
    });
});
