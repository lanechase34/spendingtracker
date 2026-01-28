import type { ChangeEvent } from 'react';
import { VisuallyHiddenInput } from 'components/VisuallyHiddenInput';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import Typography from '@mui/material/Typography';

interface ReceiptUploadProps {
    selectedReceipt: File | null;
    error: string | null;
    handleReceiptChange: (event: ChangeEvent<HTMLInputElement>) => void;
    validExtensions: string;
    variant?: 'contained' | 'text' | 'outlined';
    size?: 'small' | 'medium' | 'large';
    textInline?: boolean;
}

export default function ReceiptUpload({
    selectedReceipt,
    error,
    handleReceiptChange,
    validExtensions,
    variant = 'contained',
    size = 'medium',
    textInline = false,
}: ReceiptUploadProps) {
    return (
        <FormControl error={!!error} sx={{ flexGrow: 1 }}>
            <Button
                component="label"
                role={undefined}
                variant={variant}
                size={size}
                tabIndex={-1}
                startIcon={<FileUploadIcon />}
                data-testid="uploadReceiptBtn"
                sx={{ justifyContent: 'center' }}
            >
                {selectedReceipt ? 'Replace Receipt' : 'Upload Receipt'}
                <VisuallyHiddenInput
                    type="file"
                    accept={validExtensions}
                    id="uploadReceipt"
                    name="receipt"
                    onChange={handleReceiptChange}
                    data-testid="uploadReceipt"
                />
            </Button>

            {selectedReceipt && !textInline && (
                <Typography variant="body1" sx={{ mt: 1 }}>
                    Selected: <strong>{selectedReceipt.name}</strong>
                </Typography>
            )}

            {error && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                    {error}
                </Typography>
            )}
        </FormControl>
    );
}
