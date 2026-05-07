import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ToastContextType } from 'contexts/ToastContext';
import { ToastContext, ToastContextProvider } from 'contexts/ToastContext';
import { useContext } from 'react';

// Mocks

/**
 * Minimal MUI mock that mirrors the new single-Snackbar architecture.
 *
 * Key differences from the old mock:
 *  - Only ONE Snackbar is ever rendered at a time (queue-based).
 *  - `slotProps.transition.onExited` must be called to drive the EXITED action
 *    so the next queued toast can appear.
 *  - `onClose` receives an optional `reason` string so we can test clickaway.
 */
jest.mock('@mui/material', () => ({
    Snackbar: ({
        children,
        open,
        onClose,
        autoHideDuration,
        slotProps,
    }: {
        children: React.ReactNode;
        open: boolean;
        onClose: (event: object, reason?: string) => void;
        autoHideDuration: number;
        slotProps?: { transition?: { onExited?: () => void } };
    }) =>
        open ? (
            <div data-testid="snackbar" data-auto-hide-duration={autoHideDuration}>
                {children}
                {/* Normal close */}
                <button onClick={(e) => onClose(e)} data-testid="snackbar-close">
                    Snackbar Close
                </button>
                {/* Simulates MUI's clickaway reason */}
                <button onClick={(e) => onClose(e, 'clickaway')} data-testid="snackbar-clickaway">
                    Clickaway
                </button>
                {/* Simulates the exit-animation completing → triggers EXITED */}
                <button onClick={() => slotProps?.transition?.onExited?.()} data-testid="snackbar-exited">
                    Exited
                </button>
            </div>
        ) : (
            // Keep the exited button accessible even when closed so tests can
            // fire the transition callback after the snackbar hides.
            <div data-testid="snackbar-hidden">
                <button onClick={() => slotProps?.transition?.onExited?.()} data-testid="snackbar-exited">
                    Exited
                </button>
            </div>
        ),

    Alert: ({ children, onClose, severity }: { children: React.ReactNode; onClose: () => void; severity?: string }) => (
        <div data-testid="alert" data-severity={severity}>
            <span data-testid="alert-message">{children}</span>
            <button onClick={onClose} data-testid="alert-close">
                Alert Close
            </button>
        </div>
    ),
}));

// Helpers
function TestConsumer() {
    const context = useContext(ToastContext);
    if (!context) return <div data-testid="no-context">No context</div>;
    return (
        <div>
            <button onClick={() => context.showToast('Hello world')} data-testid="show-default">
                Show Default
            </button>
            <button onClick={() => context.showToast('Success message', 'success')} data-testid="show-success">
                Show Success
            </button>
            <button onClick={() => context.showToast('Error message', 'error')} data-testid="show-error">
                Show Error
            </button>
            <button onClick={() => context.showToast('Info message', 'info')} data-testid="show-info">
                Show Info
            </button>
            <button onClick={() => context.showToast('Warning message', 'warning')} data-testid="show-warning">
                Show Warning
            </button>
        </div>
    );
}

function renderWithProvider() {
    return render(
        <ToastContextProvider>
            <TestConsumer />
        </ToastContextProvider>
    );
}

/**
 * Helper: simulate the full close + exit-transition cycle so the next queued
 * toast surfaces. This mirrors what MUI does automatically in a real browser.
 */
async function dismissCurrentToast(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByTestId('snackbar-close'));
    await user.click(screen.getByTestId('snackbar-exited'));
}

describe('toastReducer - ENQUEUE', () => {
    it('Shows the first toast immediately (no current toast)', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));

        expect(screen.getByTestId('snackbar')).toBeInTheDocument();
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Hello world');
    });

    it('Queues a second toast while the first is still showing', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));

        // Only one snackbar visible at a time
        expect(screen.getAllByTestId('snackbar')).toHaveLength(1);
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Success message');
    });
});

describe('toastReducer - CLOSE', () => {
    it('Hides the snackbar when CLOSE is dispatched (snackbar-close clicked)', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('snackbar-close'));

        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });

    it('Does NOT close when reason is clickaway', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('snackbar-clickaway'));

        // Snackbar must still be visible
        expect(screen.getByTestId('snackbar')).toBeInTheDocument();
    });

    it('Closes via Alert onClose button', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('alert-close'));

        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });
});

describe('toastReducer - EXITED', () => {
    it('Clears current toast after the exit transition fires with empty queue', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('snackbar-close'));
        await user.click(screen.getByTestId('snackbar-exited'));

        // Hidden wrapper present but no visible snackbar
        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
        expect(screen.getByTestId('snackbar-hidden')).toBeInTheDocument();
    });

    it('Advances to the next queued toast after exit transition', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));

        // Dismiss first
        await dismissCurrentToast(user);

        // Second toast should now be visible
        expect(screen.getByTestId('snackbar')).toBeInTheDocument();
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Error message');
    });

    it('Sequences three toasts in FIFO order', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));
        await user.click(screen.getByTestId('show-warning'));

        // 1st
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Success message');
        await dismissCurrentToast(user);

        // 2nd
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Error message');
        await dismissCurrentToast(user);

        // 3rd
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Warning message');
        await dismissCurrentToast(user);

        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });
});

describe('ToastContext', () => {
    it('Is undefined when consumed outside a provider', () => {
        render(<TestConsumer />);
        expect(screen.getByTestId('no-context')).toBeInTheDocument();
    });
});

describe('ToastContextProvider - rendering', () => {
    it('Renders children correctly', () => {
        render(
            <ToastContextProvider>
                <div data-testid="child">Child</div>
            </ToastContextProvider>
        );
        expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('Renders multiple children correctly', () => {
        render(
            <ToastContextProvider>
                <div data-testid="child-1">First</div>
                <div data-testid="child-2">Second</div>
            </ToastContextProvider>
        );
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('Shows no visible toast initially', () => {
        renderWithProvider();
        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });
});

describe('ToastContextProvider - showToast', () => {
    it('Shows a toast when showToast is called', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));

        expect(screen.getByTestId('snackbar')).toBeInTheDocument();
    });

    it('Displays the correct message in the toast', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));

        expect(screen.getByTestId('alert-message')).toHaveTextContent('Hello world');
    });

    it('Defaults to info severity when no type is provided', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));

        expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'info');
    });

    it('Shows a success toast with correct severity', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));

        expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'success');
    });

    it('Shows an error toast with correct severity', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-error'));

        expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'error');
    });

    it('Shows an info toast with correct severity', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-info'));

        expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'info');
    });

    it('Shows a warning toast with correct severity', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-warning'));

        expect(screen.getByTestId('alert')).toHaveAttribute('data-severity', 'warning');
    });

    it('Sets autoHideDuration to 5000ms on the Snackbar', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));

        expect(screen.getByTestId('snackbar')).toHaveAttribute('data-auto-hide-duration', '5000');
    });

    it('Assigns unique ids to toasts using Date.now()', async () => {
        const user = userEvent.setup();

        let callCount = 0;
        jest.spyOn(Date, 'now').mockImplementation(() => ++callCount);

        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        // Queue a second; it will surface after dismissing the first
        await user.click(screen.getByTestId('show-error'));
        await dismissCurrentToast(user);

        // Both surfaced - they had different ids (1 and 2)
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Error message');

        jest.spyOn(Date, 'now').mockRestore();
    });
});

describe('ToastContextProvider - dismissal via Snackbar onClose', () => {
    it('Hides the toast when the Snackbar close button is clicked', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('snackbar-close'));

        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });

    it('Does not dismiss on clickaway', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('snackbar-clickaway'));

        expect(screen.getByTestId('snackbar')).toBeInTheDocument();
    });
});

describe('ToastContextProvider - dismissal via Alert onClose', () => {
    it('Hides the toast when the Alert close button is clicked', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        await user.click(screen.getByTestId('alert-close'));

        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });
});

describe('ToastContextProvider - showToast referential stability', () => {
    it('Maintains a stable showToast reference across re-renders (useCallback)', async () => {
        const user = userEvent.setup();
        const capturedRefs = new Set<ToastContextType['showToast']>();

        function RefCapture() {
            const context = useContext(ToastContext);
            if (!context) return null;
            capturedRefs.add(context.showToast);
            return (
                <button onClick={() => context.showToast('Ref test')} data-testid="ref-btn">
                    Show
                </button>
            );
        }

        render(
            <ToastContextProvider>
                <RefCapture />
            </ToastContextProvider>
        );

        await user.click(screen.getByTestId('ref-btn'));
        await user.click(screen.getByTestId('ref-btn'));

        expect(capturedRefs.size).toBe(1);
    });
});

describe('ToastContextProvider - unique id generation', () => {
    it('Assigns unique ids to all toasts even when enqueued in the same tick', async () => {
        const TOAST_COUNT = 20;

        function BurstButton() {
            const context = useContext(ToastContext);
            if (!context) return null;
            return (
                <button
                    data-testid="show-burst"
                    onClick={() => {
                        for (let i = 0; i < TOAST_COUNT; i++) {
                            context.showToast(`Toast ${i}`);
                        }
                    }}
                >
                    Burst
                </button>
            );
        }

        const user = userEvent.setup();
        render(
            <ToastContextProvider>
                <BurstButton />
            </ToastContextProvider>
        );

        await user.click(screen.getByTestId('show-burst'));

        for (let i = 0; i < TOAST_COUNT; i++) {
            expect(screen.getByTestId('alert-message')).toHaveTextContent(`Toast ${i}`);
            await dismissCurrentToast(user);
        }

        expect(screen.queryByTestId('snackbar')).not.toBeInTheDocument();
    });
});
