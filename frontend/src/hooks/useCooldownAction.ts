import useLocalStorage from 'hooks/useLocalStorage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

interface UseCooldownActionOptions {
    cooldownMs: number;
    storageKey: string;
}

interface UseCooldownActionReturn<T> {
    execute: (action: () => Promise<T>) => Promise<T | undefined>;
    loading: boolean;
    isCooldownActive: boolean;
    remainingSeconds: number;
    startCooldown: () => void;
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
 * @returns {Function} returns.startCooldown - start the cooldown without running an action (e.g. the action happened elsewhere),
 *                                            an already active longer cooldown is kept
 */
export default function useCooldownAction<T = void>({
    cooldownMs,
    storageKey,
}: UseCooldownActionOptions): UseCooldownActionReturn<T> {
    const [loading, setLoading] = useState<boolean>(false);
    const [cooldownUntil, setCooldownUntil] = useLocalStorage<number | null>({
        key: storageKey,
        initialValue: null,
        schema: z.number().nullable(),
    });

    // Synchronous guard so a double click before the loading re-render can't run the action twice
    const inFlightRef = useRef<boolean>(false);

    const startCooldown = useCallback(() => {
        setCooldownUntil((prev) => {
            if (prev === null || prev < Date.now()) {
                return Date.now() + cooldownMs;
            }
            return prev;
        });
    }, [cooldownMs, setCooldownUntil]);

    // Tick now every second while cooldown is active
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        if (cooldownUntil == null) return;

        // Reset now on the next tick (not synchronously) so remainingSeconds is accurate
        // from the start of a new cooldown
        const resetTimeout = setTimeout(() => {
            setNow(Date.now());
        }, 0);

        const interval = setInterval(() => {
            const currentNow = Date.now();
            setNow(currentNow);
            if (currentNow >= cooldownUntil) {
                clearInterval(interval);
                setCooldownUntil(null);
            }
        }, 1000);

        return () => {
            clearTimeout(resetTimeout);
            clearInterval(interval);
        };
    }, [cooldownUntil, setCooldownUntil]);

    const remainingSeconds = cooldownUntil != null ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;

    const isCooldownActive = remainingSeconds > 0;

    const execute = useCallback(
        async (action: () => Promise<T>): Promise<T | undefined> => {
            if (inFlightRef.current || loading || isCooldownActive) return;

            inFlightRef.current = true;
            setLoading(true);

            try {
                const result = await action();
                setCooldownUntil(Date.now() + cooldownMs);
                return result;
            } finally {
                inFlightRef.current = false;
                setLoading(false);
            }
        },
        [loading, isCooldownActive, cooldownMs, setCooldownUntil]
    );

    return { execute, loading, isCooldownActive, remainingSeconds, startCooldown };
}
