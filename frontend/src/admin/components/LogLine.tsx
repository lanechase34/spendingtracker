import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { getLineColor } from 'utils/fileReader';

interface LogLineProps {
    line: string;
    search: string;
    isDark: boolean;
}

export default function LogLine({ line, search, isDark }: LogLineProps) {
    const color = getLineColor(line, isDark);
    const baseStyles = {
        fontFamily: 'monospace',
        fontSize: '0.75rem',
        color,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        lineHeight: 1.6,
        py: '1px',
    } as const;

    const idx = search ? line.toLowerCase().indexOf(search.toLowerCase()) : -1;

    if (idx === -1) {
        return (
            <Typography component="div" sx={baseStyles}>
                {line}
            </Typography>
        );
    }

    return (
        <Typography component="div" sx={baseStyles}>
            {line.slice(0, idx)}
            <Box
                component="mark"
                sx={{ bgcolor: 'warning.main', color: 'warning.contrastText', borderRadius: '2px', px: '2px' }}
            >
                {line.slice(idx, idx + search.length)}
            </Box>
            {line.slice(idx + search.length)}
        </Typography>
    );
}
