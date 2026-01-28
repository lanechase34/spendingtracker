import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import type { ErroredExpense } from 'types/BulkImport.type';

interface BulkImportErrorProps {
    errors: ErroredExpense[];
    onClose?: () => void;
}

/**
 * Displays row-level errors from the bulk import endpoint
 */
export default function BulkImportErrors({ errors, onClose }: BulkImportErrorProps) {
    if (errors.length === 0) {
        return null;
    }

    const errorCount = errors.length;

    return (
        <Alert
            severity="error"
            icon={<ErrorOutlineIcon />}
            sx={{
                mb: 2,
                alignItems: 'flex-start',
                '& .MuiAlert-message': {
                    width: '100%',
                    pt: 0.5,
                },
                '& .MuiAlert-action': {
                    pt: 0.5,
                },
            }}
            onClose={onClose}
        >
            <AlertTitle sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1, margin: 0 }}>
                {errorCount} {errorCount === 1 ? 'Row' : 'Rows'} failed to import
            </AlertTitle>

            <Stack spacing={1} sx={{ mt: 1.5 }}>
                {errors.map((error) => (
                    <Paper
                        key={`error-row-${error.row}`}
                        elevation={0}
                        sx={{
                            p: 1.5,
                            bgcolor: 'background.paper',
                            border: 1,
                            borderColor: 'error.light',
                            borderLeftWidth: 3,
                            borderLeftColor: 'error.main',
                        }}
                    >
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Chip
                                label={`Row ${error.row}`}
                                size="small"
                                variant="outlined"
                                color="error"
                                sx={{
                                    fontWeight: 600,
                                    minWidth: 65,
                                    borderWidth: 1.5,
                                }}
                            />
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.primary',
                                    flex: 1,
                                    pt: 0.25,
                                    lineHeight: 1.6,
                                }}
                            >
                                {error.message}
                            </Typography>
                        </Stack>
                    </Paper>
                ))}
            </Stack>
        </Alert>
    );
}
