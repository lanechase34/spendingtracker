import Button from '@mui/material/Button';
import { Link } from 'react-router-dom';

interface NavBtnProps {
    url: string;
    text: string;
}

export default function NavBtn({ url, text }: NavBtnProps) {
    return (
        <Button variant="outlined" component={Link} to={url}>
            {text}
        </Button>
    );
}
