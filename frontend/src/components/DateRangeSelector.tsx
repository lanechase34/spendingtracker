import 'react-day-picker/dist/style.css';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import DateRangeIcon from '@mui/icons-material/DateRange';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import { alpha, styled } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useBreakpoint from 'hooks/useBreakpoint';
import useDateRangeContext from 'hooks/useDateRangeContext';
import useLocalStorage from 'hooks/useLocalStorage';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { DayPicker } from 'react-day-picker';
import type { DateRangeType } from 'types/DateRange.type';
import { z } from 'zod';

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
    { label: 'Year-to-date', type: 'year-to-date' },
];

const MAX_RANGE_DAYS = 365;

// Month indexes for the month grid, 0 = January
const MONTHS = Array.from({ length: 12 }, (_, i) => i);

const ViewModeSchema = z.enum(['days', 'months']);
type ViewMode = z.infer<typeof ViewModeSchema>;

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
 * - A Days / Months toggle swaps the calendar for a month grid. Clicking a
 *   month applies that whole month immediately and closes the picker, like
 *   the presets; there is no range selection in this view.
 * - Both views stay mounted and stacked in the same cell so the card keeps
 *   a constant size when toggling. The chosen view persists in localStorage.
 */
export default function DateRangeSelector() {
    const { isMobile } = useBreakpoint();
    const { startDate, endDate, setPresetRange, setCustomRange } = useDateRangeContext();

    // Keep track of temp start and end date, only update context when user confirms date range
    const [tempStartDate, setTempStartDate] = useState<Dayjs | null>(startDate);
    const [tempEndDate, setTempEndDate] = useState<Dayjs | null>(endDate);

    // Handler for one of the preset date range buttons, sets context immediately
    const applyPresetRange = (type: Exclude<DateRangeType, 'custom'>) => {
        setPresetRange(type);
        handleClose();
    };

    // Update the temporary date selections as the user clicks
    const handleSelect = (range: DateRange | undefined) => {
        setTempStartDate(range?.from ? dayjs(range.from) : null);
        setTempEndDate(range?.to ? dayjs(range.to) : null);
    };

    // Calendar (days) or month grid (months) view, persisted so the picker
    // reopens on the last view the user chose
    const [viewMode, setViewMode] = useLocalStorage<ViewMode>({
        key: 'dateRangeViewMode',
        initialValue: 'days',
        schema: ViewModeSchema,
    });
    // First month shown in the calendar. Controlled because the calendar stays
    // mounted while hidden, so it would otherwise ignore month grid selections
    const [calendarMonth, setCalendarMonth] = useState(() => startDate.toDate());
    // Year shown in the month grid
    const [monthGridYear, setMonthGridYear] = useState(() => startDate.year());

    const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, mode: ViewMode | null) => {
        // Exclusive toggle reports null when the active button is clicked again, ignore that
        if (!mode) return;
        setViewMode(mode);
        // Bring the newly shown view to the staged start date
        const focusDate = tempStartDate ?? dayjs();
        if (mode === 'months') {
            setMonthGridYear(focusDate.year());
        } else {
            setCalendarMonth(focusDate.toDate());
        }
    };

    // Commit the whole clicked month immediately and close, like the presets
    const handleMonthClick = (month: Dayjs) => {
        setCustomRange(month.startOf('month'), month.endOf('month').startOf('day'));
        handleClose();
    };

    // Anchors where the picker should be
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        // Reset temp dates to current context values when opening
        setTempStartDate(startDate);
        setTempEndDate(endDate);
        setMonthGridYear(startDate.year());
        setCalendarMonth(startDate.toDate());
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleDone = () => {
        if (!tempStartDate || !tempEndDate) return;
        setCustomRange(tempStartDate, tempEndDate);
        handleClose();
    };

    const presetRanges = (
        <Stack spacing={1}>
            {PRESETS.map(({ label, type }) => (
                <Button
                    key={type}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        applyPresetRange(type);
                    }}
                >
                    {label}
                </Button>
            ))}
        </Stack>
    );

    const dayPicker = (
        <StyledDayPickerWrapper>
            <DayPicker
                mode="range"
                numberOfMonths={isMobile ? 1 : 2}
                selected={{
                    from: tempStartDate?.toDate(),
                    to: tempEndDate?.toDate(),
                }}
                onSelect={handleSelect}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                // Always render 6 weeks so the height doesn't jump between months
                fixedWeeks
                max={MAX_RANGE_DAYS}
                disabled={
                    tempStartDate
                        ? [
                              { before: tempStartDate.subtract(MAX_RANGE_DAYS, 'day').toDate() },
                              { after: tempStartDate.add(MAX_RANGE_DAYS, 'day').toDate() },
                          ]
                        : undefined
                }
            />
        </StyledDayPickerWrapper>
    );

    // A month is highlighted only when the staged range is exactly that whole month,
    // so an arbitrary custom range from the calendar doesn't light up a month
    const isMonthSelected = (month: Dayjs) =>
        tempStartDate !== null &&
        tempEndDate !== null &&
        tempStartDate.isSame(month.startOf('month'), 'day') &&
        tempEndDate.isSame(month.endOf('month'), 'day');

    const monthGrid = (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, py: 1 }}>
            {/* Narrow, centered header so the arrows sit next to the year on wide screens */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    alignSelf: 'center',
                    width: '100%',
                    maxWidth: 220,
                    mb: 1,
                }}
            >
                <IconButton
                    size="small"
                    aria-label="Previous year"
                    onClick={() => {
                        setMonthGridYear((year) => year - 1);
                    }}
                >
                    <ChevronLeftIcon />
                </IconButton>
                <Typography variant="subtitle1" sx={{ fontWeight: 'medium' }}>
                    {monthGridYear}
                </Typography>
                <IconButton
                    size="small"
                    aria-label="Next year"
                    onClick={() => {
                        setMonthGridYear((year) => year + 1);
                    }}
                >
                    <ChevronRightIcon />
                </IconButton>
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(4, 1fr)',
                    // Fixed-height rows packed at the top under the year header
                    gridAutoRows: 48,
                    alignContent: 'start',
                    gap: 1.5,
                }}
            >
                {MONTHS.map((monthIndex) => {
                    // Build from the 1st directly. Setting year/month on today's date
                    // overflows on the 29th-31st (e.g. Jan 31 -> "Feb" becomes Mar 3)
                    const month = dayjs(new Date(monthGridYear, monthIndex, 1));
                    const selected = isMonthSelected(month);
                    return (
                        <Button
                            key={monthIndex}
                            variant={selected ? 'contained' : 'outlined'}
                            aria-label={month.format('MMMM YYYY')}
                            aria-pressed={selected}
                            onClick={() => {
                                handleMonthClick(month);
                            }}
                        >
                            {month.format('MMM')}
                        </Button>
                    );
                })}
            </Box>
        </Box>
    );

    const pickerContent = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                width: isMobile ? '100%' : 'auto',
            }}
        >
            <ToggleButtonGroup
                size="small"
                exclusive
                value={viewMode}
                onChange={handleViewModeChange}
                aria-label="Picker view"
            >
                <ToggleButton value="days">Days</ToggleButton>
                <ToggleButton value="months">Months</ToggleButton>
            </ToggleButtonGroup>
            {/* Both views share one grid cell so the cell is sized by the larger
                and toggling never resizes the card. The inactive view is hidden
                with visibility, which also removes it from tab order and the a11y tree */}
            <Box sx={{ display: 'grid', width: isMobile ? '100%' : 'auto' }}>
                <Box
                    sx={{ gridArea: '1 / 1', justifySelf: 'center' }}
                    style={{ visibility: viewMode === 'days' ? 'visible' : 'hidden' }}
                >
                    {dayPicker}
                </Box>
                <Box
                    sx={{ gridArea: '1 / 1', display: 'flex', flexDirection: 'column' }}
                    style={{ visibility: viewMode === 'months' ? 'visible' : 'hidden' }}
                >
                    {monthGrid}
                </Box>
            </Box>
        </Box>
    );

    const selectedRangeLabel = (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
            }}
        >
            <DateRangeIcon fontSize="small" color="action" />
            <Typography
                variant="body2"
                sx={{
                    color: 'text.secondary',
                }}
            >
                {tempStartDate && tempEndDate
                    ? `${tempStartDate.format('MM/DD/YYYY')} - ${tempEndDate.format('MM/DD/YYYY')}`
                    : ''}
            </Typography>
        </Box>
    );

    // Disable the done btn if the range exceeds the limit, 365 days
    const rangeExceedsMax = !!(tempStartDate && tempEndDate && tempEndDate.diff(tempStartDate, 'day') > MAX_RANGE_DAYS);
    const doneBtn = (
        <Tooltip title={rangeExceedsMax ? 'Range cannot exceed 365 days' : ''}>
            <span>
                <Button
                    variant="contained"
                    disabled={!tempStartDate || !tempEndDate || rangeExceedsMax}
                    onClick={handleDone}
                >
                    Done
                </Button>
            </span>
        </Tooltip>
    );

    // Build the output using pieces above
    // Mobile screens get a full screen dialog
    // Desktop screens use a popover
    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                }}
            >
                <Button variant="outlined" onClick={handleOpen} aria-label="Select date range">
                    <DateRangeIcon sx={{ mr: 1 }} />
                    {startDate.format('MM/DD/YYYY')} - {endDate.format('MM/DD/YYYY')}
                </Button>
            </Box>
            {isMobile ? (
                <Dialog open={open} onClose={handleClose} fullScreen aria-labelledby="date-range-dialog-title">
                    <DialogTitle
                        id="date-range-dialog-title"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        Select Date Range
                        <IconButton aria-label="close" onClick={handleClose}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <Divider />
                    <DialogContent>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: 1,
                                justifyContent: 'center',
                            }}
                        >
                            {pickerContent}
                        </Box>

                        <Divider orientation="horizontal" />

                        <Grid
                            container
                            spacing={2}
                            sx={{
                                mt: 2,
                            }}
                        >
                            <Grid size={{ xs: 6 }}>{presetRanges}</Grid>
                            <Grid size={{ xs: 6 }}>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 1,
                                    }}
                                >
                                    {selectedRangeLabel}
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
                    aria-label="Select date range"
                >
                    <Paper sx={{ p: 2, minWidth: 800 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'row',
                                gap: 2,
                            }}
                        >
                            {presetRanges}
                            <Divider orientation="vertical" flexItem sx={{ mx: 0 }} />
                            {pickerContent}
                        </Box>

                        <Divider orientation="horizontal" />

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: 2,
                                mt: 2,
                            }}
                        >
                            {selectedRangeLabel}
                            {doneBtn}
                        </Box>
                    </Paper>
                </Popover>
            )}
        </>
    );
}
