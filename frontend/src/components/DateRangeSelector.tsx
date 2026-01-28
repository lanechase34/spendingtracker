import 'react-day-picker/dist/style.css';
import { useState, useRef } from 'react';
import useDateRangeContext from 'hooks/useDateRangeContext';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import Button from '@mui/material/Button';
import { styled, alpha } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Popover from '@mui/material/Popover';
import Paper from '@mui/material/Paper';
import DateRangeIcon from '@mui/icons-material/DateRange';
import useBreakpoint from 'hooks/useBreakpoint';
import Divider from '@mui/material/Divider';

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
    const { startDate, endDate, setStartDate, setEndDate } = useDateRangeContext();

    // Keep track of temp start and end date, only update context when user confirms date range
    const [tempStartDate, setTempStartDate] = useState<Dayjs>(startDate);
    const [tempEndDate, setTempEndDate] = useState<Dayjs>(endDate);

    const applyQuickRange = (from: Dayjs, to: Dayjs) => {
        setTempStartDate(from);
        setTempEndDate(to);
        setStartDate(from);
        setEndDate(to);
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
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleDone = () => {
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
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
                        {/* Quick ranges */}
                        <Stack spacing={1}>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => applyQuickRange(dayjs().startOf('week'), dayjs().endOf('week'))}
                            >
                                This Week
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                    applyQuickRange(
                                        dayjs().subtract(7, 'day').startOf('week'),
                                        dayjs().subtract(7, 'day').endOf('week')
                                    )
                                }
                            >
                                Last Week
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => applyQuickRange(dayjs().startOf('month'), dayjs().endOf('month'))}
                            >
                                This Month
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                    applyQuickRange(
                                        dayjs().subtract(1, 'month').startOf('month'),
                                        dayjs().subtract(1, 'month').endOf('month')
                                    )
                                }
                            >
                                Last Month
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => applyQuickRange(dayjs().startOf('year'), dayjs().endOf('year'))}
                            >
                                This Year
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                    applyQuickRange(
                                        dayjs().subtract(1, 'year').startOf('year'),
                                        dayjs().subtract(1, 'year').endOf('year')
                                    )
                                }
                            >
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
