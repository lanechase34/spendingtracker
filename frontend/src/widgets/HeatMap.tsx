import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import EmptyCard from 'components/EmptyCard';
import ErrorCard from 'components/ErrorCard';
import LoadingCard from 'components/LoadingCard';
import useAuthFetch from 'hooks/useAuthFetch';
import useBreakpoint from 'hooks/useBreakpoint';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useMemo } from 'react';
import type { HeatMap } from 'types/HeatMap.type';
import { HeatMapResponseSchema } from 'types/HeatMap.type';
import { API_BASE_URL } from 'utils/constants';
import { DAYS, formatDateKey, MONTHS } from 'utils/dates';
import type { ColorPalette } from 'utils/palettes';
import { COLOR_PALETTES, getIntensity } from 'utils/palettes';
import { queryKeys } from 'utils/queryKeys';
import { safeJson } from 'utils/safeJson';

interface HeatMapProps {
    color?: ColorPalette;
}

// Build grid returning weeks as columns, days as rows (Sun–Sat)
function buildYearGrid(startDate: Date, endDate: Date): Date[][] {
    const weeks: Date[][] = [];

    const current = new Date(startDate);
    // Pad back to Sunday of the start week
    current.setDate(current.getDate() - current.getDay());

    // Advance end to Saturday of the end week
    const end = new Date(endDate);
    end.setDate(end.getDate() + (6 - end.getDay()));

    while (current <= end) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        weeks.push(week);
    }

    return weeks;
}

export default function HeatMap({ color = 'amber' }: HeatMapProps) {
    const { startDate, endDate, formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();
    const { isMobile } = useBreakpoint();
    const palette = COLOR_PALETTES[color];

    /**
     * Calculate cell size based on display
     */
    const CELL_GAP = 4;
    const cellSize = isMobile ? 10 : 16;
    const STEP = useMemo(() => {
        return cellSize + CELL_GAP;
    }, [cellSize]);

    /**
     * Build grid information
     */
    const weeks = useMemo(() => {
        return buildYearGrid(startDate.toDate(), endDate.toDate());
    }, [startDate, endDate]);

    const monthOffsets = useMemo(() => {
        const offsets: { label: string; offset: number }[] = [];
        let lastMonth = -1;

        weeks.forEach((week, wi) => {
            // Use Thursday (index 4) as the representative day — same logic git uses
            const rep = week[4] ?? week[0];
            const month = rep.getMonth();

            if (month !== lastMonth) {
                offsets.push({ label: MONTHS[month], offset: wi * STEP });
                lastMonth = month;
            }
        });

        return offsets;
    }, [weeks, STEP]);

    /**
     * Additional params used by API
     */
    const additionalParams = useMemo(
        () => ({
            startDate: formattedStartDate,
            endDate: formattedEndDate,
        }),
        [formattedStartDate, formattedEndDate]
    );

    const fetchHeatMapData = async ({ signal }: { signal: AbortSignal }): Promise<HeatMap> => {
        const urlParams = new URLSearchParams(additionalParams);
        const response = await authFetch({
            url: `${API_BASE_URL}/widgets/heatMap?${urlParams.toString()}`,
            method: 'GET',
            signal: signal,
        });

        if (!response) throw new Error('No response');
        if (!response.ok) throw new Error('Invalid network response');

        // Validate response data
        const json = await safeJson(response);
        const parsed = HeatMapResponseSchema.safeParse(json);
        if (!parsed.success) throw new Error('Bad Request');

        const result = parsed.data;
        if (result.error) throw new Error('Bad Request');

        return result.data;
    };

    const {
        data: heatMapData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: queryKeys.heatMap(additionalParams),
        queryFn: fetchHeatMapData,
    });

    if (isLoading) {
        return <LoadingCard />;
    }

    if (isError) {
        return <ErrorCard />;
    }

    if (!heatMapData || !Object.keys(heatMapData).length) {
        return <EmptyCard />;
    }

    return (
        <Card>
            <CardHeader
                title="Expenses Heatmap"
                slotProps={{
                    title: {
                        fontSize: { xs: '1rem', sm: '1.25rem' },
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />

            <CardContent>
                <Box sx={{ overflowX: 'auto', scrollbarWidth: 'thin', py: 1, px: 2 }}>
                    {/* Month labels */}
                    <Box sx={{ position: 'relative', height: '20px', ml: '28px', mb: '4px' }}>
                        {monthOffsets.map(({ label, offset }) => (
                            <Typography
                                key={label}
                                variant="caption"
                                sx={{ position: 'absolute', left: `${offset}px`, whiteSpace: 'nowrap' }}
                            >
                                {label}
                            </Typography>
                        ))}
                    </Box>

                    {/* Grid */}
                    <Box sx={{ display: 'flex', gap: '4px' }}>
                        {/* Day labels */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: `${CELL_GAP}px`, mr: '4px' }}>
                            {DAYS.map((day) => (
                                <Typography
                                    key={day}
                                    variant="caption"
                                    sx={{
                                        height: `${cellSize}px`,
                                        lineHeight: `${cellSize}px`,
                                        whiteSpace: 'nowrap',
                                        textAlign: 'right',
                                    }}
                                >
                                    {day}
                                </Typography>
                            ))}
                        </Box>

                        {weeks.map((week) => {
                            const weekKey = formatDateKey(week[0]);
                            return (
                                <Box
                                    key={weekKey}
                                    sx={{ display: 'flex', flexDirection: 'column', gap: `${CELL_GAP}px` }}
                                >
                                    {week.map((date) => {
                                        const key = formatDateKey(date);
                                        const count = heatMapData[key] ?? 0;
                                        const intensity = getIntensity(count);
                                        const bg = intensity === 0 ? palette[0] : palette[intensity];

                                        return (
                                            <Tooltip
                                                key={key}
                                                title={
                                                    <Typography variant="caption">
                                                        {key}: {count} expense{count !== 1 ? 's' : ''}
                                                    </Typography>
                                                }
                                                arrow
                                            >
                                                <Box
                                                    sx={{
                                                        width: `${cellSize}px`,
                                                        height: `${cellSize}px`,
                                                        borderRadius: '2px',
                                                        backgroundColor: bg,
                                                        cursor: 'pointer',
                                                        transition: 'opacity 0.15s',
                                                        '&:hover': { opacity: count > 0 ? 0.8 : 1 },
                                                    }}
                                                />
                                            </Tooltip>
                                        );
                                    })}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}
