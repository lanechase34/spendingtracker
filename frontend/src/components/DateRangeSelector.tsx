import 'react-day-picker/dist/style.css';

import DateRangeIcon from '@mui/icons-material/DateRange';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import Stack from '@mui/material/Stack';
import { alpha,styled } from '@mui/material/styles';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useBreakpoint from 'hooks/useBreakpoint';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useRef,useState } from 'react';
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

function createDateRange(startDate: Dayjs, endDate: Dayjs): DateRange {
    return {
        from: startDate?.toDate(),
        to: endDate?.toDate(),
    };
}

/**
 * DateRange selector with start and end matching MUI style
 */
export default function DateRangeSelector() {
    const { isMobile } = useBreakpoint();
    const { startDate, endDate, setPresetRange, setCustomRange } = useDateRangeContext();

    // Keep track of temp start and end date, only update context when user confirms date range
    const [tempStartDate, setTempStartDate] = useState<Dayjs>(startDate);
    const [tempEndDate, setTempEndDate] = useState<Dayjs>(endDate);

    // Handler for one of the preset date range buttons
    const applyPresetRange = (type: Exclude<DateRangeType, 'custom'>) => {
        setPresetRange(type);
        handleClose();
    };

    const handleSelect = (range: DateRange | undefined) => {
        if (range?.from) setTempStartDate(dayjs(range.from));
        if (range?.to) setTempEndDate(dayjs(range.to));
    };

    const inputRef = useRef<HTMLDivElement | null>(null);

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

    return (
        <>
            <Box ref={inputRef} display="flex" gap={2} alignItems="center" flexWrap="wrap">
                <Button variant="outlined" onClick={handleOpen} aria-label="Select date range">
                    <DateRangeIcon sx={{ mr: 1 }} />
                    {startDate?.format('MM/DD/YYYY') ?? ''} - {endDate?.format('MM/DD/YYYY') ?? ''}
                </Button>
            </Box>

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
                        {/* Preset Ranges */}
                        <Stack spacing={1}>
                            <Button size="small" variant="outlined" onClick={() => applyPresetRange('this-week')}>
                                This Week
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => applyPresetRange('last-week')}>
                                Last Week
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => applyPresetRange('this-month')}>
                                This Month
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => applyPresetRange('last-month')}>
                                Last Month
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => applyPresetRange('this-year')}>
                                This Year
                            </Button>
                            <Button size="small" variant="outlined" onClick={() => applyPresetRange('last-year')}>
                                Last Year
                            </Button>
                        </Stack>

                        <Divider orientation="vertical" flexItem sx={{ mx: 0 }} />

                        {/* Range picker */}
                        <StyledDayPickerWrapper>
                            <DayPicker
                                mode="range"
                                numberOfMonths={isMobile ? 1 : 2}
                                selected={createDateRange(tempStartDate, tempEndDate)}
                                onSelect={handleSelect}
                                defaultMonth={tempStartDate.toDate()}
                                max={365}
                            />
                        </StyledDayPickerWrapper>
                    </Box>

                    <Divider orientation="horizontal" />

                    {/* Footer with Done button */}
                    <Box display="flex" justifyContent="flex-end" mt={2}>
                        <Button variant="contained" disabled={!tempStartDate || !tempEndDate} onClick={handleDone}>
                            Done
                        </Button>
                    </Box>
                </Paper>
            </Popover>
        </>
    );
}
