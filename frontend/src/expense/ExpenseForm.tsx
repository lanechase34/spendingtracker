import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import CategorySelect from './CategorySelect';
import SubscriptionOption from './SubscriptionOption';
import ReceiptUpload from './ReceiptUpload';
import useFormField from 'hooks/useFormField';
import useCategorySelect from 'hooks/useCategorySelect';
import useSubscriptionInterval from 'hooks/useSubscriptionInterval';
import useFileUpload from 'hooks/useFileUpload';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import type { DateValidationError } from '@mui/x-date-pickers/models';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import type { APIResponseType } from 'types/APIResponse.type';
import useAuthFetch from 'hooks/useAuthFetch';
import useExpenseContext from 'hooks/useExpenseContext';
import useSubscriptionContext from 'hooks/useSubscriptionContext';
import { validMimeTypes, maxFileSize, validExtensions } from 'utils/receiptDefaults';
import { clearCategoryCache } from 'utils/categoryCache';
import { useInvalidateWidgets } from 'hooks/useInvalidateWidgets';
import { validateMoney } from 'validators/validateMoney';

export default function ExpenseForm() {
    const [open, setOpen] = useState<boolean>(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const authFetch = useAuthFetch();
    const { refetch: refetchExpenses } = useExpenseContext();
    const { refetch: refetchSubscriptions } = useSubscriptionContext();
    const invalidateWidgets = useInvalidateWidgets();

    const handleClickOpen = () => {
        setOpen(true);
    };

    // Avoid re-renders on close - typescript params that start with _ are optional
    const handleClose = (_event: object, reason: string) => {
        if (loading || reason === 'backdropClick') return;
        setOpen(false);
    };

    const handleExited = () => {
        // Reset fields when modal finishes closing
        setSelectedDate(dayjs());
        descriptionField.reset();
        amountField.reset();
        categorySelect.reset();
        subscriptionInterval.reset();
        receiptUpload.reset();
    };

    const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs());
    const [dateErrorCode, setDateErrorCode] = useState<DateValidationError | null>(null);
    const dateError = useMemo(() => {
        switch (dateErrorCode) {
            case 'maxDate':
            case 'minDate': {
                return 'Please select a date in the first quarter of 2022';
            }

            case 'invalidDate': {
                return 'Your date is not valid';
            }

            default: {
                return '';
            }
        }
    }, [dateErrorCode]);

    const descriptionField = useFormField({
        initialValue: '',
        validator: (value: string) => {
            if (!value.trim() || value.trim().length < 3) return 'Description must be at least 3 characters';
            return null;
        },
    });

    const amountField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    const categorySelect = useCategorySelect({
        initialValue: null,
        validator: (value: string | number | null) => {
            if (value === null || (typeof value === 'string' && value === '')) {
                return 'Category is required';
            }
            return null;
        },
    });

    const subscriptionInterval = useSubscriptionInterval({
        initialInterval: null,
        validator: (value: string | null, isSubscription: boolean) => {
            if (!isSubscription) return null;
            if (value === null) return 'Please select an interval';
            if (!['Y', 'M'].includes(value)) return 'Please select a valid interval';
            return null;
        },
    });

    const receiptUpload = useFileUpload({
        validMimeTypes: validMimeTypes,
        maxFileSize: maxFileSize,
    });

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return; // Prevents double submit

        // Final form validation before submit
        const newErrors = {
            date: dateError,
            description: descriptionField.validateField(),
            amount: amountField.validateField(),
            category: categorySelect.validateField(),
            subscriptionInterval: subscriptionInterval.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some((err) => err && err !== null && err !== '');
        if (hasErrors) {
            return;
        }

        setLoading(true);

        // Build form data
        let endpoint = '/spendingtracker/api/v1/expenses';
        const formData = new FormData();
        formData.append('date', selectedDate.format('MM-DD-YYYY'));
        formData.append('description', descriptionField.value);
        formData.append('amount', amountField.value);
        formData.append(
            typeof categorySelect.value === 'number' ? 'categoryid' : 'category',
            `${categorySelect.value}`
        );

        // If we are saving a subscription
        if (subscriptionInterval.isSubscription && subscriptionInterval.interval !== null) {
            endpoint = '/spendingtracker/api/v1/subscriptions';
            formData.append('interval', subscriptionInterval.interval);
        }

        if (receiptUpload.value) {
            formData.append('receipt', receiptUpload.value);
        }

        try {
            const response = await authFetch({
                url: endpoint,
                method: 'POST',
                body: formData,
            });

            if (!response?.ok) {
                const errorMessages = (await response?.json()) as APIResponseType<null>;
                setServerError(errorMessages?.messages?.toString() ?? 'Server Error. Please try again.');
                return;
            }

            /**
             * Refetch the subscription and/or expense list after saving
             */
            if (subscriptionInterval.isSubscription) {
                await refetchSubscriptions();
                await refetchExpenses();
            } else {
                await refetchExpenses();
            }

            /**
             * Invalidate the widget queries -> force refresh
             */
            invalidateWidgets();

            /**
             * Clear the category select cache if we added a new option
             */
            if (typeof categorySelect.value !== 'number') {
                clearCategoryCache();
            }

            // Hide the modal
            handleClose({}, '');
            setServerError(null);
        } catch (err: unknown) {
            console.error('Network error:', err);
            setServerError('Unable to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button variant="outlined" onClick={handleClickOpen}>
                <AddIcon sx={{ mr: 1 }} />
                Track Expense
            </Button>
            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth={true}
                maxWidth={'sm'}
                disableEscapeKeyDown={true}
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
                    Track Expense
                    <IconButton disabled={loading} aria-label="close" onClick={() => setOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Box
                        component="form"
                        onSubmit={(event) => void handleSubmit(event)}
                        id="expenseForm"
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
                            {serverError && (
                                <Alert
                                    sx={{ mb: 2 }}
                                    severity="error"
                                    onClose={() => {
                                        setServerError(null);
                                    }}
                                >
                                    {serverError}
                                </Alert>
                            )}
                            <FormControl error={!!dateError}>
                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                    <DatePicker
                                        label="Date"
                                        value={selectedDate}
                                        onChange={(newValue: Dayjs | null) => {
                                            if (newValue === null) return;
                                            setSelectedDate(newValue);
                                        }}
                                        slotProps={{
                                            textField: {
                                                helperText: dateError,
                                            },
                                        }}
                                        minDate={dayjs().subtract(1, 'year')}
                                        maxDate={dayjs().add(1, 'year')}
                                        onError={setDateErrorCode}
                                    />
                                </LocalizationProvider>
                            </FormControl>

                            <FormControl>
                                <TextField
                                    required
                                    id="expenseDescription"
                                    label="Description"
                                    name="description"
                                    multiline
                                    rows={3}
                                    fullWidth
                                    value={descriptionField.value}
                                    onChange={descriptionField.handleChange}
                                    onBlur={descriptionField.handleBlur}
                                    error={!!descriptionField.error}
                                    helperText={descriptionField.error}
                                />
                            </FormControl>

                            <FormControl variant="outlined" error={!!amountField.error} fullWidth>
                                <InputLabel htmlFor="outlined-adornment-amount">Amount</InputLabel>
                                <OutlinedInput
                                    id="outlined-adornment-amount"
                                    startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                    label="Amount"
                                    required
                                    value={amountField.value}
                                    onChange={amountField.handleChange}
                                    onBlur={amountField.handleBlur}
                                />
                                {amountField.error && <FormHelperText>{amountField.error}</FormHelperText>}
                            </FormControl>

                            <CategorySelect
                                handleCategorySelectChange={categorySelect.handleChange}
                                error={!!categorySelect.error}
                                helperText={categorySelect.error}
                            />

                            <SubscriptionOption
                                isSubscription={subscriptionInterval.isSubscription}
                                handleIsSubscriptionChange={subscriptionInterval.handleSubscriptionChange}
                                subscriptionInterval={subscriptionInterval.interval}
                                handleSubscriptionIntervalChange={subscriptionInterval.handleIntervalChange}
                                error={!!subscriptionInterval.error}
                                helperText={subscriptionInterval.error}
                            />

                            <ReceiptUpload
                                selectedReceipt={receiptUpload.value}
                                error={receiptUpload.error}
                                handleReceiptChange={receiptUpload.handleChange}
                                validExtensions={validExtensions}
                            />
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button disabled={loading} variant="outlined" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        loading={loading}
                        loadingPosition="start"
                        variant="outlined"
                        type="submit"
                        form="expenseForm"
                    >
                        Track
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
