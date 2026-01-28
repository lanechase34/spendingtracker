import Button from '@mui/material/Button';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import type { ReactNode } from 'react';

interface LoginDialogButtonProps {
    icon?: ReactNode;
    disabled?: boolean;
    variant?: 'contained' | 'text' | 'outlined';
    size?: 'small' | 'medium' | 'large';
}

export default function LoginDialogButton({
    icon,
    disabled = false,
    variant = 'outlined',
    size = 'medium',
}: LoginDialogButtonProps) {
    const { openLoginDialog } = useAuthDialogContext();

    return (
        <Button disabled={disabled} size={size} variant={variant} onClick={() => openLoginDialog()}>
            {icon && icon}
            Log In
        </Button>
    );
}
