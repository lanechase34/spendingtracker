import useAuthFetch from 'hooks/useAuthFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorInfo } from 'utils/errorInfo';

interface FetchImage {
    url: string;
}

interface UseFetchImageReturn {
    imageSrc: string;
    loading: boolean;
    error: string | null;
    fetchImage: () => Promise<void>;
}

/**
 * Fetch the image from the url and create reference for browser to use
 * @url the image's url
 */
export default function useFetchImage({ url }: FetchImage): UseFetchImageReturn {
    const [imageSrc, setImageSrc] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const authFetch = useAuthFetch();

    // Track the current abort controller
    const abortControllerRef = useRef<AbortController | null>(null);

    const fetchImage = useCallback(async () => {
        setLoading(true);
        setError(null);

        // Cancel any ongoing request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            const response = await authFetch({
                url: url,
                method: 'GET',
                signal: abortController.signal,
            });

            if (!response) return;
            if (!response.ok) throw new Error('Invalid network response');

            const result = await response.blob();

            // Superseded or unmounted while reading, don't create a URL nothing will revoke
            if (abortController.signal.aborted) return;
            const objectUrl = URL.createObjectURL(result);

            // Revoke previous URL if it exists
            setImageSrc((prev: string) => {
                if (prev) URL.revokeObjectURL(prev);
                return objectUrl;
            });
        } catch (err: unknown) {
            const errorInfo = getErrorInfo(err);
            if (errorInfo.name !== 'AbortError') {
                setError(errorInfo.message ?? 'Failed to load image');
            }
        } finally {
            // Only the latest request owns loading, an aborted one was superseded (or unmounted)
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
                setLoading(false);
            }
        }
    }, [url, authFetch]);

    /**
     * Abort any in-flight request on unmount
     */
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
        };
    }, []);

    /**
     * Cleanup object URL on unmount or when URL changes
     */
    useEffect(() => {
        const currentUrl = imageSrc;
        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl);
            }
        };
    }, [imageSrc]);

    return { error, loading, imageSrc, fetchImage };
}
