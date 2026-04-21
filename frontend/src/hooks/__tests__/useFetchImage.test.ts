import { renderHook } from '@test-utils';
import { act, waitFor } from '@testing-library/react';
import useFetchImage from 'hooks/useFetchImage';

describe('useFetchImage', () => {
    it('Should start with empty state', () => {
        const { result } = renderHook(() => useFetchImage({ url: '/test.jpg' }));

        expect(result.current.imageSrc).toBe('');
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(null);
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
        expect(result.current.error).toBe(null);

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
        expect(result.current.error).toBe(null);
        expect(global.fetch).toHaveBeenCalledWith(
            '/test.jpg',
            expect.objectContaining({
                method: 'GET',
                signal: expect.any(AbortSignal) as AbortSignal,
                headers: expect.objectContaining({
                    Accept: 'application/json',
                }) as unknown as RequestInit,
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
        expect(result.current.error).toBe(null);

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
});
