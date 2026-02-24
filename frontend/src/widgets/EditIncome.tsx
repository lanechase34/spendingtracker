import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import type { DateValidationError } from '@mui/x-date-pickers/models';
import EndAdornmentLoading from 'components/EndAdornmentLoading';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useFormField from 'hooks/useFormField';
import { useFetchIncome, useUpdateIncome } from 'hooks/useIncomeQuery';
import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { validateMoney } from 'validators/validateMoney';

interface EditIncomeProps {
    date: Dayjs;
}

/**
 * Edit Income (pay, extra) on a monthly basis
 * Uses React Query for automatic caching and invalidation
 */
export default function EditIncome({ date }: EditIncomeProps) {
    const updateIncomeMutation = useUpdateIncome();

    /**
     * Dialog and form state
     */
    const [open, setOpen] = useState<boolean>(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [formLoading, setFormLoading] = useState<boolean>(false);

    /**
     * Form Fields
     */
    const [selectedDate, setSelectedDate] = useState<Dayjs>(date);
    const [dateErrorCode, setDateErrorCode] = useState<DateValidationError | null>(null);
    const dateError = useMemo(() => {
        switch (dateErrorCode) {
            case 'maxDate':
            case 'minDate':
                return 'Please select a date within one year of today';
            case 'invalidDate':
                return 'Your date is not valid';
            default:
                return '';
        }
    }, [dateErrorCode]);

    const payField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    const extraField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    /**
     * Format the selected date for API
     */
    const formattedDate = useMemo(() => selectedDate.format('YYYY-MM'), [selectedDate]);

    /**
     * Only fetch data if dialog is open
     */
    const {
        data: incomeData,
        isLoading,
        isError,
    } = useFetchIncome({
        startDate: formattedDate,
        endDate: formattedDate,
        enabled: open, // Only fetch when dialog is open
    });

    // Update form fields when income data changes
    useEffect(() => {
        if (incomeData) {
            payField.setValue(incomeData.pay?.toString() ?? '0');
            extraField.setValue(incomeData.extra?.toString() ?? '0');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incomeData]);

    /**
     * Dialog actions
     */
    const handleClickOpen = () => {
        setOpen(true);
        setSelectedDate(date); // Reset to parent date when opening
    };

    const handleClose = (_event: object, reason: string) => {
        if (formLoading || reason === 'backdropClick') return;
        setOpen(false);
        setFormError(null);
    };

    const handleExited = () => {
        setFormLoading(false);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (formLoading) return;

        // Final form validation before submit
        const newErrors = {
            date: dateError,
            pay: payField.validateField(),
            extra: extraField.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some(Boolean);
        if (hasErrors) {
            return;
        }

        setFormLoading(true);

        try {
            await updateIncomeMutation.mutateAsync({
                date: selectedDate.format('YYYY-MM'),
                pay: payField.value,
                extra: extraField.value,
            });
            setFormLoading(false);
            handleClose({}, '');
        } catch (err: unknown) {
            const errorInfo = err as { name?: string; message?: string };
            console.error('Network error:', err);
            setFormError(errorInfo?.message ?? 'Error. Please try again.');
            setFormLoading(false);
        }
    };

    return (
        <>
            <IconButton id="editIncomeWidget" size="small" onClick={handleClickOpen} aria-label="edit">
                <EditIcon />
            </IconButton>

            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth={'sm'}
                disableEscapeKeyDown
                slotProps={{
                    transition: {
                        onExited: handleExited,
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    Edit Income
                    <IconButton disabled={formLoading} aria-label="close" onClick={() => handleClose({}, 'click')}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Box
                        component="form"
                        onSubmit={(event) => void handleSubmit(event)}
                        id="incomeForm"
                        sx={{
                            gap: 2,
                            display: 'flex',
                            mt: 0,
                            justifyContent: 'center',
                        }}
                        noValidate
                        autoComplete="off"
                    >
                        <Stack spacing={3} sx={{ width: '100%' }}>
                            {(isError || formError) && (
                                <Alert sx={{ mb: 2 }} severity="error" onClose={() => setFormError(null)}>
                                    {formError ?? 'Failed to load income data'}
                                </Alert>
                            )}
                            <FormControl error={!!dateError}>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <DatePicker
                                        views={['year', 'month']}
                                        openTo="month"
                                        label="Date"
                                        value={selectedDate}
                                        onChange={(newValue: Dayjs | null) => {
                                            if (newValue === null) return;
                                            setSelectedDate(newValue);
                                        }}
                                        slotProps={{
                                            textField: {
                                                error: !!dateError,
                                                helperText: dateError,
                                            },
                                        }}
                                        minDate={dayjs().subtract(2, 'year')}
                                        maxDate={dayjs().add(1, 'year')}
                                        onError={setDateErrorCode}
                                    />
                                </LocalizationProvider>
                            </FormControl>

                            <FormControl variant="outlined" error={!!payField.error} fullWidth>
                                <InputLabel htmlFor="outlined-adornment-pay">Pay</InputLabel>
                                <OutlinedInput
                                    id="outlined-adornment-pay"
                                    startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                    endAdornment={<EndAdornmentLoading loading={isLoading} />}
                                    disabled={isLoading}
                                    label="Pay"
                                    required
                                    value={payField.value}
                                    onChange={payField.handleChange}
                                    onBlur={payField.handleBlur}
                                />
                                {payField.error && <FormHelperText>{payField.error}</FormHelperText>}
                            </FormControl>

                            <FormControl variant="outlined" error={!!extraField.error} fullWidth>
                                <InputLabel htmlFor="outlined-adornment-extra">Extra</InputLabel>
                                <OutlinedInput
                                    id="outlined-adornment-extra"
                                    startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                    endAdornment={<EndAdornmentLoading loading={isLoading} />}
                                    disabled={isLoading}
                                    label="Extra"
                                    required
                                    value={extraField.value}
                                    onChange={extraField.handleChange}
                                    onBlur={extraField.handleBlur}
                                />
                                {extraField.error && <FormHelperText>{extraField.error}</FormHelperText>}
                            </FormControl>
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button disabled={formLoading} variant="outlined" onClick={() => handleClose({}, 'click')}>
                        Close
                    </Button>
                    <Button
                        disabled={formLoading || isLoading}
                        loading={formLoading}
                        loadingPosition="start"
                        variant="outlined"
                        type="submit"
                        form="incomeForm"
                    >
                        Update
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
