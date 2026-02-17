import DeleteIcon from '@mui/icons-material/Delete';
import Button from '@mui/material/Button';
import type { MouseEvent } from 'react';

interface DeleteButtonProps {
    rowId: string | number;
    onClick: (rowId: string | number) => void;
    disabled?: boolean;
    variant?: 'contained' | 'text' | 'outlined';
    size?: 'small' | 'medium' | 'large';
}

/**
 * Delete button with Trash Can icon
 */
export default function DeleteButton({
    rowId,
    onClick,
    disabled,
    variant = 'outlined',
    size = 'medium',
}: DeleteButtonProps) {
    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation(); // stop row selection
        onClick(rowId);
    };

    return (
        <Button
            color="error"
            aria-label="delete"
            disabled={disabled}
            size={size}
            variant={variant}
            onClick={handleClick}
        >
            <DeleteIcon fontSize="small" />
        </Button>
    );
}
