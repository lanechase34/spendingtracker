import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

interface EmptyCardProps {
    emptyMessage?: string;
}

export default function EmptyCard({ emptyMessage = 'No data available for this period.' }: EmptyCardProps) {
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
                {emptyMessage}
            </CardContent>
        </Card>
    );
}
