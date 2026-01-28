import { renderHook, act, waitFor } from '@testing-library/react';
import type { ChangeEvent, FocusEvent } from 'react';
import useFormField from 'hooks/useFormField';

describe('useFormField', () => {
    let mockValidator: jest.Mock;

    const createMockChangeEvent = (value: string): ChangeEvent<HTMLInputElement> =>
        ({
            target: { value },
        }) as ChangeEvent<HTMLInputElement>;

    const createMockBlurEvent = (value: string): FocusEvent<HTMLInputElement> =>
        ({
            target: { value },
        }) as FocusEvent<HTMLInputElement>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        jest.useFakeTimers();

        mockValidator = jest.fn((value: string) => {
            if (value.length < 3) return 'Value must be at least 3 characters';
            if (value.includes('invalid')) return 'Value contains invalid text';
            return null;
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('Should initialize with initial value and no error', async () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'test',
                validator: mockValidator,
            })
        );

        await waitFor(() => {
            expect(result.current.value).toBe('test');
        });

        expect(result.current.error).toBeNull();
    });

    it('Should update value on handleChange', async () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: '',
                validator: mockValidator,
                debounceDelay: 0, // no debounce
            })
        );

        await waitFor(() => {
            expect(result.current.value).toBe('');
        });

        act(() => {
            result.current.handleChange(createMockChangeEvent('new value'));
        });

        await waitFor(() => {
            expect(result.current.value).toBe('new value');
        });

        expect(result.current.error).toBeNull();
    });

    it('Should debounce validation on handleChange', async () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: '',
                validator: mockValidator,
                debounceDelay: 100,
            })
        );

        await waitFor(() => {
            expect(result.current.value).toBe('');
        });

        act(() => {
            result.current.handleChange(createMockChangeEvent('ab'));
        });

        // Value should update immediately
        await waitFor(() => {
            expect(result.current.value).toBe('ab');
        });

        // Validation should not run immediately
        expect(mockValidator).not.toHaveBeenCalled();
        expect(result.current.error).toBeNull();

        // Advance timers and wait for state update
        act(() => {
            jest.advanceTimersByTime(100);
        });

        expect(mockValidator).toHaveBeenCalledWith('ab');
        expect(result.current.error).toBe('Value must be at least 3 characters');
    });

    it('Should cancel previous debounced validation when typing quickly', () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: '',
                validator: mockValidator,
                debounceDelay: 750,
            })
        );

        // Type multiple times quickly
        act(() => {
            result.current.handleChange(createMockChangeEvent('a'));
        });

        act(() => {
            jest.advanceTimersByTime(500);
        });

        act(() => {
            result.current.handleChange(createMockChangeEvent('ab'));
        });

        act(() => {
            jest.advanceTimersByTime(500);
        });

        act(() => {
            result.current.handleChange(createMockChangeEvent('abc'));
        });

        // Fast-forward to complete the last debounce
        act(() => {
            jest.advanceTimersByTime(750);
        });

        // Validator should only be called once with the final value
        expect(mockValidator).toHaveBeenCalledTimes(1);
        expect(mockValidator).toHaveBeenCalledWith('abc');
        expect(result.current.error).toBeNull();
    });

    it('Should validate immediately on handleBlur', () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'ab',
                validator: mockValidator,
                debounceDelay: 100000,
            })
        );

        act(() => {
            result.current.handleBlur(createMockBlurEvent('ab'));
        });

        expect(mockValidator).toHaveBeenCalledWith('ab');
        expect(result.current.error).toBe('Value must be at least 3 characters');
    });

    it('Should cancel debounced validation on blur', () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: '',
                validator: mockValidator,
                debounceDelay: 750,
            })
        );

        // Start typing
        act(() => {
            result.current.handleChange(createMockChangeEvent('abcd'));
        });

        // Blur before debounce completes
        act(() => {
            jest.advanceTimersByTime(500);
            result.current.handleBlur(createMockBlurEvent('ab'));
        });

        // Fast-forward past original debounce time
        act(() => {
            jest.advanceTimersByTime(500);
        });

        // Validator should only be called once (from blur, not from debounce)
        expect(mockValidator).toHaveBeenCalledTimes(1);
        expect(mockValidator).toHaveBeenCalledWith('ab');
        expect(result.current.error).toBe('Value must be at least 3 characters');
    });

    it('Should validate field manually with validateField', () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'invalid text',
                validator: mockValidator,
            })
        );

        let errorMessage: string | null;
        act(() => {
            errorMessage = result.current.validateField();
        });

        expect(mockValidator).toHaveBeenCalledWith('invalid text');
        expect(errorMessage!).toBe('Value contains invalid text'); // ! non-null assertion operator
        expect(result.current.error).toBe('Value contains invalid text');
    });

    it('Should return null when validation passes', () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'valid value',
                validator: mockValidator,
            })
        );

        let errorMessage: string | null = '';
        act(() => {
            errorMessage = result.current.validateField();
        });

        expect(errorMessage).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Should reset to initial value and clear error', async () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'initial',
                validator: mockValidator,
            })
        );

        // Change value and add error
        act(() => {
            result.current.handleChange(createMockChangeEvent('ab'));
        });

        act(() => {
            jest.advanceTimersByTime(750);
        });

        await waitFor(() => {
            expect(result.current.error).toBe('Value must be at least 3 characters');
        });

        // Reset
        act(() => {
            result.current.reset();
        });

        expect(result.current.value).toBe('initial');
        expect(result.current.error).toBeNull();
    });

    it('Should clear pending debounce on reset', () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'initial',
                validator: mockValidator,
                debounceDelay: 750,
            })
        );

        // Start typing
        act(() => {
            result.current.handleChange(createMockChangeEvent('ab'));
        });

        // Reset before debounce completes
        act(() => {
            jest.advanceTimersByTime(500);
            result.current.reset();
        });

        // Fast-forward past original debounce time
        act(() => {
            jest.advanceTimersByTime(500);
        });

        // Validator should not be called after reset
        expect(mockValidator).not.toHaveBeenCalled();
        expect(result.current.value).toBe('initial');
        expect(result.current.error).toBeNull();
    });

    it('Should handle custom debounce delay', async () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: '',
                validator: mockValidator,
                debounceDelay: 1000,
            })
        );

        act(() => {
            result.current.handleChange(createMockChangeEvent('ab'));
        });

        act(() => {
            jest.advanceTimersByTime(750);
        });

        expect(mockValidator).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(250);
        });

        await waitFor(() => {
            expect(mockValidator).toHaveBeenCalledWith('ab');
        });
    });

    it('Should cleanup debounce on unmount', () => {
        const { result, unmount } = renderHook(() =>
            useFormField({
                initialValue: '',
                validator: mockValidator,
                debounceDelay: 750,
            })
        );

        act(() => {
            result.current.handleChange(createMockChangeEvent('ab'));
        });

        unmount();

        act(() => {
            jest.advanceTimersByTime(750);
        });

        // Validator should not be called after unmount
        expect(mockValidator).not.toHaveBeenCalled();
    });

    it('Should handle empty string validation', async () => {
        const { result } = renderHook(() =>
            useFormField({
                initialValue: 'test',
                validator: mockValidator,
            })
        );

        act(() => {
            result.current.handleChange(createMockChangeEvent(''));
        });

        act(() => {
            jest.advanceTimersByTime(750);
        });

        await waitFor(() => {
            expect(result.current.error).toBe('Value must be at least 3 characters');
        });
    });
});
