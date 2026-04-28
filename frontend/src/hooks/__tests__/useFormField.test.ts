import { act, renderHook, waitFor } from '@testing-library/react';
import useFormField from 'hooks/useFormField';
import type { ChangeEvent, FocusEvent } from 'react';

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

    describe('isDirty', () => {
        it('Should be false on initialization', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            expect(result.current.isDirty).toBe(false);
        });

        it('Should be true when value differs from baseline', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.handleChange(createMockChangeEvent('changed'));
            });

            expect(result.current.isDirty).toBe(true);
        });

        it('Should be false when value is changed back to baseline', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.handleChange(createMockChangeEvent('changed'));
            });
            expect(result.current.isDirty).toBe(true);

            act(() => {
                result.current.handleChange(createMockChangeEvent('initial'));
            });
            expect(result.current.isDirty).toBe(false);
        });

        it('Should be false after reset', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.handleChange(createMockChangeEvent('changed'));
            });
            expect(result.current.isDirty).toBe(true);

            act(() => {
                result.current.reset();
            });
            expect(result.current.isDirty).toBe(false);
        });

        it('Should be false after resetTo with same value', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.handleChange(createMockChangeEvent('changed'));
            });
            act(() => {
                result.current.resetTo('changed');
            });

            expect(result.current.isDirty).toBe(false);
        });

        it('Should use new baseline after resetTo', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.resetTo('saved');
            });

            // Changing back to original initial value is now dirty
            act(() => {
                result.current.handleChange(createMockChangeEvent('initial'));
            });
            expect(result.current.isDirty).toBe(true);

            // New baseline is 'saved'
            act(() => {
                result.current.handleChange(createMockChangeEvent('saved'));
            });
            expect(result.current.isDirty).toBe(false);
        });
    });

    describe('resetTo', () => {
        it('Should update value to the new value', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.resetTo('new-baseline');
            });

            expect(result.current.value).toBe('new-baseline');
        });

        it('Should clear errors', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'ab', validator: mockValidator }));

            act(() => {
                result.current.handleBlur(createMockBlurEvent('ab'));
            });
            expect(result.current.error).toBe('Value must be at least 3 characters');

            act(() => {
                result.current.resetTo('valid value');
            });
            expect(result.current.error).toBeNull();
        });

        it('Should update the baseline so reset goes to the new value', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.resetTo('saved-value');
            });

            // Change the value
            act(() => {
                result.current.handleChange(createMockChangeEvent('something else'));
            });
            expect(result.current.value).toBe('something else');

            // Reset should go back to new baseline not original initial value
            act(() => {
                result.current.reset();
            });
            expect(result.current.value).toBe('saved-value');
        });

        it('Should cancel pending debounce', () => {
            const { result } = renderHook(() =>
                useFormField({ initialValue: 'initial', validator: mockValidator, debounceDelay: 750 })
            );

            act(() => {
                result.current.handleChange(createMockChangeEvent('ab'));
            });

            act(() => {
                jest.advanceTimersByTime(500);
                result.current.resetTo('saved-value');
            });

            act(() => {
                jest.advanceTimersByTime(500);
            });

            // Validator should not fire after resetTo cancelled the debounce
            expect(mockValidator).not.toHaveBeenCalled();
            expect(result.current.value).toBe('saved-value');
        });

        it('Should mark field as not dirty after resetTo', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'initial', validator: mockValidator }));

            act(() => {
                result.current.handleChange(createMockChangeEvent('changed'));
            });
            expect(result.current.isDirty).toBe(true);

            act(() => {
                result.current.resetTo('changed');
            });
            expect(result.current.isDirty).toBe(false);
        });

        it('Calling resetTo then reset returns to the resetTo value not the original initial', () => {
            const { result } = renderHook(() => useFormField({ initialValue: 'original', validator: mockValidator }));

            act(() => {
                result.current.resetTo('after-save');
            });
            act(() => {
                result.current.handleChange(createMockChangeEvent('modified'));
            });
            act(() => {
                result.current.reset();
            });

            expect(result.current.value).toBe('after-save');
        });
    });
});
