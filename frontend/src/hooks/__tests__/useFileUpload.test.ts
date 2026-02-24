import { act, renderHook } from '@testing-library/react';
import useFileUpload from 'hooks/useFileUpload';
import type { ChangeEvent } from 'react';

describe('useFileUpload', () => {
    const validMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    // Mock an actual file upload
    const createMockFile = (name: string, size: number, type: string): File => {
        const file = new File(['a'.repeat(size)], name, { type });
        Object.defineProperty(file, 'size', { value: size });
        return file;
    };

    // Mock the ChangeEvent
    const createMockEvent = (files: FileList | null): ChangeEvent<HTMLInputElement> => {
        return {
            target: {
                files,
                value: files?.[0]?.name ?? '',
            },
        } as ChangeEvent<HTMLInputElement>;
    };

    it('Should initialize with null value and error', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Should accept a valid file', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        const file = createMockFile('test.jpg', 1024, 'image/jpeg');
        const fileList = [file] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBe(file);
        expect(result.current.error).toBeNull();
    });

    it('Should reject a file with invalid mime type', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        const file = createMockFile('test.pdf', 1024, 'application/pdf');
        const fileList = [file] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBe('Invalid file type.');
    });

    it('Should reject a file that exceeds max size', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        const largeFile = createMockFile('large.jpg', maxFileSize + 1, 'image/jpeg');
        const fileList = [largeFile] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBe('File size exceeds limit.');
    });

    it('Should handle HEIC files with valid extension', () => {
        const heicMimeTypes = [...validMimeTypes, 'image/heic'];
        const { result } = renderHook(() => useFileUpload({ validMimeTypes: heicMimeTypes, maxFileSize }));

        const file = createMockFile('photo.HeiC', 1024, 'image/heic');
        const fileList = [file] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBe(file);
        expect(result.current.error).toBeNull();
    });

    it('Should reject non-HEIC files when HEIC is in validMimeTypes but extension does not match', () => {
        const heicMimeTypes = [...validMimeTypes, 'image/heic'];
        const { result } = renderHook(() => useFileUpload({ validMimeTypes: heicMimeTypes, maxFileSize }));

        const file = createMockFile('photo.jpg', 1024, 'application/pdf');
        const fileList = [file] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBe('Invalid file type.');
    });

    it('Should handle null files', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        const event = createMockEvent(null);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Should handle empty file list', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        const fileList = [] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Should clear previous error when a new file is selected', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        // First upload an invalid file
        const invalidFile = createMockFile('test.pdf', 1024, 'application/pdf');
        const invalidFileList = [invalidFile] as unknown as FileList;
        const invalidEvent = createMockEvent(invalidFileList);

        act(() => {
            result.current.handleChange(invalidEvent);
        });

        expect(result.current.error).toBe('Invalid file type.');

        // Then upload a valid file
        const validFile = createMockFile('test.jpg', 1024, 'image/jpeg');
        const validFileList = [validFile] as unknown as FileList;
        const validEvent = createMockEvent(validFileList);

        act(() => {
            result.current.handleChange(validEvent);
        });

        expect(result.current.value).toBe(validFile);
        expect(result.current.error).toBeNull();
    });

    it('Should reset value and error', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        // Upload a file
        const file = createMockFile('test.jpg', 1024, 'image/jpeg');
        const fileList = [file] as unknown as FileList;
        const event = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(event);
        });

        expect(result.current.value).toBe(file);

        // Reset
        act(() => {
            result.current.reset();
        });

        expect(result.current.value).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('Should clear input value on error', () => {
        const { result } = renderHook(() => useFileUpload({ validMimeTypes, maxFileSize }));

        const file = createMockFile('test.pdf', 1024, 'application/pdf');
        const fileList = [file] as unknown as FileList;
        const mockEvent = createMockEvent(fileList);

        act(() => {
            result.current.handleChange(mockEvent);
        });

        expect(mockEvent.target.value).toBe('');
    });
});
