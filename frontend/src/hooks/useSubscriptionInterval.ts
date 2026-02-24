import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface SubscriptionInterval {
    initialInterval: string | null;
    validator: (value: string | null, isSubscription: boolean) => string | null;
}

export default function useSubscriptionInterval({ initialInterval, validator }: SubscriptionInterval) {
    const [isSubscription, setIsSubscription] = useState<boolean>(initialInterval !== null);
    const [interval, setInterval] = useState<string | null>(initialInterval);
    const [error, setError] = useState<string | null>(null);

    // Is subscription toggles whether the interval option is display
    // Interval is not required when there's no subscription

    // Validator isn't memoized - keep stable reference to the validator function
    const validatorRef = useRef(validator);
    useEffect(() => {
        validatorRef.current = validator;
    }, [validator]);

    const handleSubscriptionChange = useCallback((_event: ChangeEvent<HTMLInputElement>, checked: boolean) => {
        setIsSubscription(checked);
        if (!checked) {
            // Clear the interval when unchecked
            setInterval(null);
            setError(null);
        }
    }, []);

    const handleIntervalChange = useCallback(
        (_event: ChangeEvent<HTMLInputElement>, value: string) => {
            setInterval(value);
            setError(validatorRef.current(value, isSubscription));
        },
        [isSubscription]
    );

    // External caller to manually run validation on this field
    const validateField = useCallback(() => {
        const errorMessage = validatorRef.current(interval, isSubscription);
        setError(errorMessage);
        return errorMessage;
    }, [isSubscription, interval]);

    const reset = useCallback(() => {
        setIsSubscription(initialInterval !== null);
        setInterval(initialInterval);
        setError(null);
    }, [initialInterval]);

    return {
        isSubscription,
        interval,
        error,
        handleSubscriptionChange,
        handleIntervalChange,
        validateField,
        reset,
    };
}
