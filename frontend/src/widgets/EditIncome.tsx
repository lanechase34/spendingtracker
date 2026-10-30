import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { DateValidationError } from '@mui/x-date-pickers/models';
import EndAdornmentLoading from 'components/EndAdornmentLoading';
import LazyDatePicker from 'components/LazyDatePicker';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';
import useFormField from 'hooks/useFormField';
import { useFetchExtraIncome, useFetchIncome, useSaveIncomeChanges } from 'hooks/useIncomeQuery';
import { type SubmitEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BASE_FORMAT } from 'utils/dates';
import { getErrorInfo } from 'utils/errorInfo';
import { validateMoney } from 'validators/validateMoney';

interface EditIncomeProps {
    date: Dayjs;
}

/**
 * An extra income entry added in the dialog that hasn't been saved yet
 */
interface PendingExtra {
    key: string;
    date: Dayjs;
    amount: string;
    description: string;
}

/**
 * A row in the extra income list, either already saved or pending
 */
interface ExtraRow {
    key: string;
    date: Dayjs;
    amount: number;
    description: string;
    isNew: boolean;
    onDelete: () => void;
}

const validateDescription = (value: string): string | null => {
    if (!value.trim()) return 'Description is required';
    if (value.trim().length > 500) return 'Description must be 500 characters or less';
    return null;
};

/**
 * Map a date picker error code to a message
 */
const dateErrorMessage = (code: DateValidationError | null, outOfRangeMessage: string) => {
    switch (code) {
        case 'maxDate':
        case 'minDate':
            return outOfRangeMessage;
        case 'invalidDate':
            return 'Your date is not valid';
        case 'disableFuture':
        case 'disablePast':
        case 'shouldDisableDate':
        case 'shouldDisableMonth':
        case 'shouldDisableYear':
        case null:
            return '';
    }
};

/**
 * Default date for a new extra entry: today when it falls in the month, otherwise the first of the month
 */
const defaultEntryDate = (month: Dayjs) => (dayjs().isSame(month, 'month') ? dayjs() : month.startOf('month'));

/**
 * Edit Income on a monthly basis
 * Monthly pay is edited directly, extra income is a list of entries that can be added / removed
 * Every change is staged locally and only sent when the user clicks Update
 * Uses React Query for automatic caching and invalidation
 */
export default function EditIncome({ date }: EditIncomeProps) {
    const saveChangesMutation = useSaveIncomeChanges();
    const { formatCurrency } = useCurrencyFormatter({});

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
    const dateError = useMemo(
        () => dateErrorMessage(dateErrorCode, 'Please select a date within one year of today'),
        [dateErrorCode]
    );

    const minMonth = dayjs().subtract(2, 'year');
    const maxMonth = dayjs().add(1, 'year');

    const payField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    /**
     * New extra entry fields
     */
    const [entryDate, setEntryDate] = useState<Dayjs>(() => defaultEntryDate(date));
    const [entryDateErrorCode, setEntryDateErrorCode] = useState<DateValidationError | null>(null);
    const entryDateError = useMemo(
        () => dateErrorMessage(entryDateErrorCode, 'Please select a date within the selected month'),
        [entryDateErrorCode]
    );

    const amountField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    const descriptionField = useFormField({
        initialValue: '',
        validator: validateDescription,
    });

    /**
     * Staged extra income changes
     */
    const [pendingAdds, setPendingAdds] = useState<PendingExtra[]>([]);
    const [pendingRemovals, setPendingRemovals] = useState<number[]>([]);
    const pendingKeyRef = useRef<number>(0);

    /**
     * Format the selected date for API
     */
    const formattedDate = useMemo(() => selectedDate.format(BASE_FORMAT), [selectedDate]);

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

    const {
        data: extraData,
        isLoading: extraLoading,
        isError: extraError,
    } = useFetchExtraIncome({
        startDate: formattedDate,
        endDate: formattedDate,
        enabled: open,
    });

    /**
     * Tracks which month's data has already been used to pre-fill the pay field, so a
     * background refetch while the dialog stays open (e.g. after React Query revalidates)
     * doesn't stomp whatever the user has typed since. Cleared on close so reopening always
     * pre-fills fresh, and re-fires on its own if the user changes the month mid-dialog.
     * resetTo makes the saved pay the baseline, so payField.isDirty reflects an actual edit
     */
    const prefilledDateRef = useRef<string | null>(null);

    useEffect(() => {
        if (incomeData && prefilledDateRef.current !== formattedDate) {
            payField.resetTo(incomeData.pay.toString());
            prefilledDateRef.current = formattedDate;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps -- pre-fill only when new income data arrives (see prefilledDateRef)
    }, [incomeData]);

    /**
     * Saved entries that haven't been removed, plus pending entries, newest first
     * Removals for entries that no longer exist (e.g. already deleted) are ignored
     */
    const savedExtras = useMemo(() => extraData ?? [], [extraData]);

    const activeRemovals = useMemo(
        () => pendingRemovals.filter((id) => savedExtras.some((extra) => extra.id === id)),
        [pendingRemovals, savedExtras]
    );

    const extraRows = useMemo<ExtraRow[]>(() => {
        const saved = savedExtras
            .filter((extra) => !activeRemovals.includes(extra.id))
            .map((extra) => ({
                key: `saved-${String(extra.id)}`,
                date: dayjs(extra.date),
                amount: extra.amount,
                description: extra.description,
                isNew: false,
                onDelete: () => {
                    setPendingRemovals((prev) => [...prev, extra.id]);
                },
            }));

        const pending = pendingAdds.map((extra) => ({
            key: extra.key,
            date: extra.date,
            amount: Number(extra.amount),
            description: extra.description,
            isNew: true,
            onDelete: () => {
                setPendingAdds((prev) => prev.filter((p) => p.key !== extra.key));
            },
        }));

        return [...saved, ...pending].sort((a, b) => b.date.valueOf() - a.date.valueOf());
    }, [savedExtras, activeRemovals, pendingAdds]);

    /**
     * Sum in cents to avoid floating point drift
     */
    const extraTotal = useMemo(
        () => extraRows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100,
        [extraRows]
    );

    const hasChanges = payField.isDirty || pendingAdds.length > 0 || activeRemovals.length > 0;

    const resetEntryForm = (month: Dayjs) => {
        setEntryDate(defaultEntryDate(month));
        setEntryDateErrorCode(null);
        amountField.reset();
        descriptionField.reset();
    };

    /**
     * Pending extra changes belong to the month they were made in, so drop them when the month changes
     * The picker reports partial values while the user types (e.g. year 0002), ignore any that aren't a
     * selectable month so they don't fetch a bogus month or wipe the staged changes
     */
    const handleMonthChange = (newValue: Dayjs | null) => {
        if (newValue?.isValid() !== true) return;
        if (newValue.isBefore(minMonth, 'month') || newValue.isAfter(maxMonth, 'month')) return;
        setSelectedDate(newValue);
        setPendingAdds([]);
        setPendingRemovals([]);
        resetEntryForm(newValue);
    };

    /**
     * Dialog actions
     */
    const handleClickOpen = () => {
        setOpen(true);
        setSelectedDate(date); // Reset to parent date when opening
        resetEntryForm(date);
    };

    const handleClose = (_event: object, reason: string) => {
        if (formLoading || reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        setOpen(false);
        setFormError(null);
    };

    const handleExited = () => {
        setFormLoading(false);
        setPendingAdds([]);
        setPendingRemovals([]);
        prefilledDateRef.current = null;
    };

    /**
     * Stage a new extra income entry
     */
    const handleAddExtra = (event: SubmitEvent) => {
        event.preventDefault();

        const newErrors = {
            date: entryDateError,
            amount: amountField.validateField(),
            description: descriptionField.validateField(),
        };

        if (Object.values(newErrors).some(Boolean)) {
            return;
        }

        pendingKeyRef.current += 1;
        setPendingAdds((prev) => [
            ...prev,
            {
                key: `pending-${String(pendingKeyRef.current)}`,
                date: entryDate,
                amount: amountField.value.trim(),
                description: descriptionField.value.trim(),
            },
        ]);
        amountField.reset();
        descriptionField.reset();
    };

    /**
     * Send only what changed, then keep any changes that failed so they can be retried
     */
    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();

        if (formLoading || !hasChanges) return;

        // Final form validation before submit, pay is only sent (and validated) when edited
        const newErrors = {
            date: dateError,
            pay: payField.isDirty ? payField.validateField() : null,
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some(Boolean);
        if (hasErrors) {
            return;
        }

        setFormLoading(true);
        setFormError(null);

        const adds = pendingAdds;
        const removals = activeRemovals;

        try {
            const result = await saveChangesMutation.mutateAsync({
                pay: payField.isDirty ? { date: formattedDate, pay: payField.value.trim() } : undefined,
                added: adds.map((extra) => ({
                    date: extra.date.format(BASE_FORMAT),
                    amount: extra.amount,
                    description: extra.description,
                })),
                removed: removals,
            });

            if (!result.payFailed) {
                payField.resetTo(payField.value);
            }
            setPendingAdds(adds.filter((_, index) => result.failedAdds.includes(index)));
            setPendingRemovals(result.failedRemovals);
            setFormLoading(false);

            if (result.payFailed || result.failedAdds.length > 0 || result.failedRemovals.length > 0) {
                setFormError('Some changes could not be saved. Please try again.');
                return;
            }

            handleClose({}, '');
        } catch (err: unknown) {
            const errorInfo = getErrorInfo(err);
            console.error('Network error:', err);
            setFormError(errorInfo.message ?? 'Error. Please try again.');
            setFormLoading(false);
        }
    };

    const loadError = isError || extraError;

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
                    <IconButton
                        disabled={formLoading}
                        aria-label="close"
                        onClick={() => {
                            handleClose({}, 'click');
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Stack spacing={3} sx={{ width: '100%' }}>
                        {(loadError || formError != null) && (
                            <Alert
                                severity="error"
                                onClose={() => {
                                    setFormError(null);
                                }}
                            >
                                {formError ?? 'Failed to load income data'}
                            </Alert>
                        )}

                        <Box
                            component="form"
                            onSubmit={(event) => void handleSubmit(event)}
                            id="incomeForm"
                            noValidate
                            autoComplete="off"
                        >
                            <Stack spacing={3}>
                                <FormControl error={!!dateError}>
                                    <LazyDatePicker
                                        views={['year', 'month']}
                                        openTo="month"
                                        label="Month"
                                        value={selectedDate}
                                        onChange={handleMonthChange}
                                        disabled={formLoading}
                                        slotProps={{
                                            textField: {
                                                error: !!dateError,
                                                helperText: dateError,
                                            },
                                        }}
                                        minDate={minMonth}
                                        maxDate={maxMonth}
                                        onError={setDateErrorCode}
                                    />
                                </FormControl>

                                <FormControl variant="outlined" error={!(payField.error == null)} fullWidth>
                                    <InputLabel htmlFor="outlined-adornment-pay">Pay</InputLabel>
                                    <OutlinedInput
                                        id="outlined-adornment-pay"
                                        startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                        endAdornment={<EndAdornmentLoading loading={isLoading} />}
                                        disabled={isLoading || formLoading}
                                        label="Pay"
                                        required
                                        value={payField.value}
                                        onChange={payField.handleChange}
                                        onBlur={payField.handleBlur}
                                    />
                                    {payField.error != null && <FormHelperText>{payField.error}</FormHelperText>}
                                </FormControl>

                                <FormControl variant="outlined" fullWidth>
                                    <InputLabel htmlFor="outlined-adornment-extra">Extra</InputLabel>
                                    <OutlinedInput
                                        id="outlined-adornment-extra"
                                        startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                        endAdornment={<EndAdornmentLoading loading={extraLoading} />}
                                        disabled={extraLoading}
                                        label="Extra"
                                        readOnly
                                        value={extraTotal.toFixed(2)}
                                    />
                                    <FormHelperText>Total of the extra income entries below</FormHelperText>
                                </FormControl>
                            </Stack>
                        </Box>

                        <Divider />

                        <Stack spacing={2}>
                            <Typography variant="subtitle1">Extra Income</Typography>

                            {!extraLoading && extraRows.length === 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    No extra income this month
                                </Typography>
                            )}

                            {extraRows.length > 0 && (
                                <List dense disablePadding aria-label="extra income entries">
                                    {extraRows.map((row) => (
                                        <ListItem
                                            key={row.key}
                                            disableGutters
                                            secondaryAction={
                                                <IconButton
                                                    edge="end"
                                                    aria-label={`delete ${row.description}`}
                                                    disabled={formLoading}
                                                    onClick={row.onDelete}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            }
                                        >
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                                        <span>{row.description}</span>
                                                        {row.isNew && <Chip label="New" size="small" color="primary" />}
                                                    </Stack>
                                                }
                                                secondary={`${row.date.format('MMM D, YYYY')} · ${formatCurrency(row.amount)}`}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            )}

                            <Box
                                component="form"
                                onSubmit={handleAddExtra}
                                id="extraIncomeForm"
                                noValidate
                                autoComplete="off"
                            >
                                <Stack spacing={2}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <FormControl error={!!entryDateError} sx={{ flex: 1 }}>
                                            <LazyDatePicker
                                                label="Date Received"
                                                value={entryDate}
                                                onChange={(newValue: Dayjs | null) => {
                                                    if (newValue === null) return;
                                                    setEntryDate(newValue);
                                                }}
                                                disabled={formLoading}
                                                slotProps={{
                                                    textField: {
                                                        error: !!entryDateError,
                                                        helperText: entryDateError,
                                                    },
                                                }}
                                                minDate={selectedDate.startOf('month')}
                                                maxDate={selectedDate.endOf('month')}
                                                onError={setEntryDateErrorCode}
                                            />
                                        </FormControl>

                                        <FormControl
                                            variant="outlined"
                                            error={!(amountField.error == null)}
                                            sx={{ flex: 1 }}
                                        >
                                            <InputLabel htmlFor="outlined-adornment-extra-amount">Amount</InputLabel>
                                            <OutlinedInput
                                                id="outlined-adornment-extra-amount"
                                                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                                disabled={formLoading}
                                                label="Amount"
                                                required
                                                value={amountField.value}
                                                onChange={amountField.handleChange}
                                                onBlur={amountField.handleBlur}
                                            />
                                            {amountField.error != null && (
                                                <FormHelperText>{amountField.error}</FormHelperText>
                                            )}
                                        </FormControl>
                                    </Stack>

                                    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
                                        <TextField
                                            required
                                            id="extraIncomeDescription"
                                            label="Description"
                                            fullWidth
                                            disabled={formLoading}
                                            value={descriptionField.value}
                                            onChange={descriptionField.handleChange}
                                            onBlur={descriptionField.handleBlur}
                                            error={!(descriptionField.error == null)}
                                            helperText={descriptionField.error}
                                            slotProps={{ htmlInput: { maxLength: 500 } }}
                                        />
                                        <Button
                                            type="submit"
                                            form="extraIncomeForm"
                                            variant="outlined"
                                            startIcon={<AddIcon />}
                                            disabled={formLoading}
                                            sx={{ height: 56, flexShrink: 0 }}
                                        >
                                            Add
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button
                        disabled={formLoading}
                        variant="outlined"
                        onClick={() => {
                            handleClose({}, 'click');
                        }}
                    >
                        Close
                    </Button>
                    <Button
                        disabled={formLoading || isLoading || extraLoading || !hasChanges}
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
