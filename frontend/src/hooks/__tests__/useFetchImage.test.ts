import { renderHook } from '@test-utils';
import { act, waitFor } from '@testing-library/react';
import * as authFetchModule from 'hooks/useAuthFetch';
import useFetchImage from 'hooks/useFetchImage';

const OriginalAbortController = global.AbortController;

describe('useFetchImage', () => {
    afterEach(() => {
        // The abort test swaps in a mock AbortController
        global.AbortController = OriginalAbortController;
        jest.restoreAllMocks();
    });

    it('Should start with empty state', () => {
        const { result } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        expect(result.current.imageSrc).toBe('');
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
    });

    it('Should fetch and load image successfully', async () => {
        const mockBlob = new Blob(['fake image'], { type: 'image/jpeg' });

        // Mock a successful fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(mockBlob),
            } as Response)
        ) as jest.Mock;

        // Mock URL.createObjectURL and URL.revokeObjectURL
        const mockObjectUrl = 'blob:http://localhost/fake-url';
        global.URL.createObjectURL = jest.fn(() => mockObjectUrl);
        global.URL.revokeObjectURL = jest.fn();

        const { result } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        // Check initial state
        expect(result.current.imageSrc).toBe('');
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();

        // Call fetchImage
        act(() => {
            void result.current.fetchImage();
        });

        // Should be loading
        expect(result.current.loading).toBe(true);

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Should have image src
        expect(result.current.imageSrc).toBe(mockObjectUrl);
        expect(result.current.error).toBeNull();
        expect(global.fetch).toHaveBeenCalledWith(
            '/test.jpg',
            expect.objectContaining({
                method: 'GET',
                signal: expect.any(AbortSignal) as AbortSignal,
            })
        );
    });

    it('Should handle fetch errors', async () => {
        // Mock a failed fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
            } as Response)
        ) as jest.Mock;

        const { result } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        // Check initial state
        expect(result.current.imageSrc).toBe('');
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();

        // Call fetchImage
        act(() => {
            void result.current.fetchImage();
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe('Invalid network response');
        expect(result.current.imageSrc).toBe('');
    });

    it('Should abort previous request when new fetch is called', async () => {
        const mockBlob = new Blob(['fake image'], { type: 'image/jpeg' });

        // Mock a successful fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(mockBlob),
            } as Response)
        ) as jest.Mock;

        // Mock abort controller
        const abortMock1 = jest.fn();
        const abortMock2 = jest.fn();

        const abortControllerMock = jest
            .fn()
            .mockImplementationOnce(() => ({
                signal: new EventTarget(),
                abort: abortMock1,
            }))
            .mockImplementationOnce(() => ({
                signal: new EventTarget(),
                abort: abortMock2,
            }));
        (global as unknown as { AbortController: typeof AbortController }).AbortController = abortControllerMock;

        const { result } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        // Start first fetch
        act(() => {
            void result.current.fetchImage();
        });

        // Start second fetch immediately (should abort first)
        act(() => {
            void result.current.fetchImage();
        });

        // Expect both to instantiate their own AbortController
        expect(abortControllerMock).toHaveBeenCalledTimes(2);

        // Expect the first question to be aborted
        expect(abortMock1).toHaveBeenCalledTimes(1);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Second question will not have been aborted
        expect(abortMock2).toHaveBeenCalledTimes(0);

        // Should only have called fetch twice (both attempts)
        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('Should cleanup object URL on unmount', async () => {
        const mockBlob = new Blob(['fake image'], { type: 'image/jpeg' });

        // Mock a successful fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: true,
                blob: () => Promise.resolve(mockBlob),
            } as Response)
        ) as jest.Mock;

        // Mock URL.createObjectURL and URL.revokeObjectURL
        const mockObjectUrl = 'blob:http://localhost/fake-url';
        global.URL.createObjectURL = jest.fn(() => mockObjectUrl);

        const revokeObjectURLMock = jest.fn();
        global.URL.revokeObjectURL = revokeObjectURLMock;

        const { result, unmount } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        // Call fetchImage
        act(() => {
            void result.current.fetchImage();
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Should have imageSrc
        expect(result.current.imageSrc).toBe(mockObjectUrl);

        unmount();

        // Should revoke the object URL
        expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
        expect(revokeObjectURLMock).toHaveBeenCalledWith(mockObjectUrl);
    });

    it('Should stop loading when there is no response (no session)', async () => {
        // authFetch resolves null when there is no auth token
        const authFetchSpy = jest.fn().mockResolvedValue(null);
        jest.spyOn(authFetchModule, 'default').mockReturnValue(authFetchSpy);
        global.fetch = jest.fn();

        const { result } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        await act(async () => {
            await result.current.fetchImage();
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.imageSrc).toBe('');
        expect(authFetchSpy).toHaveBeenCalledTimes(1);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Should abort the request on unmount and not create a URL once unmounted', async () => {
        let resolveBlob: (blob: Blob) => void = () => undefined;
        let signal: AbortSignal | undefined;
        global.fetch = jest.fn((_url: string, init: RequestInit) => {
            signal = init.signal ?? undefined;
            return Promise.resolve({
                ok: true,
                blob: () =>
                    new Promise<Blob>((resolve) => {
                        resolveBlob = resolve;
                    }),
            } as Response);
        }) as jest.Mock;
        global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost/late-url');
        global.URL.revokeObjectURL = jest.fn();

        const { result, unmount } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        act(() => {
            void result.current.fetchImage();
        });
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        unmount();
        expect(signal?.aborted).toBe(true);

        // Blob finishes reading after unmount
        await act(async () => {
            resolveBlob(new Blob(['late']));
            await Promise.resolve();
        });

        expect(global.URL.createObjectURL).not.toHaveBeenCalled();
    });
});
