import { useState } from 'react';
import { safeJson } from 'utils/safeJson';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import CardHeader from '@mui/material/CardHeader';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import { formatSecondsToTime } from 'utils/timeFormatter';
import { APIError } from 'utils/apiError';
import Grid from '@mui/material/Grid';
import { parseApiValidationError } from 'utils/parseApiValidationError';
import ErrorAlert from 'components/ErrorAlert';
import useDateRangeContext from 'hooks/useDateRangeContext';
import useAuthFetch from 'hooks/useAuthFetch';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import useCooldownAction from 'hooks/useCooldownAction';
import { z } from 'zod';

const CSV_COOLDOWN_MS = 60 * 1000; // 1 minute
const RECEIPT_COOLDOWN_MS = 600 * 1000; // 10 minutes

const APIResponseSchema = validateAPIResponse(z.object({}));

export default function ExportExpensesCard() {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();

    /**
     * CSV Exporting State
     */
    const [csvError, setCsvError] = useState<string[] | null>(null);
    const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
    const csvExport = useCooldownAction({
        cooldownMs: CSV_COOLDOWN_MS,
        storageKey: 'expenseExportCsvCooldownUntil',
    });

    const handleCsvExport = async () => {
        setCsvError(null);
        setCsvSuccess(null);
        await csvExport
            .execute(async () => {
                const response = await authFetch({
                    url: '/spendingtracker/api/v1/expenses/export',
                    method: 'POST',
                    body: {
                        startDate: formattedStartDate,
                        endDate: formattedEndDate,
                    },
                });

                if (!response) {
                    throw new APIError('Export failed', 500);
                }

                // Attempt to show detailed error message
                if (!response.ok) {
                    const json = await safeJson(response);
                    const parsed = APIResponseSchema.safeParse(json);
                    if (!parsed.success) {
                        throw new APIError('Export failed. Invalid response format.', response.status);
                    }
                    const result = parsed.data;
                    const errorMessage = result?.messages?.join('; ') ?? 'Export failed.';
                    throw new APIError(errorMessage, response.status);
                }

                // Get the blob and download it
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `expenses_${formattedStartDate}_to_${formattedEndDate}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                setCsvSuccess('Export successful! Your download should begin shortly.');
            })
            .catch((err: unknown) => {
                if (err instanceof APIError) {
                    setCsvError(parseApiValidationError(err.message));
                } else {
                    setCsvError(['Export failed. Please try again.']);
                }
            });
    };

    /**
     * Receipt downloading state
     */
    const [receiptError, setReceiptError] = useState<string[] | null>(null);
    const [receiptSuccess, setReceiptSuccess] = useState<string | null>(null);
    const receiptExport = useCooldownAction({
        cooldownMs: RECEIPT_COOLDOWN_MS,
        storageKey: 'expenseExportReceiptCooldownUntil',
    });

    const handleReceiptDownload = async () => {
        setReceiptError(null);
        setReceiptSuccess(null);
        await receiptExport
            .execute(async () => {
                const response = await authFetch({
                    url: '/spendingtracker/api/v1/receipts/export',
                    method: 'POST',
                    body: {
                        startDate: formattedStartDate,
                        endDate: formattedEndDate,
                    },
                });

                if (!response) {
                    throw new APIError('Export failed', 500);
                }

                // Attempt to show detailed error message
                if (!response.ok) {
                    const json = await safeJson(response);
                    const parsed = APIResponseSchema.safeParse(json);
                    if (!parsed.success) {
                        throw new APIError('Export failed. Invalid response format.', response.status);
                    }
                    const result = parsed.data;
                    const errorMessage = result?.messages?.join('; ') ?? 'Export failed.';
                    throw new APIError(errorMessage, response.status);
                }

                // Get the blobl and download it
                const blob = await response.blob();

                // Verify blob is valid
                if (blob.size === 0) {
                    throw new APIError('Received empty file', 500);
                }

                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `receipts_${formattedStartDate}_to_${formattedEndDate}.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);

                setReceiptSuccess('Receipts exported! Your download should begin shortly.');
            })
            .catch((err: unknown) => {
                if (err instanceof APIError) {
                    setReceiptError(parseApiValidationError(err.message));
                } else {
                    setReceiptError(['Export failed. Please try again.']);
                }
            });
    };

    return (
        <Card>
            <CardHeader
                title="Export Data"
                slotProps={{
                    title: {
                        fontSize: '1.25rem',
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />
            <CardContent>
                <Grid
                    container
                    spacing={3}
                    direction="row"
                    sx={{ justifyContent: 'flex-start', alignItems: 'stretch' }}
                >
                    {/* Export to csv */}
                    <Grid key="exportCSV" size={{ xs: 12, lg: 6 }}>
                        <Card variant="outlined" sx={{ height: '100%', pb: 0 }}>
                            <CardContent
                                sx={{
                                    pb: 2,
                                    '&:last-child': {
                                        pb: 2,
                                    },
                                }}
                            >
                                <Stack spacing={3}>
                                    {csvError && <ErrorAlert messages={csvError} onClose={() => setCsvError(null)} />}

                                    {csvSuccess && (
                                        <Alert severity="success" onClose={() => setCsvSuccess(null)}>
                                            {csvSuccess}
                                        </Alert>
                                    )}

                                    <Button
                                        disabled={csvExport.loading || csvExport.isCooldownActive}
                                        loading={csvExport.loading}
                                        loadingPosition="start"
                                        variant="outlined"
                                        fullWidth
                                        onClick={() => {
                                            void handleCsvExport();
                                        }}
                                        startIcon={<DownloadIcon />}
                                    >
                                        Export to CSV
                                    </Button>

                                    {csvExport.isCooldownActive && (
                                        <Typography variant="caption" color="text.secondary">
                                            Export available in ({formatSecondsToTime(csvExport.remainingSeconds)})
                                        </Typography>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Download receipts */}
                    <Grid key="downloadReceipts" size={{ xs: 12, lg: 6 }}>
                        <Card variant="outlined" sx={{ height: '100%', pb: 0 }}>
                            <CardContent
                                sx={{
                                    pb: 2,
                                    '&:last-child': {
                                        pb: 2,
                                    },
                                }}
                            >
                                <Stack spacing={3}>
                                    {receiptError && (
                                        <ErrorAlert messages={receiptError} onClose={() => setReceiptError(null)} />
                                    )}

                                    {receiptSuccess && (
                                        <Alert severity="success" onClose={() => setReceiptSuccess(null)}>
                                            {receiptSuccess}
                                        </Alert>
                                    )}

                                    <Button
                                        disabled={receiptExport.loading || receiptExport.isCooldownActive}
                                        loading={receiptExport.loading}
                                        loadingPosition="start"
                                        variant="outlined"
                                        fullWidth
                                        onClick={() => {
                                            void handleReceiptDownload();
                                        }}
                                        startIcon={<DownloadIcon />}
                                    >
                                        Download Receipts
                                    </Button>

                                    {receiptExport.isCooldownActive && (
                                        <Typography variant="caption" color="text.secondary">
                                            Download available in ({formatSecondsToTime(receiptExport.remainingSeconds)}
                                            )
                                        </Typography>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}
