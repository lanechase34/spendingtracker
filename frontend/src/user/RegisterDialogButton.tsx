import Button from '@mui/material/Button';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import type { ReactNode } from 'react';

interface RegisterDialogButtonProps {
    text?: string;
    icon?: ReactNode;
    disabled?: boolean;
    variant?: 'contained' | 'text' | 'outlined';
    size?: 'small' | 'medium' | 'large';
}

export default function RegisterDialogButton({
    text = 'Register',
    icon,
    disabled = false,
    variant = 'outlined',
    size = 'medium',
}: RegisterDialogButtonProps) {
    const { openRegisterDialog } = useAuthDialogContext();

    return (
        <Button disabled={disabled} size={size} variant={variant} onClick={() => openRegisterDialog()}>
            {icon && icon}
            {text}
        </Button>
    );
}
