import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <Container maxWidth="sm">
            <Box
                sx={{
                    minHeight: '70vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                }}
            >
                <SearchOffOutlinedIcon
                    sx={{
                        fontSize: 64,
                        color: 'text.secondary',
                        mb: 2,
                    }}
                />

                <Typography variant="h4" fontWeight={600} gutterBottom>
                    Page Not Found
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    The page you're looking for doesn't exist or may have been moved.
                </Typography>

                <Button variant="contained" size="large" component={Link} to="/">
                    Go Home
                </Button>
            </Box>
        </Container>
    );
}
