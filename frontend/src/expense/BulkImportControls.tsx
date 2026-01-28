import type { ChangeEvent } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DownloadIcon from '@mui/icons-material/Download';
import Grid from '@mui/material/Grid';
import { VisuallyHiddenInput } from 'components/VisuallyHiddenInput';
import SyncIcon from '@mui/icons-material/Sync';

interface BulkImportControlsProps {
    csvFile: File | null;
    onCsvChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onProcess: () => Promise<void>;
}

/**
 * Select Expense .csv file and upload for processing
 */
export default function BulkImportControls({ csvFile, onCsvChange, onProcess }: BulkImportControlsProps) {
    return (
        <Card>
            <CardHeader
                title="Bulk Import Expenses"
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
                    {/* Template download */}
                    <Grid key="templateCSV" size={{ xs: 12, lg: 6 }}>
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
                                    <Button
                                        startIcon={<DownloadIcon />}
                                        variant="outlined"
                                        component="a"
                                        fullWidth
                                        href={`${import.meta.env.BASE_URL}/templates/bulk_import_template.csv`}
                                        download
                                    >
                                        Download Template
                                    </Button>

                                    <Typography variant="caption" color="text.secondary">
                                        Follow this CSV format for import.
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Upload file */}
                    <Grid key="uploadCSV" size={{ xs: 12, lg: 6 }}>
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
                                    <Button
                                        variant="contained"
                                        component="label"
                                        tabIndex={-1}
                                        startIcon={<FileUploadIcon />}
                                        fullWidth
                                    >
                                        {csvFile ? 'Replace CSV File' : 'Select CSV File'}
                                        <VisuallyHiddenInput
                                            type="file"
                                            accept=".csv"
                                            id="uploadCsvFile"
                                            name="expenseFile"
                                            onChange={onCsvChange}
                                            data-testid="uploadCsvFile"
                                        />
                                    </Button>

                                    {csvFile && (
                                        <Button
                                            startIcon={<SyncIcon />}
                                            variant="outlined"
                                            color="success"
                                            onClick={() => {
                                                void onProcess();
                                            }}
                                            fullWidth
                                            sx={{ mb: 0 }}
                                        >
                                            Process: {csvFile.name}
                                        </Button>
                                    )}

                                    {!csvFile && (
                                        <Typography variant="caption" color="text.secondary">
                                            Accepted format: .csv
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
