import { renderHook, act } from '@testing-library/react';
import useLocalStorage from 'hooks/useLocalStorage';

describe('useLocalStorage hook', () => {
    const KEY = 'test-key';

    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(console, 'error').mockImplementation(() => {
            /*empty*/
        }); // Silence expected errors
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Should initialize with initialValue when no localStorage value exists', () => {
        const { result } = renderHook(() => useLocalStorage({ key: KEY, initialValue: 'default' }));

        const [storedValue] = result.current;
        expect(storedValue).toBe('default');
    });

    it('Should initialize from existing localStorage value', () => {
        localStorage.setItem(KEY, JSON.stringify('stored-value'));

        const { result } = renderHook(() => useLocalStorage({ key: KEY, initialValue: 'default' }));

        const [storedValue] = result.current;
        expect(storedValue).toBe('stored-value');
    });

    it('Should update localStorage when value changes', () => {
        const { result } = renderHook(() => useLocalStorage({ key: KEY, initialValue: 0 }));

        // Update the value
        act(() => {
            // Result.current = [storedValue, setStoredValue] (returned from useLocalStorage hook)
            // Array destructure to skip the first item and grab the setter function
            const [, setStoredValue] = result.current;
            setStoredValue(42);
        });

        expect(localStorage.getItem(KEY)).toBe('42');
    });

    it('Should handle JSON parse errors gracefully', () => {
        localStorage.setItem(KEY, '{bad json');

        const { result } = renderHook(() => useLocalStorage({ key: KEY, initialValue: 'fallback' }));

        const [storedValue] = result.current;
        expect(storedValue).toBe('fallback');
        expect(console.error).toHaveBeenCalled(); // logged parse error
    });

    it('Should update state when storage event occurs (same key)', () => {
        const { result } = renderHook(() => useLocalStorage({ key: KEY, initialValue: 'init' }));

        const event = new StorageEvent('storage', {
            key: KEY,
            newValue: JSON.stringify('updated-from-other-tab'),
        });

        act(() => {
            window.dispatchEvent(event);
        });

        const [storedValue] = result.current;
        expect(storedValue).toBe('updated-from-other-tab');
    });

    it('Should reset to initialValue when storage key is removed', () => {
        const { result } = renderHook(() => useLocalStorage({ key: KEY, initialValue: 'init' }));

        act(() => {
            window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: null }));
        });

        const [storedValue] = result.current;
        expect(storedValue).toBe('init');
    });

    it('Should use custom serializer and deserializer', () => {
        const serialize = jest.fn((v: string) => `wrapped:${v}`);
        const deserialize = jest.fn((v: string) => v.replace('wrapped:', ''));

        const { result } = renderHook(() =>
            useLocalStorage({
                key: KEY,
                initialValue: 'custom',
                serialize,
                deserialize,
            })
        );

        act(() => {
            const [, setStoredValue] = result.current;
            setStoredValue('new-value');
        });

        expect(serialize).toHaveBeenCalledWith('new-value');
        expect(localStorage.getItem(KEY)).toBe('wrapped:new-value');
    });
});
