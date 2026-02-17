import { debounce } from '@mui/material/utils';
import type { ChangeEvent, Dispatch, FocusEvent,SetStateAction } from 'react';
import { useCallback, useEffect,useMemo, useRef, useState } from 'react';

interface FormField {
    initialValue: string;
    validator: (value: string) => string | null;
    debounceDelay?: number;
}

interface UseFormFieldReturn {
    value: string;
    error: string | null;
    handleChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    handleBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    validateField: () => string | null;
    reset: () => void;
    setValue: Dispatch<SetStateAction<string>>;
}

/**
 * Generic form field wrapper
 * validates the field against the validator after the user stops entering value
 * Returns functions to use the validator and update the internal state
 * @initialValue - initial field value
 * @validator synchronous validator that returns an error message or null
 * @debounceDelay - milliseconds to debounce validation
 */
export default function useFormField({ initialValue, validator, debounceDelay = 1000 }: FormField): UseFormFieldReturn {
    const [value, setValue] = useState<string>(initialValue);
    const [error, setError] = useState<string | null>(null);

    /**
     * Keep track of reference to inline lambda validator - avoid re-memoizing on subsequent calls if function did not actually change
     */
    const validatorRef = useRef(validator);

    useEffect(() => {
        validatorRef.current = validator;
    }, [validator]);

    /**
     * Only validate the field after user has stopped typing
     */
    const debounceValidate = useMemo(
        () =>
            // eslint-disable-next-line react-hooks/refs
            debounce((value: string) => {
                setError(validatorRef.current(value));
            }, debounceDelay),
        [debounceDelay]
    );

    /**
     * Clear pending calls on unmount
     */
    useEffect(() => {
        return () => {
            debounceValidate.clear();
        };
    }, [debounceValidate]);

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = event.target.value;
            setValue(value);
            debounceValidate(value);
        },
        [debounceValidate]
    );

    const handleBlur = useCallback(
        (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const value = event.target.value;
            debounceValidate.clear();
            setError(validatorRef.current(value));
        },
        [debounceValidate]
    );

    /**
     * External caller to manually run validation on this field
     */
    const validateField = useCallback(() => {
        const errorMessage = validatorRef.current(value);
        setError(errorMessage);
        return errorMessage;
    }, [value]);

    /**
     * Reset the field to initial value
     */
    const reset = useCallback(() => {
        debounceValidate.clear();
        setValue(initialValue);
        setError(null);
    }, [initialValue, debounceValidate]);

    // Memoize the return object so it maintains referential stability
    return useMemo(
        () => ({ value, error, handleChange, handleBlur, validateField, reset, setValue }),
        [value, error, handleChange, handleBlur, validateField, reset]
    );
}
