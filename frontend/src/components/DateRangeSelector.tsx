import 'react-day-picker/dist/style.css';

import DateRangeIcon from '@mui/icons-material/DateRange';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import { alpha, styled } from '@mui/material/styles';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useBreakpoint from 'hooks/useBreakpoint';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { DayPicker } from 'react-day-picker';
import type { DateRangeType } from 'types/DateRange.type';

// Styled wrapper around DayPicker
const StyledDayPickerWrapper = styled(Box)(({ theme }) => ({
    '.rdp': {
        fontFamily: theme.typography.fontFamily,
    },
    '.rdp-months': {
        display: 'flex',
        flexDirection: 'row',
        gap: theme.spacing(2),
    },
    '.rdp-day_button': {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
            borderRadius: '100%',
        },
    },
    '.rdp-selected.rdp-range_middle > .rdp-day_button': {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
            borderRadius: '100%',
        },
    },
    '.rdp-selected > .rdp-day_button': {
        '&:hover': {
            backgroundColor: theme.palette.primary.main,
            borderRadius: '100%',
        },
    },
    '.rdp-day_selected, .rdp-day_range_start, .rdp-day_range_end': {
        backgroundColor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        '&:hover': {
            backgroundColor: theme.palette.primary.main,
            borderRadius: '100%',
        },
    },
    '.rdp-caption_label': {
        fontWeight: theme.typography.fontWeightMedium,
    },
    '.rdp-selected': {
        fontWeight: 'normal',
        fontSize: 'medium',
    },
    '.rdp-month_caption': {
        fontSize: 'medium',
    },
    '.rdp-button_next, .rdp-button_previous': {
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
            borderRadius: '100%',
        },
    },
    '.rdp-root': {
        '--rdp-accent-color': theme.palette.primary.main,
        '--rdp-accent-background-color': alpha(theme.palette.primary.main, theme.palette.action.focusOpacity),
        '--rdp-range_start-color': theme.palette.primary.contrastText,
        '--rdp-range_end-color': theme.palette.primary.contrastText,
    },
}));

// Present ranges map button label -> preset type
const PRESETS: { label: string; type: Exclude<DateRangeType, 'custom'> }[] = [
    { label: 'This Week', type: 'this-week' },
    { label: 'Last Week', type: 'last-week' },
    { label: 'This Month', type: 'this-month' },
    { label: 'Last Month', type: 'last-month' },
    { label: 'This Year', type: 'this-year' },
    { label: 'Last Year', type: 'last-year' },
];

/**
 * DateRange selector with start and end matching MUI style.
 *
 * Behaviour
 * - Preset buttons apply immediately and close the picker.
 * - Custom calendar selections are staged in local state and only
 *   committed to context when the user clicks Done.
 * - On mobile, renders a full-screen Dialog instead of a Popover to
 *   avoid overflow on small screens.
 * - Selecting a new range start clears the previous end date so the
 *   user cannot accidentally confirm a stale range.
 * - The Done button is disabled until both a start and end date are
 *   selected, and shows a tooltip if the range exceeds 365 days.
 */
export default function DateRangeSelector() {
    const { isMobile } = useBreakpoint();
    const { startDate, endDate, setPresetRange, setCustomRange } = useDateRangeContext();

    // Keep track of temp start and end date, only update context when user confirms date range
    const [tempStartDate, setTempStartDate] = useState<Dayjs>(startDate);
    const [tempEndDate, setTempEndDate] = useState<Dayjs>(endDate);

    // Handler for one of the preset date range buttons, sets context immediately
    const applyPresetRange = (type: Exclude<DateRangeType, 'custom'>) => {
        setPresetRange(type);
        handleClose();
    };

    const handleSelect = (range: DateRange | undefined) => {
        if (range?.from) setTempStartDate(dayjs(range.from));
        if (range?.to) setTempEndDate(dayjs(range.to));
    };

    // Anchors where the picker should be
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        // Reset temp dates to current context values when opening
        setTempStartDate(startDate);
        setTempEndDate(endDate);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleDone = () => {
        setCustomRange(tempStartDate, tempEndDate);
        handleClose();
    };

    const presetRanges = (
        <Stack spacing={1}>
            {PRESETS.map(({ label, type }) => (
                <Button key={type} size="small" variant="outlined" onClick={() => applyPresetRange(type)}>
                    {label}
                </Button>
            ))}
        </Stack>
    );

    const pickerContent = (
        <StyledDayPickerWrapper>
            <DayPicker
                mode="range"
                numberOfMonths={isMobile ? 1 : 2}
                selected={{
                    from: tempStartDate?.toDate(),
                    to: tempEndDate?.toDate(),
                }}
                onSelect={handleSelect}
                defaultMonth={tempStartDate.toDate()}
                max={365}
            />
        </StyledDayPickerWrapper>
    );

    const doneBtn = (
        <Button variant="contained" disabled={!tempStartDate || !tempEndDate} onClick={handleDone}>
            Done
        </Button>
    );

    // Build the output using pieces above
    // Mobile screens get a full screen dialog
    // Desktop screens use a popover
    return (
        <>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <Button variant="outlined" onClick={handleOpen} aria-label="Select date range">
                    <DateRangeIcon sx={{ mr: 1 }} />
                    {startDate?.format('MM/DD/YYYY') ?? ''} - {endDate?.format('MM/DD/YYYY') ?? ''}
                </Button>
            </Box>
            {isMobile ? (
                <Dialog open={open} onClose={handleClose} fullScreen>
                    <DialogContent>
                        <Box display="flex" flexDirection="row" gap={1} justifyContent="center">
                            {pickerContent}
                        </Box>

                        <Divider orientation="horizontal" />

                        <Grid container spacing={2} mt={2}>
                            <Grid size={{ xs: 6 }}>{presetRanges}</Grid>
                            <Grid size={{ xs: 6 }}>
                                <Box display="flex" flexDirection="column">
                                    {doneBtn}
                                </Box>
                            </Grid>
                        </Grid>
                    </DialogContent>
                </Dialog>
            ) : (
                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    role="dialog"
                    aria-modal="true"
                >
                    <Paper sx={{ p: 2, minWidth: 800 }}>
                        <Box display="flex" flexDirection="row" gap={2}>
                            {presetRanges}
                            <Divider orientation="vertical" flexItem sx={{ mx: 0 }} />
                            {pickerContent}
                        </Box>

                        <Divider orientation="horizontal" />

                        <Box display="flex" justifyContent="flex-end" mt={2}>
                            {doneBtn}
                        </Box>
                    </Paper>
                </Popover>
            )}
        </>
    );
}
