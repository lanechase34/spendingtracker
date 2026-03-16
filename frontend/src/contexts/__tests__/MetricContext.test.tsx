import { act, renderHook, waitFor } from '@testing-library/react';
import { MetricContext, MetricContextProvider } from 'contexts/MetricContext';
import useAuthContext from 'hooks/useAuthContext';
import type { ReactNode } from 'react';
import { useContext } from 'react';
import { createMetricsClient } from 'sockets/createMetricsClient';
import type { Metric } from 'types/MetricResponse.type';

// Mocks

jest.mock('sockets/createMetricsClient');
jest.mock('hooks/useAuthContext');

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockCreateMetricsClient = createMetricsClient as jest.Mock;

// Constants

const MOCK_METRIC: Metric = {
    cpu: {
        cores: 8,
        processPercent: 23.5,
        systemPercent: 41.2,
    },
    memory: {
        totalMB: 16384,
        usedMB: 8192,
        maxMB: 16384,
    },
    concurrency: {
        activeRequests: 3,
        maxRequests: 100,
        slowRequests: [
            {
                delta: 1523,
                method: 'GET',
                urlpath: '/api/v1/expenses',
                userid: 42,
                time: '2024-01-15T10:30:00Z',
                uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            },
        ],
    },
};

const MOCK_AUTH_TOKEN = 'mock_auth_token';

// Helpers

/**
 * Creates a mock STOMP client with jest.fn() for activate and deactivate.
 * deactivate returns a resolved promise to match the real async signature.
 */
function createMockClient() {
    return {
        activate: jest.fn(),
        deactivate: jest.fn().mockResolvedValue(undefined),
    };
}

/**
 * Renders the real MetricContextProvider and returns the context value.
 * Captures the onMetrics callback passed to createMetricsClient so tests
 * can simulate incoming socket messages.
 */
function renderMetricContext() {
    let capturedOnMetrics: ((metric: Metric) => void) | null = null;
    let capturedOnError: ((err: unknown) => void) | null = null;
    const mockClient = createMockClient();

    mockCreateMetricsClient.mockImplementation(
        ({ onMetrics, onError }: { onMetrics: (metric: Metric) => void; onError: (err: unknown) => void }) => {
            capturedOnMetrics = onMetrics;
            capturedOnError = onError;
            return mockClient;
        }
    );

    const utils = renderHook(() => useContext(MetricContext)!, {
        wrapper: ({ children }: { children: ReactNode }) => <MetricContextProvider>{children}</MetricContextProvider>,
    });

    return {
        ...utils,
        mockClient,
        simulateMetric: (metric: Metric) => {
            act(() => {
                capturedOnMetrics?.(metric);
            });
        },
        simulateError: (err: unknown) => {
            act(() => {
                capturedOnError?.(err);
            });
        },
    };
}

describe('MetricContextProvider', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        // Default: authenticated
        mockUseAuthContext.mockReturnValue({ authToken: MOCK_AUTH_TOKEN });

        jest.spyOn(console, 'error').mockImplementation(() => {
            // Silence expected errors
        });
    });

    describe('Initial state', () => {
        it('Provides null metrics before any socket message is received', () => {
            const { result } = renderMetricContext();

            expect(result.current.metrics).toBeNull();
        });
    });

    // --- Client lifecycle - authToken present -------------------------------------

    describe('Client lifecycle - authToken present', () => {
        it('Creates a metrics client when authToken is available', () => {
            renderMetricContext();

            expect(mockCreateMetricsClient).toHaveBeenCalledTimes(1);
        });

        it('Passes the correct brokerURL to createMetricsClient', () => {
            renderMetricContext();

            expect(mockCreateMetricsClient).toHaveBeenCalledWith(
                expect.objectContaining({ brokerURL: expect.stringMatching(/^wss?:\/\//) as string })
            );
        });

        it('Passes the authToken to createMetricsClient', () => {
            renderMetricContext();

            expect(mockCreateMetricsClient).toHaveBeenCalledWith(expect.objectContaining({ token: MOCK_AUTH_TOKEN }));
        });

        it('Passes an onMetrics callback to createMetricsClient', () => {
            renderMetricContext();

            expect(mockCreateMetricsClient).toHaveBeenCalledWith(
                expect.objectContaining({ onMetrics: expect.any(Function) as (metric: Metric) => void })
            );
        });

        it('Passes an onError callback to createMetricsClient', () => {
            renderMetricContext();

            expect(mockCreateMetricsClient).toHaveBeenCalledWith(
                expect.objectContaining({ onError: expect.any(Function) as (err: unknown) => void })
            );
        });

        it('Activates the client after creation', () => {
            const { mockClient } = renderMetricContext();

            expect(mockClient.activate).toHaveBeenCalledTimes(1);
        });

        it('Does not create a second client when authToken remains the same across re-renders', () => {
            const { rerender } = renderMetricContext();

            rerender();
            rerender();

            expect(mockCreateMetricsClient).toHaveBeenCalledTimes(1);
        });
    });

    describe('Client lifecycle - authToken absent', () => {
        it('Does not create a metrics client when authToken is null', () => {
            mockUseAuthContext.mockReturnValue({ authToken: null });

            renderMetricContext();

            expect(mockCreateMetricsClient).not.toHaveBeenCalled();
        });

        it('Does not activate a client when authToken is null', () => {
            mockUseAuthContext.mockReturnValue({ authToken: null });

            const { mockClient } = renderMetricContext();

            expect(mockClient.activate).not.toHaveBeenCalled();
        });

        it('Deactivates the existing client when authToken becomes null', async () => {
            // Start authenticated
            const { mockClient, rerender } = renderMetricContext();

            expect(mockClient.activate).toHaveBeenCalledTimes(1);

            // Token removed
            mockUseAuthContext.mockReturnValue({ authToken: null });
            rerender();

            await waitFor(() => {
                expect(mockClient.deactivate).toHaveBeenCalledTimes(1);
            });
        });

        it('Sets clientRef to null when authToken becomes null', async () => {
            const { mockClient, rerender } = renderMetricContext();

            mockUseAuthContext.mockReturnValue({ authToken: null });
            rerender();

            await waitFor(() => expect(mockClient.deactivate).toHaveBeenCalled());

            // A subsequent re-render with a new token should create a fresh client
            const newMockClient = createMockClient();
            mockCreateMetricsClient.mockReturnValueOnce(newMockClient);

            mockUseAuthContext.mockReturnValue({ authToken: MOCK_AUTH_TOKEN });
            rerender();

            await waitFor(() => expect(newMockClient.activate).toHaveBeenCalledTimes(1));
        });
    });

    describe('Receiving metrics via onMetrics callback', () => {
        it('Updates metrics in context when onMetrics is called', () => {
            const { result, simulateMetric } = renderMetricContext();

            simulateMetric(MOCK_METRIC);

            expect(result.current.metrics).toEqual(MOCK_METRIC);
        });

        it('Replaces previous metrics with the latest message', () => {
            const { result, simulateMetric } = renderMetricContext();

            simulateMetric(MOCK_METRIC);
            simulateMetric({ ...MOCK_METRIC, concurrency: { activeRequests: 99, maxRequests: 99, slowRequests: [] } });

            expect(result.current.metrics?.concurrency?.activeRequests).toBe(99);
        });

        it('Handles multiple sequential metric updates correctly', () => {
            const { result, simulateMetric } = renderMetricContext();

            for (let i = 1; i <= 5; i++) {
                simulateMetric({
                    ...MOCK_METRIC,
                    concurrency: { activeRequests: i * 10, maxRequests: 0, slowRequests: [] },
                });
            }

            expect(result.current.metrics?.concurrency?.activeRequests).toBe(50);
        });
    });

    describe('Error handling via onError callback', () => {
        it('Logs the error to console.error when onError is called', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
                // silence expected errors
            });
            const { simulateError } = renderMetricContext();
            const mockError = new Error('Socket disconnected');

            simulateError(mockError);

            expect(consoleSpy).toHaveBeenCalledWith('Metrics socket error', mockError);
            consoleSpy.mockRestore();
        });

        it('Does not update metrics when a socket error occurs', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
                // silence expected errors
            });
            const { result, simulateError } = renderMetricContext();

            simulateError(new Error('Socket disconnected'));

            expect(result.current.metrics).toBeNull();
            consoleSpy.mockRestore();
        });
    });

    describe('Cleanup on unmount', () => {
        it('Deactivates the client when the component unmounts', async () => {
            const { mockClient, unmount } = renderMetricContext();

            unmount();

            await waitFor(() => expect(mockClient.deactivate).toHaveBeenCalledTimes(1));
        });

        it('Does not attempt to deactivate when no client exists on unmount', () => {
            mockUseAuthContext.mockReturnValue({ authToken: null });

            const { mockClient, unmount } = renderMetricContext();

            unmount();

            expect(mockClient.deactivate).not.toHaveBeenCalled();
        });
    });

    describe('Token transitions', () => {
        it('Creates a new client when authToken transitions from null to a value', async () => {
            mockUseAuthContext.mockReturnValue({ authToken: null });

            const { rerender } = renderMetricContext();
            expect(mockCreateMetricsClient).not.toHaveBeenCalled();

            mockUseAuthContext.mockReturnValue({ authToken: MOCK_AUTH_TOKEN });
            rerender();

            await waitFor(() => expect(mockCreateMetricsClient).toHaveBeenCalledTimes(1));
        });

        it('Activates a new client when authToken transitions from null to a value', async () => {
            mockUseAuthContext.mockReturnValue({ authToken: null });

            const newMockClient = createMockClient();
            mockCreateMetricsClient.mockReturnValueOnce(newMockClient);

            const { rerender } = renderMetricContext();

            mockUseAuthContext.mockReturnValue({ authToken: MOCK_AUTH_TOKEN });
            rerender();

            await waitFor(() => expect(newMockClient.activate).toHaveBeenCalledTimes(1));
        });

        it('Deactivates the old client and creates a new one when authToken changes value', async () => {
            const { mockClient, rerender } = renderMetricContext();

            const newMockClient = createMockClient();
            mockCreateMetricsClient.mockReturnValueOnce(newMockClient);

            // Simulate token rotation: null then new token
            mockUseAuthContext.mockReturnValue({ authToken: null });
            rerender();

            await waitFor(() => expect(mockClient.deactivate).toHaveBeenCalledTimes(1));

            mockUseAuthContext.mockReturnValue({ authToken: 'new-token' });
            rerender();

            await waitFor(() => expect(newMockClient.activate).toHaveBeenCalledTimes(1));
        });
    });

    describe('Context value memoization', () => {
        it('Does not change the context reference when an unrelated re-render occurs', () => {
            const { result, rerender } = renderMetricContext();

            const valueBefore = result.current;
            rerender();
            const valueAfter = result.current;

            expect(valueAfter).toBe(valueBefore);
        });

        it('Updates the context reference when metrics change', () => {
            const { result, simulateMetric } = renderMetricContext();

            const valueBefore = result.current;
            simulateMetric(MOCK_METRIC);
            const valueAfter = result.current;

            expect(valueAfter).not.toBe(valueBefore);
            expect(valueAfter.metrics).toEqual(MOCK_METRIC);
        });
    });
});
