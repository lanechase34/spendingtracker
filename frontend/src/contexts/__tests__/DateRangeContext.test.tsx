import { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import { DateRangeContext, DateRangeContextProvider } from 'contexts/DateRangeContext';
import dayjs from 'dayjs';
import type { Dispatch, SetStateAction } from 'react';

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

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('Provides default startDate, endDate, and formatted values', () => {
        /**
         * Mock component listing out startDate, endDate, and formatted values
         */
        const TestComponent = () => {
            const context = useContext(DateRangeContext);
            if (!context) throw new Error('Context not found');

            return (
                <div>
                    <span data-testid="startDate">{context.startDate.toISOString()}</span>
                    <span data-testid="endDate">{context.endDate.toISOString()}</span>
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

        /**
         * Default range is first day of curr month -> last day of curr month
         */
        const startOfMonth = currDate.startOf('month').toISOString();
        const endOfMonth = currDate.endOf('month').toISOString();

        expect(screen.getByTestId('startDate').textContent).toBe(startOfMonth);
        expect(screen.getByTestId('endDate').textContent).toBe(endOfMonth);
        expect(screen.getByTestId('formattedStart').textContent).toBe(currDate.startOf('month').format('MM-DD-YYYY'));
        expect(screen.getByTestId('formattedEnd').textContent).toBe(currDate.endOf('month').format('MM-DD-YYYY'));
        expect(screen.getByTestId('shortStart').textContent).toBe(currDate.startOf('month').format('YYYY-MM'));
        expect(screen.getByTestId('shortEnd').textContent).toBe(currDate.endOf('month').format('YYYY-MM'));
    });

    it('Allows calling dateFormat directly from context', () => {
        const TestComponent = () => {
            const context = useContext(DateRangeContext);
            if (!context) throw new Error('Context not found');

            return <span data-testid="customFormat">{context.dateFormat(context.startDate, 'DD/MM/YYYY')}</span>;
        };

        render(
            <DateRangeContextProvider>
                <TestComponent />
            </DateRangeContextProvider>
        );

        expect(screen.getByTestId('customFormat').textContent).toBe(currDate.startOf('month').format('DD/MM/YYYY'));
    });

    it('Throws error if context is used outside provider', () => {
        const TestComponent = () => {
            const context = useContext(DateRangeContext);
            if (!context) throw new Error('Context not found');
            return <div>Should not render</div>;
        };

        expect(() => render(<TestComponent />)).toThrow('Context not found');
    });

    it('Calls setStartDate and setEndDate correctly', () => {
        const mockStartSetter = jest.fn();
        const mockEndSetter = jest.fn();
        mockUseLocalStorage.mockImplementationOnce(() => [currDate.startOf('month'), mockStartSetter]);
        mockUseLocalStorage.mockImplementationOnce(() => [currDate.endOf('month'), mockEndSetter]);

        const TestComponent = () => {
            const context = useContext(DateRangeContext);
            if (!context) throw new Error('Context not found');

            context.setStartDate(currDate.add(1, 'day'));
            context.setEndDate(currDate.add(2, 'day'));

            return <div>Set functions called</div>;
        };

        render(
            <DateRangeContextProvider>
                <TestComponent />
            </DateRangeContextProvider>
        );

        expect(mockStartSetter).toHaveBeenCalledWith(currDate.add(1, 'day'));
        expect(mockEndSetter).toHaveBeenCalledWith(currDate.add(2, 'day'));
    });
});
