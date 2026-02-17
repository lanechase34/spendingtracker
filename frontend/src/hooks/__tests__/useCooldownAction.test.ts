import { act,renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';

import useCooldownAction from '../useCooldownAction';

// Mock the useLocalStorage hook
jest.mock('hooks/useLocalStorage', () => ({
    __esModule: true,
    default: jest.fn(({ initialValue }) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const [value, setValue] = useState(initialValue);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return [value, setValue];
    }),
}));

describe('useCooldownAction', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    describe('Initial State', () => {
        it('Should initialize with correct default values', () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            expect(result.current.loading).toBe(false);
            expect(result.current.isCooldownActive).toBe(false);
            expect(result.current.remainingSeconds).toBe(0);
            expect(typeof result.current.execute).toBe('function');
        });
    });

    describe('Action Execution', () => {
        it('Should execute action successfully and return result', async () => {
            const { result } = renderHook(() =>
                useCooldownAction<string>({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('success');

            let returnValue: string | undefined;
            await act(async () => {
                returnValue = await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(1);
            expect(returnValue).toBe('success');
        });

        it('Should set loading to true during execution', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest
                .fn()
                .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

            act(() => {
                void result.current.execute(mockAction);
            });

            expect(result.current.loading).toBe(true);

            await act(async () => {
                jest.advanceTimersByTime(100);
                await Promise.resolve(); // Flush promises
            });

            expect(result.current.loading).toBe(false);
        });

        it('Should set loading to false after execution completes', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.loading).toBe(false);
        });

        it('Should set loading to false even if action throws error', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockRejectedValue(new Error('Test error'));

            await act(async () => {
                try {
                    await result.current.execute(mockAction);
                } catch (_error) {
                    // Expected error
                }
            });

            expect(result.current.loading).toBe(false);
        });

        it('Should re-throw errors from the action', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const testError = new Error('Action failed');
            const mockAction = jest.fn().mockRejectedValue(testError);

            await expect(
                act(async () => {
                    await result.current.execute(mockAction);
                })
            ).rejects.toThrow('Action failed');
        });
    });

    describe('Cooldown Behavior', () => {
        it('Should activate cooldown after successful execution', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000, // 1 minute
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.isCooldownActive).toBe(true);
            expect(result.current.remainingSeconds).toBe(60);
        });

        it('Should countdown remaining seconds correctly', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.remainingSeconds).toBe(60);

            act(() => {
                jest.advanceTimersByTime(10000); // 10 seconds
            });

            await waitFor(() => {
                expect(result.current.remainingSeconds).toBe(50);
            });

            act(() => {
                jest.advanceTimersByTime(20000); // 20 more seconds
            });

            await waitFor(() => {
                expect(result.current.remainingSeconds).toBe(30);
            });
        });

        it('Should clear cooldown when time expires', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 5000, // 5 seconds for faster test
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.isCooldownActive).toBe(true);

            act(() => {
                jest.advanceTimersByTime(5000);
            });

            await waitFor(() => {
                expect(result.current.isCooldownActive).toBe(false);
                expect(result.current.remainingSeconds).toBe(0);
            });
        });

        it('Should prevent execution during cooldown', async () => {
            const { result } = renderHook(() =>
                useCooldownAction<string>({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            // First execution
            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(1);

            // Try to execute during cooldown
            let secondResult: string | undefined;
            await act(async () => {
                secondResult = await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(1); // Still only called once
            expect(secondResult).toBeUndefined();
        });

        it('Should allow execution after cooldown expires', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 5000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            // First execution
            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(1);

            // Wait for cooldown to expire
            act(() => {
                jest.advanceTimersByTime(5000);
            });

            await waitFor(() => {
                expect(result.current.isCooldownActive).toBe(false);
            });

            // Second execution should work
            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(2);
        });
    });

    describe('Loading State Prevention', () => {
        it('Should prevent concurrent executions', async () => {
            const { result } = renderHook(() =>
                useCooldownAction<string>({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest
                .fn()
                .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

            // Start first execution
            act(() => {
                void result.current.execute(mockAction);
            });

            await waitFor(() => {
                expect(result.current.loading).toBe(true);
            });

            // Try to start second execution while first is running
            let secondResult: string | undefined;
            await act(async () => {
                secondResult = await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(1);
            expect(secondResult).toBeUndefined();

            // Complete first execution
            await act(async () => {
                jest.advanceTimersByTime(100);
                await Promise.resolve();
            });

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });
    });

    describe('Different Cooldown Durations', () => {
        it('Should handle short cooldowns correctly', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 1000, // 1 second
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.remainingSeconds).toBe(1);

            act(() => {
                jest.advanceTimersByTime(1000);
            });

            await waitFor(() => {
                expect(result.current.isCooldownActive).toBe(false);
            });
        });

        it('Should handle long cooldowns correctly', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 600000, // 10 minutes
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.remainingSeconds).toBe(600);

            act(() => {
                jest.advanceTimersByTime(300000); // 5 minutes
            });

            await waitFor(() => {
                expect(result.current.remainingSeconds).toBe(300);
                expect(result.current.isCooldownActive).toBe(true);
            });
        });
    });

    describe('Type Safety', () => {
        it('Should handle typed return values correctly', async () => {
            interface TestData {
                id: number;
                name: string;
            }

            const { result } = renderHook(() =>
                useCooldownAction<TestData>({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockData: TestData = { id: 1, name: 'Test' };
            const mockAction = jest.fn().mockResolvedValue(mockData);

            let returnValue: TestData | undefined;
            await act(async () => {
                returnValue = await result.current.execute(mockAction);
            });

            expect(returnValue).toEqual(mockData);
        });

        it('Should handle void return type', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue(undefined);

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalled();
        });
    });

    describe('Real-world Usage Scenarios', () => {
        it('Should handle CSV export scenario', async () => {
            const { result } = renderHook(() =>
                useCooldownAction<Blob>({
                    cooldownMs: 60000, // 1 minute cooldown
                    storageKey: 'csvExportCooldown',
                })
            );

            const mockBlob = new Blob(['csv,data'], { type: 'text/csv' });
            const mockExportAction = jest.fn().mockResolvedValue(mockBlob);

            // First export succeeds
            let blob: Blob | undefined;
            await act(async () => {
                blob = await result.current.execute(mockExportAction);
            });

            expect(blob).toEqual(mockBlob);
            expect(result.current.isCooldownActive).toBe(true);

            // User tries to export again immediately - blocked
            await act(async () => {
                blob = await result.current.execute(mockExportAction);
            });

            expect(mockExportAction).toHaveBeenCalledTimes(1);
            expect(blob).toBeUndefined();
        });

        it('Should handle API rate limiting scenario', async () => {
            const { result } = renderHook(() =>
                useCooldownAction<{ data: string }>({
                    cooldownMs: 5000, // 5 second rate limit
                    storageKey: 'apiRateLimit',
                })
            );

            const mockApiCall = jest.fn().mockResolvedValue({ data: 'api response' });

            // Make API call
            await act(async () => {
                await result.current.execute(mockApiCall);
            });

            expect(result.current.remainingSeconds).toBe(5);

            // Wait 3 seconds - still on cooldown
            act(() => {
                jest.advanceTimersByTime(3000);
            });

            await waitFor(() => {
                expect(result.current.isCooldownActive).toBe(true);
                expect(result.current.remainingSeconds).toBe(2);
            });

            // Try again - blocked
            await act(async () => {
                await result.current.execute(mockApiCall);
            });

            expect(mockApiCall).toHaveBeenCalledTimes(1);

            // Wait remaining time
            act(() => {
                jest.advanceTimersByTime(2000);
            });

            await waitFor(() => {
                expect(result.current.isCooldownActive).toBe(false);
            });

            // Now can call again
            await act(async () => {
                await result.current.execute(mockApiCall);
            });

            expect(mockApiCall).toHaveBeenCalledTimes(2);
        });

        it('Should handle failed action without starting cooldown', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest
                .fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce('success');

            // First attempt fails
            await act(async () => {
                try {
                    await result.current.execute(mockAction);
                } catch (_error) {
                    // Expected
                }
            });

            // Cooldown should NOT be active after failure
            expect(result.current.isCooldownActive).toBe(false);

            // Can immediately retry
            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(2);
            // Cooldown should be active after success
            expect(result.current.isCooldownActive).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('Should handle rapid successive calls gracefully', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest
                .fn()
                .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));

            // Fire first call
            act(() => {
                void result.current.execute(mockAction);
            });

            // Wait for loading to be set
            await waitFor(() => {
                expect(result.current.loading).toBe(true);
            });

            // Try to fire more calls while loading
            await act(async () => {
                await result.current.execute(mockAction);
                await result.current.execute(mockAction);
            });

            // Complete the first call
            await act(async () => {
                jest.advanceTimersByTime(100);
                await Promise.resolve();
            });

            // Only first one should have executed
            expect(mockAction).toHaveBeenCalledTimes(1);
        });

        it('Should handle zero cooldown correctly', async () => {
            const { result } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 0,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            await act(async () => {
                await result.current.execute(mockAction);
            });

            // Should immediately be available again
            expect(result.current.isCooldownActive).toBe(false);

            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(mockAction).toHaveBeenCalledTimes(2);
        });
    });

    describe('Cleanup', () => {
        it('Should cleanup interval on unmount with active cooldown', async () => {
            const { result, unmount } = renderHook(() =>
                useCooldownAction({
                    cooldownMs: 60000,
                    storageKey: 'test-cooldown',
                })
            );

            const mockAction = jest.fn().mockResolvedValue('done');

            // Start a cooldown so interval gets created
            await act(async () => {
                await result.current.execute(mockAction);
            });

            expect(result.current.isCooldownActive).toBe(true);

            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

            unmount();

            expect(clearIntervalSpy).toHaveBeenCalled();

            clearIntervalSpy.mockRestore();
        });
    });
});
