import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ToastContextType } from 'contexts/ToastContext';
import { ToastContext, ToastContextProvider } from 'contexts/ToastContext';
import { useContext } from 'react';

// Mocks
jest.mock('@mui/material', () => ({
    Snackbar: ({
        children,
        open,
        onClose,
        autoHideDuration,
    }: {
        children: React.ReactNode;
        open: boolean;
        onClose: () => void;
        autoHideDuration: number;
    }) =>
        open ? (
            <div data-testid="snackbar" data-auto-hide-duration={autoHideDuration}>
                {children}
                <button onClick={onClose} data-testid="snackbar-close">
                    Snackbar Close
                </button>
            </div>
        ) : null,
    Alert: ({ children, onClose, severity }: { children: React.ReactNode; onClose: () => void; severity: string }) => (
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

    it('Renders no toasts initially', () => {
        renderWithProvider();
        expect(screen.queryAllByTestId('snackbar')).toHaveLength(0);
    });
});

describe('ToastContextProvider - showToast', () => {
    it('Shows a toast when showToast is called', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));

        expect(screen.getAllByTestId('snackbar')).toHaveLength(1);
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
});

describe('ToastContextProvider - multiple toasts', () => {
    it('Renders multiple toasts when showToast is called multiple times', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));
        await user.click(screen.getByTestId('show-warning'));

        expect(screen.getAllByTestId('snackbar')).toHaveLength(3);
    });

    it('Each toast displays its own message', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));

        const messages = screen.getAllByTestId('alert-message');
        expect(messages[0]).toHaveTextContent('Success message');
        expect(messages[1]).toHaveTextContent('Error message');
    });

    it('Each toast displays its own severity', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));

        const alerts = screen.getAllByTestId('alert');
        expect(alerts[0]).toHaveAttribute('data-severity', 'success');
        expect(alerts[1]).toHaveAttribute('data-severity', 'error');
    });

    it('Assigns a unique id to each toast using Date.now()', async () => {
        const user = userEvent.setup();

        let callCount = 0;
        jest.spyOn(Date, 'now').mockImplementation(() => {
            callCount += 1;
            return callCount;
        });

        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));

        expect(screen.getAllByTestId('snackbar')).toHaveLength(2);

        jest.spyOn(Date, 'now').mockRestore();
    });
});

describe('ToastContextProvider - dismissal via Snackbar onClose', () => {
    it('Removes the toast when the Snackbar close button is clicked', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        expect(screen.getAllByTestId('snackbar')).toHaveLength(1);

        await user.click(screen.getByTestId('snackbar-close'));
        expect(screen.queryAllByTestId('snackbar')).toHaveLength(0);
    });

    it('Only removes the correct toast when multiple toasts are open', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-error'));
        expect(screen.getAllByTestId('snackbar')).toHaveLength(2);

        // Close only the first snackbar
        await user.click(screen.getAllByTestId('snackbar-close')[0]);
        expect(screen.getAllByTestId('snackbar')).toHaveLength(1);
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Error message');
    });
});

describe('ToastContextProvider - dismissal via Alert onClose', () => {
    it('Removes the toast when the Alert close button is clicked', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-default'));
        expect(screen.getAllByTestId('snackbar')).toHaveLength(1);

        await user.click(screen.getByTestId('alert-close'));
        expect(screen.queryAllByTestId('snackbar')).toHaveLength(0);
    });

    it('Only removes the correct toast via Alert close when multiple toasts are open', async () => {
        const user = userEvent.setup();
        renderWithProvider();

        await user.click(screen.getByTestId('show-success'));
        await user.click(screen.getByTestId('show-warning'));
        expect(screen.getAllByTestId('snackbar')).toHaveLength(2);

        await user.click(screen.getAllByTestId('alert-close')[0]);
        expect(screen.getAllByTestId('snackbar')).toHaveLength(1);
        expect(screen.getByTestId('alert-message')).toHaveTextContent('Warning message');
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
