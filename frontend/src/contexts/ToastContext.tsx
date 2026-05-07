import { Alert, Snackbar } from '@mui/material';
import type { ReactNode, SyntheticEvent } from 'react';
import { createContext, useCallback, useReducer, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type?: ToastType;
}

interface ToastState {
    queue: Toast[];
    current: Toast | null;
    open: boolean;
}

type ToastAction = { type: 'ENQUEUE'; toast: Toast } | { type: 'CLOSE' } | { type: 'EXITED' };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
    switch (action.type) {
        case 'ENQUEUE':
            if (!state.current) {
                return { queue: [], current: action.toast, open: true };
            }
            return { ...state, queue: [...state.queue, action.toast] };
        case 'CLOSE':
            return { ...state, open: false };
        case 'EXITED':
            if (state.queue.length > 0) {
                return { queue: state.queue.slice(1), current: state.queue[0], open: true };
            }
            return { ...state, current: null };
    }
}

export interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastContextProvider = ({ children }: { children: ReactNode }) => {
    const [{ current, open }, dispatch] = useReducer(toastReducer, {
        queue: [],
        current: null,
        open: false,
    });

    const nextIdRef = useRef<number>(0);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        dispatch({ type: 'ENQUEUE', toast: { id: nextIdRef.current++, message, type } });
    }, []);

    const handleClose = useCallback((_event: SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') return;
        dispatch({ type: 'CLOSE' });
    }, []);

    const handleExited = useCallback(() => {
        dispatch({ type: 'EXITED' });
    }, []);

    return (
        <ToastContext value={{ showToast }}>
            {children}
            <Snackbar
                key={current?.id}
                open={open}
                autoHideDuration={5000}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                slotProps={{
                    transition: {
                        onExited: handleExited,
                    },
                }}
            >
                <Alert onClose={handleClose} severity={current?.type}>
                    {current?.message}
                </Alert>
            </Snackbar>
        </ToastContext>
    );
};
