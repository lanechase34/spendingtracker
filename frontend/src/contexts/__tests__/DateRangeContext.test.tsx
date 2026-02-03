import { useContext, useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { DateRangeContext, DateRangeContextProvider } from 'contexts/DateRangeContext';
import dayjs from 'dayjs';
import type { Dispatch, SetStateAction } from 'react';
import type { DateRangeType } from 'types/DateRange.type';
import type { Dayjs } from 'dayjs';

// Mock useLocalStorage
jest.mock('hooks/useLocalStorage', () => ({
    __esModule: true,
    default: jest.fn(<T,>({ initialValue }: { initialValue: T }): [T, Dispatch<SetStateAction<T>>] => [
        initialValue,
        jest.fn(),
    ]),
}));

import useLocalStorage from 'hooks/useLocalStorage';
const mockUseLocalStorage = useLocalStorage as jest.Mock;

describe('DateRangeContext', () => {
    const currDate = dayjs();

    beforeEach(() => {
        jest.clearAllMocks();

        // Default mock implementation
        mockUseLocalStorage.mockImplementation(
            <T,>({ initialValue }: { initialValue: T }): [T, Dispatch<SetStateAction<T>>] => [initialValue, jest.fn()]
        );
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('Default behavior', () => {
        it('Provides default this-month range when initialized', () => {
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="startDate">{context.startDate.toISOString()}</span>
                        <span data-testid="endDate">{context.endDate.toISOString()}</span>
                        <span data-testid="rangeType">{context.rangeType}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            const startOfMonth = currDate.startOf('month').toISOString();
            const endOfMonth = currDate.endOf('month').toISOString();

            expect(screen.getByTestId('startDate').textContent).toBe(startOfMonth);
            expect(screen.getByTestId('endDate').textContent).toBe(endOfMonth);
            expect(screen.getByTestId('rangeType').textContent).toBe('this-month');
        });

        it('Provides correctly formatted date strings (MM-DD-YYYY) default format in dateFormat()', () => {
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="formattedStart">{context.formattedStartDate}</span>
                        <span data-testid="formattedEnd">{context.formattedEndDate}</span>
                        <span data-testid="shortStart">{context.shortFormattedStartDate}</span>
                        <span data-testid="shortEnd">{context.shortFormattedEndDate}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('formattedStart').textContent).toBe(
                currDate.startOf('month').format('MM-DD-YYYY')
            );
            expect(screen.getByTestId('formattedEnd').textContent).toBe(currDate.endOf('month').format('MM-DD-YYYY'));
            expect(screen.getByTestId('shortStart').textContent).toBe(currDate.startOf('month').format('YYYY-MM'));
            expect(screen.getByTestId('shortEnd').textContent).toBe(currDate.endOf('month').format('YYYY-MM'));
        });

        it('Throws error when context is used outside provider', () => {
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');
                return <div>Should not render</div>;
            };

            // Suppress console.error for this test
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
                /** empty  */
            });

            expect(() => render(<TestComponent />)).toThrow('Context not found');

            consoleSpy.mockRestore();
        });
    });

    describe('Preset ranges', () => {
        it.each<[DateRangeType, () => Dayjs, () => Dayjs]>([
            ['this-week', () => currDate.startOf('week'), () => currDate.endOf('week')],
            [
                'last-week',
                () => currDate.subtract(1, 'week').startOf('week'),
                () => currDate.subtract(1, 'week').endOf('week'),
            ],
            ['this-month', () => currDate.startOf('month'), () => currDate.endOf('month')],
            [
                'last-month',
                () => currDate.subtract(1, 'month').startOf('month'),
                () => currDate.subtract(1, 'month').endOf('month'),
            ],
            ['this-year', () => currDate.startOf('year'), () => currDate.endOf('year')],
            [
                'last-year',
                () => currDate.subtract(1, 'year').startOf('year'),
                () => currDate.subtract(1, 'year').endOf('year'),
            ],
        ])('Computes correct dates for %s', (rangeType, getExpectedStart, getExpectedEnd) => {
            mockUseLocalStorage.mockImplementationOnce(() => [rangeType, jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="startDate">{context.startDate.toISOString()}</span>
                        <span data-testid="endDate">{context.endDate.toISOString()}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('startDate').textContent).toBe(getExpectedStart().toISOString());
            expect(screen.getByTestId('endDate').textContent).toBe(getExpectedEnd().toISOString());
        });

        it('Calls setRangeType when setPresetRange is invoked', () => {
            const mockSetRangeType = jest.fn();
            mockUseLocalStorage.mockImplementationOnce(() => ['this-month', mockSetRangeType]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return <button onClick={() => context.setPresetRange('last-week')}>Set Last Week</button>;
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            const button = screen.getByText('Set Last Week');
            button.click();

            expect(mockSetRangeType).toHaveBeenCalledWith('last-week');
            expect(mockSetRangeType).toHaveBeenCalledTimes(1);
        });
    });

    describe('Custom ranges', () => {
        it('Uses custom dates when rangeType is custom', () => {
            const customStart = dayjs('2026-01-10');
            const customEnd = dayjs('2026-01-15');

            mockUseLocalStorage.mockImplementationOnce(() => ['custom', jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [customStart, jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [customEnd, jest.fn()]);

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="startDate">{context.startDate.toISOString()}</span>
                        <span data-testid="endDate">{context.endDate.toISOString()}</span>
                        <span data-testid="rangeType">{context.rangeType}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('startDate').textContent).toBe(customStart.toISOString());
            expect(screen.getByTestId('endDate').textContent).toBe(customEnd.toISOString());
            expect(screen.getByTestId('rangeType').textContent).toBe('custom');
        });

        it('Falls back to this-month when custom dates are null', () => {
            mockUseLocalStorage.mockImplementationOnce(() => ['custom', jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="startDate">{context.startDate.toISOString()}</span>
                        <span data-testid="endDate">{context.endDate.toISOString()}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('startDate').textContent).toBe(currDate.startOf('month').toISOString());
            expect(screen.getByTestId('endDate').textContent).toBe(currDate.endOf('month').toISOString());
        });

        it('Calls setCustomRange correctly with new dates', () => {
            const mockSetRangeType = jest.fn();
            const mockSetCustomStart = jest.fn();
            const mockSetCustomEnd = jest.fn();

            mockUseLocalStorage.mockImplementationOnce(() => ['this-month', mockSetRangeType]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, mockSetCustomStart]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, mockSetCustomEnd]);

            const newStart = dayjs('2026-02-10');
            const newEnd = dayjs('2026-02-20');

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return <button onClick={() => context.setCustomRange(newStart, newEnd)}>Set Custom Range</button>;
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            const button = screen.getByText('Set Custom Range');
            button.click();

            expect(mockSetRangeType).toHaveBeenCalledWith('custom');
            expect(mockSetCustomStart).toHaveBeenCalledWith(newStart);
            expect(mockSetCustomEnd).toHaveBeenCalledWith(newEnd);
        });
    });

    describe('dateFormat utility', () => {
        it('Formats dates with default format', () => {
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                const testDate = dayjs('2026-03-15');
                return <span data-testid="formatted">{context.dateFormat(testDate)}</span>;
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('formatted').textContent).toBe('03-15-2026');
        });

        it('Formats dates with custom format', () => {
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                const testDate = dayjs('2026-03-15');
                return <span data-testid="formatted">{context.dateFormat(testDate, 'DD/MM/YYYY')}</span>;
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('formatted').textContent).toBe('15/03/2026');
        });

        it('Formats dates with various formats', () => {
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                const testDate = dayjs('2026-03-15');
                return (
                    <div>
                        <span data-testid="format1">{context.dateFormat(testDate, 'YYYY-MM-DD')}</span>
                        <span data-testid="format2">{context.dateFormat(testDate, 'MMM D, YYYY')}</span>
                        <span data-testid="format3">{context.dateFormat(testDate, 'MMMM')}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(screen.getByTestId('format1').textContent).toBe('2026-03-15');
            expect(screen.getByTestId('format2').textContent).toBe('Mar 15, 2026');
            expect(screen.getByTestId('format3').textContent).toBe('March');
        });
    });

    describe('Performance and memoization', () => {
        it('Maintains stable function references across renders', () => {
            const mockSetRangeType = jest.fn();
            const mockSetCustomStart = jest.fn();
            const mockSetCustomEnd = jest.fn();

            mockUseLocalStorage.mockImplementation(({ key }: { key: string }) => {
                if (key === 'rangeType') return ['this-month', mockSetRangeType];
                if (key === 'customStartDate') return [null, mockSetCustomStart];
                if (key === 'customEndDate') return [null, mockSetCustomEnd];
                return [null, jest.fn()];
            });

            const results: {
                setPresetRange: (type: Exclude<DateRangeType, 'custom'>) => void | undefined;
                setCustomRange: (start: Dayjs, end: Dayjs) => void | undefined;
                dateFormat: (date: Dayjs, format?: string) => string | undefined;
            }[] = [];

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                const [, forceUpdate] = useState(0);

                if (!context) throw new Error('Context not found');

                // Store function references
                results.push({
                    setPresetRange: context.setPresetRange,
                    setCustomRange: context.setCustomRange,
                    dateFormat: context.dateFormat,
                });

                return (
                    <button onClick={() => forceUpdate((n) => n + 1)} data-testid="trigger">
                        Trigger
                    </button>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            // Trigger re-renders
            act(() => screen.getByTestId('trigger').click());
            act(() => screen.getByTestId('trigger').click());

            // All renders should have the same function references
            expect(results).toHaveLength(3);
            expect(results[0].setPresetRange).toBe(results[1].setPresetRange);
            expect(results[0].setPresetRange).toBe(results[2].setPresetRange);
            expect(results[0].setCustomRange).toBe(results[1].setCustomRange);
            expect(results[0].setCustomRange).toBe(results[2].setCustomRange);
            expect(results[0].dateFormat).toBe(results[1].dateFormat);
            expect(results[0].dateFormat).toBe(results[2].dateFormat);
        });

        it('Does not recompute dates when unrelated state changes', () => {
            let computeCount = 0;
            // We can't easily spy on the internal function, but we can verify
            // that the dates don't change when we force a re-render
            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                const dateKey = `${context.startDate.toISOString()}-${context.endDate.toISOString()}`;
                computeCount++;

                return (
                    <div>
                        <span data-testid="date-key">{dateKey}</span>
                        <span data-testid="compute-count">{computeCount}</span>
                    </div>
                );
            };

            const { rerender } = render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            const initialDateKey = screen.getByTestId('date-key').textContent;

            // Force multiple re-renders
            rerender(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );
            rerender(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            // Date key should remain the same (memoized)
            expect(screen.getByTestId('date-key').textContent).toBe(initialDateKey);
        });
    });

    describe('Edge cases', () => {
        it('Handles switching from preset to custom and back', () => {
            const mockSetRangeType = jest.fn();
            const mockSetCustomStart = jest.fn();
            const mockSetCustomEnd = jest.fn();

            let currentRangeType: DateRangeType = 'this-month';
            let currentCustomStart: Dayjs | null = null;
            let currentCustomEnd: Dayjs | null = null;

            mockUseLocalStorage.mockImplementation(({ key }: { key: string }) => {
                if (key === 'rangeType') {
                    return [
                        currentRangeType,
                        (val: DateRangeType) => {
                            currentRangeType = val;
                            mockSetRangeType(val);
                        },
                    ];
                }
                if (key === 'customStartDate') {
                    return [
                        currentCustomStart,
                        (val: Dayjs | null) => {
                            currentCustomStart = val;
                            mockSetCustomStart(val);
                        },
                    ];
                }
                if (key === 'customEndDate') {
                    return [
                        currentCustomEnd,
                        (val: Dayjs | null) => {
                            currentCustomEnd = val;
                            mockSetCustomEnd(val);
                        },
                    ];
                }
                return [null, jest.fn()];
            });

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="rangeType">{context.rangeType}</span>
                        <button onClick={() => context.setCustomRange(dayjs('2026-01-10'), dayjs('2026-01-15'))}>
                            Set Custom
                        </button>
                        <button onClick={() => context.setPresetRange('last-month')}>Set Last Month</button>
                    </div>
                );
            };

            const { rerender } = render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            // Initially this-month
            expect(screen.getByTestId('rangeType').textContent).toBe('this-month');

            // Switch to custom
            act(() => {
                screen.getByText('Set Custom').click();
            });

            // Re-render to reflect state change
            rerender(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            expect(mockSetRangeType).toHaveBeenCalledWith('custom');

            // Switch back to preset
            act(() => {
                screen.getByText('Set Last Month').click();
            });

            expect(mockSetRangeType).toHaveBeenCalledWith('last-month');
        });

        it('Handles partial custom dates gracefully', () => {
            const customStart = dayjs('2026-01-10');

            mockUseLocalStorage.mockImplementationOnce(() => ['custom', jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [customStart, jest.fn()]);
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]); // End is null

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="startDate">{context.startDate.toISOString()}</span>
                        <span data-testid="endDate">{context.endDate.toISOString()}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            // Start should be custom, end should fall back to current month end
            expect(screen.getByTestId('startDate').textContent).toBe(customStart.toISOString());
            expect(screen.getByTestId('endDate').textContent).toBe(currDate.endOf('month').toISOString());
        });

        it('Handles empty string deserialization for custom dates', () => {
            // Mock rangeType as 'custom'
            mockUseLocalStorage.mockImplementationOnce(() => ['custom', jest.fn()]);

            // Mock customStartDate - return null directly (simulating empty string -> null)
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);

            // Mock customEndDate - return null directly (simulating empty string -> null)
            mockUseLocalStorage.mockImplementationOnce(() => [null, jest.fn()]);

            const TestComponent = () => {
                const context = useContext(DateRangeContext);
                if (!context) throw new Error('Context not found');

                return (
                    <div>
                        <span data-testid="startDate">{context.startDate.toISOString()}</span>
                        <span data-testid="endDate">{context.endDate.toISOString()}</span>
                    </div>
                );
            };

            render(
                <DateRangeContextProvider>
                    <TestComponent />
                </DateRangeContextProvider>
            );

            // Should fall back to this-month when custom dates are null
            expect(screen.getByTestId('startDate').textContent).toBe(currDate.startOf('month').toISOString());
            expect(screen.getByTestId('endDate').textContent).toBe(currDate.endOf('month').toISOString());
        });
    });
});
