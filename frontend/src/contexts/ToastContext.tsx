import { Alert, Snackbar } from '@mui/material';
import { createContext, ReactNode, useCallback, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type?: ToastType;
}

export interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastContextProvider = ({ children }: { children: ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Date.now(); // simple unique id
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const handleClose = (id: number) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    };

    return (
        <ToastContext value={{ showToast }}>
            {children}
            {toasts.map((toast) => (
                <Snackbar
                    key={toast.id}
                    open
                    autoHideDuration={5000}
                    onClose={() => handleClose(toast.id)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert onClose={() => handleClose(toast.id)} severity={toast.type}>
                        {toast.message}
                    </Alert>
                </Snackbar>
            ))}
        </ToastContext>
    );
};
