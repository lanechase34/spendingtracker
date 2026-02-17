import type { Breakpoint } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Determine the current device using css breakpoints
 */
export default function useBreakpoint(breakpoint: Breakpoint = 'md') {
    const theme = useTheme();
    return {
        isMobile: useMediaQuery(theme.breakpoints.down(breakpoint)),
        isTablet: useMediaQuery(theme.breakpoints.between('sm', 'md')),
        isDesktop: useMediaQuery(theme.breakpoints.up(breakpoint)),
    };
}
