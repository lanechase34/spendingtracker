import { createMetric, render } from '@test-utils';
import { screen } from '@testing-library/react';
import DatabaseMetrics from 'admin/components/DatabaseMetrics';
import QueryMetrics from 'admin/components/QueryMetrics';
import RateLimitMetrics from 'admin/components/RateLimitMetrics';
import SlowQueries from 'admin/components/SlowQueries';
import SystemMetrics from 'admin/components/SystemMetrics';
import type { ChartData } from 'chart.js';
import useMetricContext from 'hooks/useMetricContext';
import type { Metric } from 'types/MetricResponse.type';

jest.mock('hooks/useMetricContext');
jest.mock('chart.js', () => ({
    Chart: { register: jest.fn() },
    CategoryScale: {},
    LinearScale: {},
    PointElement: {},
    LineElement: {},
    Title: {},
    Tooltip: {},
    Legend: {},
}));

/**
 * Capture the line data so the pushed samples can be checked
 */
let lastLineData: ChartData<'line'> | null = null;
jest.mock('react-chartjs-2', () => ({
    Line: ({ data }: { data: ChartData<'line'> }) => {
        lastLineData = data;
        return <div data-testid="line-chart" />;
    },
}));

const mockUseMetricContext = useMetricContext as jest.Mock;

const withMetrics = (metrics: Metric | null) => {
    mockUseMetricContext.mockReturnValue({ metrics });
};

describe('Live metric widgets', () => {
    beforeEach(() => {
        lastLineData = null;
    });

    describe('QueryMetrics', () => {
        it('Should render a skeleton without metrics', () => {
            withMetrics(null);
            render(<QueryMetrics />);

            expect(screen.queryByText('Query Metrics')).not.toBeInTheDocument();
        });

        it('Should chart query count and avg ms and show window stats', () => {
            withMetrics(
                createMetric({
                    queries: { count: 7, errors: 2, avgMs: 4.5, maxMs: 31, peak: 50, total: 1234, slowQueries: [] },
                })
            );
            render(<QueryMetrics />);

            expect(screen.getByText('Query Metrics')).toBeInTheDocument();
            expect(lastLineData?.datasets[0]?.data).toEqual([7]);
            expect(lastLineData?.datasets[1]?.data).toEqual([4.5]);
            expect(screen.getByText('4.5ms')).toBeInTheDocument();
            expect(screen.getByText('31ms')).toBeInTheDocument();
            expect(screen.getByText((1234).toLocaleString())).toBeInTheDocument();
        });

        it('Should append a sample on each metrics push', () => {
            withMetrics(createMetric({ queries: { ...createMetric().queries, count: 1 } }));
            const { rerender } = render(<QueryMetrics />);

            withMetrics(createMetric({ queries: { ...createMetric().queries, count: 9 } }));
            rerender(<QueryMetrics />);

            expect(lastLineData?.datasets[0]?.data).toEqual([1, 9]);
        });
    });

    describe('SlowQueries', () => {
        it('Should list slow queries', () => {
            withMetrics(
                createMetric({
                    queries: {
                        ...createMetric().queries,
                        slowQueries: [
                            { sql: 'select * from expense', ms: 812, time: '2026-10-31T10:00:00Z', uuid: 'abc' },
                        ],
                    },
                })
            );
            render(<SlowQueries />);

            expect(screen.getByText('select * from expense')).toBeInTheDocument();
            expect(screen.getByText('812')).toBeInTheDocument();
        });
    });

    describe('DatabaseMetrics', () => {
        it('Should show connection stats when the database is up', () => {
            withMetrics(createMetric());
            render(<DatabaseMetrics />);

            expect(screen.getByText('Up')).toBeInTheDocument();
            expect(screen.getByText('1ms')).toBeInTheDocument();
            expect(screen.getByText('5 / 100')).toBeInTheDocument();
        });

        it('Should show down and N/A when the database is unreachable', () => {
            withMetrics(
                createMetric({ database: { up: false, pingMs: null, connections: null, longestQuerySeconds: 0 } })
            );
            render(<DatabaseMetrics />);

            expect(screen.getByText('Down')).toBeInTheDocument();
            expect(screen.getAllByText('N/A')).toHaveLength(2);
            expect(screen.queryByText('Idle In Transaction')).not.toBeInTheDocument();
        });
    });

    describe('RateLimitMetrics', () => {
        it('Should show window and total blocks sorted by event count', () => {
            withMetrics(
                createMetric({
                    rateLimit: { blocked: 3, total: 10, byEvent: { 'auth.register': 2, 'api.login': 8 } },
                })
            );
            render(<RateLimitMetrics />);

            expect(screen.getByText('3')).toBeInTheDocument();
            expect(screen.getByText('10')).toBeInTheDocument();

            const events = screen.getAllByText(/^(api\.login|auth\.register)$/).map((el) => el.textContent);
            expect(events).toEqual(['api.login', 'auth.register']);
        });

        it('Should hide the event table when nothing was blocked', () => {
            withMetrics(createMetric({ rateLimit: { blocked: 0, total: 0, byEvent: {} } }));
            render(<RateLimitMetrics />);

            expect(screen.queryByRole('table')).not.toBeInTheDocument();
        });
    });

    describe('SystemMetrics', () => {
        it('Should show uptime, threads and gc', () => {
            withMetrics(createMetric());
            render(<SystemMetrics />);

            expect(screen.getByText('1h 0m')).toBeInTheDocument();
            expect(screen.getByText('40 / 50 / 30')).toBeInTheDocument();
            expect(screen.getByText('5ms (0.1%)')).toBeInTheDocument();
        });

        it('Should show N/A for unavailable cpu stats', () => {
            withMetrics(createMetric({ cpu: { cores: 4, processPercent: null, systemPercent: null } }));
            render(<SystemMetrics />);

            expect(screen.getAllByText('N/A')).toHaveLength(2);
        });
    });
});
