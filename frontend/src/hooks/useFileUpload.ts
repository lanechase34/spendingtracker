import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { validateFile as utilValidateFile } from 'validators/validateFile';

interface FileUpload {
    validMimeTypes: string[];
    maxFileSize: number;
}

interface UseFileUploadReturn {
    value: File | null;
    error: string | null;
    handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
    reset: () => void;
    validateFile: (file: File | null) => { file: File | null; error: string | null }; // call validator manually
}

export default function useFileUpload({ validMimeTypes, maxFileSize }: FileUpload): UseFileUploadReturn {
    const [value, setValue] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        // Clear any previous error
        setError(null);

        const files = event?.target?.files;
        if (files?.length !== 1) return;

        const { file, error } = validateFile(files[0]);
        // If error, show error and blank input
        if (error) {
            setError(error);
            setValue(null);
            event.target.value = '';
            return;
        }

        setValue(file);
    };

    /**
     * Validate the incoming file, check the mimetype, extension, and file size
     */
    const validateFile = (file: File | null): { file: File | null; error: string | null } => {
        return utilValidateFile(file, validMimeTypes, maxFileSize);
    };

    const reset = () => {
        setValue(null);
        setError(null);
    };

    return { value, error, handleChange, reset, validateFile };
}
