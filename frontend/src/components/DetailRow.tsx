import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

/**
 * Detail row for modal view
 */
export default function DetailRow({
    label,
    value,
    multiline = false,
}: {
    label: string;
    value: React.ReactNode;
    multiline?: boolean;
}) {
    return (
        <Stack spacing={0.5}>
            <Typography
                variant="caption"
                sx={{
                    color: 'text.secondary',
                }}
            >
                {label}
            </Typography>
            <Typography
                variant="body2"
                // Elements like chips render divs, which can't be nested in a <p>
                component={typeof value === 'string' || typeof value === 'number' ? 'p' : 'div'}
                sx={{
                    whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
                    wordBreak: 'break-word',
                }}
            >
                {value}
            </Typography>
        </Stack>
    );
}
