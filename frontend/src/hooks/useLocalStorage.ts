import { useState, useEffect } from 'react';

// Generic interface for intitialValue
interface LocalStorage<T> {
    key: string;
    initialValue: T; // type for the state
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
}

/**
 * Stores a value in local storage - will sync across browsers and supports following options
 * @key local storage key
 * @initialValue
 * @serialize custom serializer before sending to local storage
 * @deserialize custom deserializer after reading from local storage and rehydrating to state
 * @returns
 */
export default function useLocalStorage<T>({
    key,
    initialValue,
    serialize = (value: T) => JSON.stringify(value),
    deserialize = (value: string): T => JSON.parse(value) as T,
}: LocalStorage<T>) {
    // Attempt to load local storage value on mount
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? deserialize(item) : initialValue;
        } catch (err: unknown) {
            console.error(`Error reading value for key "${key}":`, err);
            return initialValue;
        }
    });

    /**
     * Update local storage whenever value changes
     */
    useEffect(() => {
        try {
            localStorage.setItem(key, serialize(storedValue));
        } catch (err: unknown) {
            console.error(err);
        }
    }, [key, storedValue, serialize]);

    /**
     * Listen for changes in other tabs/windows and sync changes
     */
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            // Only respond to changes to our specific key
            if (e.key === key && e.newValue !== null) {
                try {
                    setStoredValue(deserialize(e.newValue));
                } catch (error) {
                    console.error(`Error parsing storage event for key "${key}":`, error);
                }
            }
            // Handle deletion
            if (e.key === key && e.newValue === null) {
                setStoredValue(initialValue);
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [key, initialValue, deserialize]);

    /**
     * Match useState declaration
     */
    return [storedValue, setStoredValue] as const;
}
