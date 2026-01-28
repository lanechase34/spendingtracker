import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';

interface LoadingCardProps {
    loadingMessage?: string;
}

export default function LoadingCard({ loadingMessage = 'Loading...' }: LoadingCardProps) {
    return (
        <Card>
            <CardContent
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    '&:last-child': {
                        paddingBottom: '16px',
                    },
                }}
            >
                <CircularProgress sx={{ mr: 2 }} />
                {loadingMessage}
            </CardContent>
        </Card>
    );
}
