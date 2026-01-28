import { renderHook, act } from '@testing-library/react';
import type { SyntheticEvent } from 'react';
import useCategorySelect from 'hooks/useCategorySelect';
import type { SelectOptionType } from 'types/SelectOption.type';

describe('useCategorySelect', () => {
    const mockValidator = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Should initialize with the provided initial value and no error', () => {
        const { result } = renderHook(() => useCategorySelect({ initialValue: 'cat1', validator: mockValidator }));

        expect(result.current.value).toBe('cat1');
        expect(result.current.error).toBeNull();
    });

    it('Should update value and validate on handleChange', () => {
        const mockOption: SelectOptionType = { label: 'Category 2', value: 'cat2' };
        mockValidator.mockReturnValueOnce(null);

        const { result } = renderHook(() => useCategorySelect({ initialValue: 'cat1', validator: mockValidator }));

        act(() => {
            result.current.handleChange({} as SyntheticEvent<Element, Event>, mockOption);
        });

        expect(result.current.value).toBe('cat2');
        expect(mockValidator).toHaveBeenCalledWith('cat2');
        expect(result.current.error).toBeNull();
    });

    it('Should handleChange with null option', () => {
        mockValidator.mockReturnValueOnce('Invalid');

        const { result } = renderHook(() => useCategorySelect({ initialValue: 'cat1', validator: mockValidator }));

        act(() => {
            result.current.handleChange({} as SyntheticEvent<Element, Event>, null);
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBe('Invalid');
    });

    it('should validate field manually with validateField', () => {
        mockValidator.mockReturnValueOnce('Required');

        const { result } = renderHook(() => useCategorySelect({ initialValue: '', validator: mockValidator }));

        let error: string | null;
        act(() => {
            error = result.current.validateField();
        });

        expect(mockValidator).toHaveBeenCalledWith('');
        expect(error!).toBe('Required');
        expect(result.current.error).toBe('Required');
    });

    it('Should reset to initial value and clear error', () => {
        const { result } = renderHook(() => useCategorySelect({ initialValue: 'initial', validator: mockValidator }));

        act(() => {
            result.current.handleChange({} as SyntheticEvent<Element, Event>, { label: 'New', value: 'new' });
        });

        expect(result.current.value).toBe('new');

        act(() => {
            result.current.reset();
        });

        expect(result.current.value).toBe('initial');
        expect(result.current.error).toBeNull();
    });
});
