import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { Link } from 'react-router-dom';

export default function Unauthorized() {
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
                <LockOutlinedIcon
                    sx={{
                        fontSize: 64,
                        color: 'text.secondary',
                        mb: 2,
                    }}
                />

                <Typography
                    variant="h4"
                    gutterBottom
                    sx={{
                        fontWeight: 600,
                    }}
                >
                    Access Denied
                </Typography>

                <Typography
                    variant="body1"
                    sx={{
                        color: 'text.secondary',
                        mb: 4,
                    }}
                >
                    You don't have permission to access this page.
                </Typography>

                <Button variant="contained" size="large" component={Link} to={'/'}>
                    Go Home
                </Button>
            </Box>
        </Container>
    );
}
