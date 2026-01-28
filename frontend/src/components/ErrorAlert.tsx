import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import Alert from '@mui/material/Alert';
import ListItem from '@mui/material/ListItem';

interface ErrorAlertProps {
    messages: string[];
    onClose: () => void;
}

export default function ErrorAlert({ messages, onClose }: ErrorAlertProps) {
    return (
        <Alert severity="error" onClose={onClose}>
            <List dense disablePadding>
                {messages.map((msg: string) => (
                    <ListItem key={`${msg}_list_item`} disableGutters>
                        <ListItemText primary={msg} />
                    </ListItem>
                ))}
            </List>
        </Alert>
    );
}
