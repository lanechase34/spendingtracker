import { useState, useCallback } from 'react';
import type { SyntheticEvent } from 'react';
import type { SelectOptionType } from 'types/SelectOption.type';

interface CategorySelect {
    initialValue: string | number | null;
    validator: (value: string | number | null) => string | null;
}

interface UseCategorySelectReturn {
    value: string | number | null;
    error: string | null;
    handleChange: (event: SyntheticEvent<Element, Event>, option: SelectOptionType | null) => void;
    validateField: () => string | null;
    reset: () => void;
}

/**
 * @initialValue initial value for the category select
 * @validator custom validator function. returns null if valid, any string means error
 * returns safe value, error fields
 * and handleChange a safe validator and a reset handler using the supplied initialValues and validator
 */
export default function useCategorySelect({ initialValue, validator }: CategorySelect): UseCategorySelectReturn {
    const [value, setValue] = useState<string | number | null>(initialValue);
    const [error, setError] = useState<string | null>(null);

    const handleChange = useCallback(
        (event: SyntheticEvent<Element, Event>, option: SelectOptionType | null) => {
            const selectedValue = option?.value ?? null;
            setValue(selectedValue);
            setError(validator(selectedValue));
        },
        [validator]
    );

    // External caller to manually run validation on this field
    const validateField = useCallback(() => {
        const errorMessage = validator(value);
        setError(errorMessage);
        return errorMessage;
    }, [validator, value]);

    const reset = () => {
        setValue(initialValue);
        setError(null);
    };

    return { value, error, handleChange, validateField, reset };
}
