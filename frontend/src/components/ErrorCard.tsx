import Alert from '@mui/material/Alert';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

interface ErrorCardProps {
    errorMessage?: string;
}

export default function ErrorCard({ errorMessage = 'Error. Please try again.' }: ErrorCardProps) {
    return (
        <Card data-testid="error-card">
            <CardContent>
                <Alert severity="error">{errorMessage}</Alert>
            </CardContent>
        </Card>
    );
}
