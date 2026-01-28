import Tooltip from '@mui/material/Tooltip';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';

/**
 * UI for a code block
 */
export default function CodeBlock({ value }: { value: string }) {
    const handleCopy = () => {
        void navigator.clipboard.writeText(value);
    };

    return (
        <Box
            sx={{
                position: 'relative',
                bgcolor: 'action.hover',
                borderRadius: 1,
                p: 2,
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                overflowX: 'auto',
            }}
        >
            <Tooltip title="Copy">
                <IconButton size="small" sx={{ position: 'absolute', top: 4, right: 4 }} onClick={handleCopy}>
                    <ContentCopyIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            {value}
        </Box>
    );
}
