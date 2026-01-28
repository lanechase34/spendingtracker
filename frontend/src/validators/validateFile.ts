/**
 * Validate the incoming file, check the mimetype, extension, and file size
 */
export const validateFile = (
    file: File | null,
    validMimeTypes: string[],
    maxFileSize: number
): { file: File | null; error: string | null } => {
    if (!file) return { file: null, error: 'No file selected.' };

    // Check MIME Type
    if (!validMimeTypes.includes(file.type.toLowerCase())) {
        // Manually check if this is HEIC because not supported by browsers (rigorous check will happen in backend)
        const extension = file.name.split('.')[1];
        const isValidHEIC = validMimeTypes.includes('image/heic') && extension.toUpperCase() === 'HEIC';
        if (!isValidHEIC) {
            return { file: null, error: 'Invalid file type.' };
        }
    }

    // Check size
    if (file.size > maxFileSize) {
        return { file: null, error: 'File size exceeds limit.' };
    }

    return { file, error: null };
};
