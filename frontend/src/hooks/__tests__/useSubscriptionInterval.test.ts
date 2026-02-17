import { act,renderHook } from '@testing-library/react';
import useSubscriptionInterval from 'hooks/useSubscriptionInterval';
import type { ChangeEvent } from 'react';

describe('useSubscriptionInterval', () => {
    let mockValidator: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockValidator = jest.fn((value: string | null, isSubscription: boolean) => {
            if (isSubscription && !value) return 'Interval required';
            if (value === 'invalid') return 'Invalid interval';
            return null;
        });
    });

    it('Initializes correctly when initialInterval is null', () => {
        const { result } = renderHook(() =>
            useSubscriptionInterval({ initialInterval: null, validator: mockValidator })
        );

        expect(result.current.isSubscription).toBe(false);
        expect(result.current.interval).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Initializes correctly when initialInterval has a value', () => {
        const { result } = renderHook(() =>
            useSubscriptionInterval({ initialInterval: 'monthly', validator: mockValidator })
        );

        expect(result.current.isSubscription).toBe(true);
        expect(result.current.interval).toBe('monthly');
        expect(result.current.error).toBeNull();
    });

    it('Handles subscription toggle correctly', () => {
        const { result } = renderHook(() =>
            useSubscriptionInterval({ initialInterval: 'weekly', validator: mockValidator })
        );

        act(() => {
            result.current.handleSubscriptionChange({} as ChangeEvent<HTMLInputElement>, false);
        });

        // Blanks the interval when no longer a subscription
        expect(result.current.isSubscription).toBe(false);
        expect(result.current.interval).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Updates interval and runs validation', () => {
        const { result } = renderHook(() =>
            useSubscriptionInterval({ initialInterval: null, validator: mockValidator })
        );

        act(() => {
            result.current.handleSubscriptionChange({} as ChangeEvent<HTMLInputElement>, true); // enable subscription
        });

        act(() => {
            result.current.handleIntervalChange({} as ChangeEvent<HTMLInputElement>, 'invalid');
        });

        expect(result.current.interval).toBe('invalid');
        expect(mockValidator).toHaveBeenCalledWith('invalid', true);
        expect(result.current.error).toBe('Invalid interval');
    });

    it('Should validate field manually with validateField', () => {
        const { result } = renderHook(() =>
            useSubscriptionInterval({ initialInterval: null, validator: mockValidator })
        );

        act(() => {
            result.current.handleSubscriptionChange({} as ChangeEvent<HTMLInputElement>, true);
            result.current.handleIntervalChange({} as ChangeEvent<HTMLInputElement>, '');
        });

        act(() => {
            const errorMessage = result.current.validateField();
            expect(errorMessage).toBe('Interval required');
        });

        expect(mockValidator).toHaveBeenCalledWith('', true);
        expect(result.current.error).toBe('Interval required');
    });

    it('Resets to initial values', () => {
        const { result } = renderHook(() =>
            useSubscriptionInterval({ initialInterval: 'weekly', validator: mockValidator })
        );

        // modify state
        act(() => {
            result.current.handleIntervalChange({} as ChangeEvent<HTMLInputElement>, 'invalid');
            result.current.handleSubscriptionChange({} as ChangeEvent<HTMLInputElement>, false);
        });

        expect(result.current.isSubscription).toBe(false);

        act(() => {
            result.current.reset();
        });

        expect(result.current.isSubscription).toBe(true);
        expect(result.current.interval).toBe('weekly');
        expect(result.current.error).toBeNull();
    });

    it('Uses updated validator when it changes', () => {
        const { rerender, result } = renderHook(
            ({ validator }) => useSubscriptionInterval({ initialInterval: null, validator }),
            {
                initialProps: {
                    validator: mockValidator,
                },
            }
        );

        const newValidator = jest.fn(() => 'new validator error');

        // simulate a change in validator function
        rerender({ validator: newValidator });

        act(() => {
            result.current.handleSubscriptionChange({} as ChangeEvent<HTMLInputElement>, true);
            result.current.handleIntervalChange({} as ChangeEvent<HTMLInputElement>, 'anything');
        });

        expect(newValidator).toHaveBeenCalled();
        expect(result.current.error).toBe('new validator error');
    });
});
