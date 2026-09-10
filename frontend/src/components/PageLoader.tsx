import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

/**
 * Full-page centered spinner, used while a route chunk or its initial data is loading
 */
export default function PageLoader() {
    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '75vh',
            }}
        >
            <CircularProgress />
        </Box>
    );
}
