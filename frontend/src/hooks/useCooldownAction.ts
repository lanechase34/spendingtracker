import useLocalStorage from 'hooks/useLocalStorage';
import { useCallback, useEffect, useState } from 'react';

interface UseCooldownActionOptions {
    cooldownMs: number;
    storageKey: string;
}

interface UseCooldownActionReturn<T> {
    execute: (action: () => Promise<T>) => Promise<T | undefined>;
    loading: boolean;
    isCooldownActive: boolean;
    remainingSeconds: number;
}

/**
 * Hook to only allow action to be performed when cooldown has been passed
 * Cooldown persist across pages/refresh in localStorage
 *
 * @param {UseCooldownActionOptions} options - Configuration options
 * @param {number} options.cooldownMS - time in ms for cooldown to last
 * @param {string} options.storageKey - unique key to use for localstorage
 *
 * @returns {UseCooldownActionReturn<T>} return object
 * @returns {Function} returns.execute - wrapper for the calling request with cooldown enforcement
 * @returns {boolean} returns.loading - t/f request is currently loading
 * @returns {boolean} returns.isCooldownActive - t/f if the current cooldown is active
 * @returns {number} returns.remainingSeconds - number of seconds until cooldown is over
 */
export default function useCooldownAction<T = void>({
    cooldownMs,
    storageKey,
}: UseCooldownActionOptions): UseCooldownActionReturn<T> {
    const [loading, setLoading] = useState<boolean>(false);
    const [cooldownUntil, setCooldownUntil] = useLocalStorage<number | null>({
        key: storageKey,
        initialValue: null,
    });
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

    // Updates the remaining seconds cooldown
    useEffect(() => {
        if (!cooldownUntil) {
            setRemainingSeconds(0);
            return;
        }

        const tick = () => {
            const diff = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setRemainingSeconds(diff);

            // Clear cooldown if expired
            if (diff === 0) {
                setCooldownUntil(null);
            }
        };

        tick();
        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [cooldownUntil, setCooldownUntil]);

    const isCooldownActive = remainingSeconds > 0;

    // Wraps the calling action in cooldown enforcement
    const execute = useCallback(
        async (action: () => Promise<T>): Promise<T | undefined> => {
            // Prevents execution if already loading or cooldown is active
            if (loading || isCooldownActive) return;

            setLoading(true);

            try {
                const result = await action();

                // Set cooldown on success
                const until = Date.now() + cooldownMs;
                setCooldownUntil(until);

                return result;
            } finally {
                setLoading(false);
            }
        },
        [loading, isCooldownActive, cooldownMs, setCooldownUntil]
    );

    return {
        execute,
        loading,
        isCooldownActive,
        remainingSeconds,
    };
}
