import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthFetch_ from 'hooks/useAuthFetch';
import useToastContext_ from 'hooks/useToastContext';
import Disable2FADialog from 'user/Disable2FADialog';
import { APIError } from 'utils/apiError';

configure({ asyncUtilTimeout: 200 });

// Mocks
const mockOnClose = jest.fn();
const mockOnDisabled = jest.fn();
const mockShowToast = jest.fn();
const mockDisable2fa = jest.fn();

jest.mock('hooks/useAuthFetch', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useToastContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('schema/user', () => ({
    userService: jest.fn(() => ({
        disable2fa: mockDisable2fa,
    })),
}));

beforeAll(() =>
    jest.spyOn(console, 'error').mockImplementation(() => {
        // empty
    })
);
afterAll(() => (console.error as jest.Mock).mockRestore());

const mockUseAuthFetch = useAuthFetch_ as jest.Mock;
const mockUseToastContext = useToastContext_ as jest.Mock;

// Helpers
function renderComponent(
    props: {
        open?: boolean;
        onClose?: () => void;
        onDisabled?: () => void;
    } = {}
) {
    mockUseAuthFetch.mockReturnValue(jest.fn());
    mockUseToastContext.mockReturnValue({ showToast: mockShowToast });

    return render(
        <Disable2FADialog
            open={props.open ?? true}
            onClose={props.onClose ?? mockOnClose}
            onDisabled={props.onDisabled ?? mockOnDisabled}
        />
    );
}

const user = userEvent.setup({ delay: null });

describe('Disable2FADialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDisable2fa.mockResolvedValue(undefined);
    });

    describe('Rendering', () => {
        it('Renders the dialog when open', () => {
            renderComponent();

            expect(screen.getByRole('heading', { name: /disable two-factor authentication/i })).toBeInTheDocument();
            expect(screen.getByLabelText(/authentication code/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });

        it('Does not render when closed', () => {
            renderComponent({ open: false });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('Renders instructional copy for TOTP and recovery codes', () => {
            renderComponent();

            expect(screen.getByText(/6-digit authenticator code/i)).toBeInTheDocument();
            expect(screen.getByText(/recovery codes/i)).toBeInTheDocument();
        });

        it('Renders close icon button', () => {
            renderComponent();

            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        it('Does not show error alert on initial render', () => {
            renderComponent();

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('Renders Disable 2FA button with error color', () => {
            renderComponent();

            const button = screen.getByRole('button', { name: /disable 2fa/i });
            expect(button).toBeInTheDocument();
            // MUI error color class applied
            expect(button.className).toMatch(/colorError/i);
        });

        it('Code input is empty on initial render', () => {
            renderComponent();

            expect(screen.getByLabelText<HTMLInputElement>(/authentication code/i).value).toBe('');
        });

        it('Enforces maxLength of 19 on code input', () => {
            renderComponent();

            expect(screen.getByLabelText(/authentication code/i)).toHaveAttribute('maxlength', '19');
        });
    });

    describe('Form validation', () => {
        it('Shows validation error when submitting empty code', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            expect(await screen.findByText('Please enter your code.')).toBeInTheDocument();
            expect(mockDisable2fa).not.toHaveBeenCalled();
        });

        it('Shows validation error for code that is not TOTP or recovery format', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/authentication code/i), 'invalid');
            fireEvent.blur(screen.getByLabelText(/authentication code/i));

            expect(await screen.findByText(/6-digit code or recovery code/i)).toBeInTheDocument();
        });

        it('Shows validation error for 5-digit code', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/authentication code/i), '12345');
            fireEvent.blur(screen.getByLabelText(/authentication code/i));

            expect(await screen.findByText(/6-digit code or recovery code/i)).toBeInTheDocument();
        });

        it('Shows validation error for 7-digit code', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/authentication code/i), '1234567');
            fireEvent.blur(screen.getByLabelText(/authentication code/i));

            expect(await screen.findByText(/6-digit code or recovery code/i)).toBeInTheDocument();
        });

        it('Accepts valid 6-digit TOTP code', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/authentication code/i), '123456');
            fireEvent.blur(screen.getByLabelText(/authentication code/i));

            expect(screen.queryByText(/6-digit code or recovery code/i)).not.toBeInTheDocument();
        });

        it('Accepts valid recovery code in xxxx-xxxx-xxxx-xxxx format', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/authentication code/i), 'abcd-1234-ef56-7890');
            fireEvent.blur(screen.getByLabelText(/authentication code/i));

            expect(screen.queryByText(/6-digit code or recovery code/i)).not.toBeInTheDocument();
        });

        it('Does not call disable2fa when validation fails', async () => {
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: 'bad' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            expect(mockDisable2fa).not.toHaveBeenCalled();
        });
    });

    describe('Successful disable flow', () => {
        it('Calls disable2fa with the entered TOTP code', async () => {
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(mockDisable2fa).toHaveBeenCalledWith('123456');
            });
        });

        it('Calls disable2fa with a recovery code', async () => {
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: 'abcd-1234-ef56-7890' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(mockDisable2fa).toHaveBeenCalledWith('abcd-1234-ef56-7890');
            });
        });

        it('Calls onDisabled after successful disable', async () => {
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(mockOnDisabled).toHaveBeenCalledTimes(1);
            });
        });

        it('Shows success toast after successful disable', async () => {
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith('Two-factor authentication has been disabled.', 'success');
            });
        });

        it('Calls onClose after successful disable', async () => {
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalledTimes(1);
            });
        });

        it('Calls onDisabled before onClose', async () => {
            const callOrder: string[] = [];
            mockOnDisabled.mockImplementation(() => callOrder.push('onDisabled'));
            mockOnClose.mockImplementation(() => callOrder.push('onClose'));

            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(callOrder).toEqual(['onDisabled', 'onClose']);
            });
        });

        it('Shows loading state while submitting', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeDisabled();
            });
        });

        it('Disables code input while loading', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByLabelText(/authentication code/i)).toBeDisabled();
            });
        });

        it('Disables cancel button while loading', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
            });
        });

        it('Disables close icon button while loading', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
            });
        });

        it('Does not submit again while loading', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /disable 2fa/i })).toBeDisabled();
            });

            fireEvent.click(screen.getByRole('button', { name: /disable 2fa/i }));
            expect(mockDisable2fa).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error handling', () => {
        it('Shows error alert when disable2fa returns an APIError', async () => {
            mockDisable2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            expect(await screen.findByText('Invalid or expired code.')).toBeInTheDocument();
        });

        it('Shows generic error for non-APIError exceptions', async () => {
            mockDisable2fa.mockRejectedValue(new Error('Network failure'));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            expect(await screen.findByText('Server error. Please try again.')).toBeInTheDocument();
        });

        it('Re-enables the submit button after an error', async () => {
            mockDisable2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
            await screen.findByText('Invalid or expired code.');

            expect(screen.getByRole('button', { name: /disable 2fa/i })).not.toBeDisabled();
        });

        it('Resets code field after error so user can retry', async () => {
            mockDisable2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
            await screen.findByText('Invalid or expired code.');

            expect(screen.getByLabelText<HTMLInputElement>(/authentication code/i).value).toBe('');
        });

        it('Does not call onDisabled on error', async () => {
            mockDisable2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
            await screen.findByText('Invalid or expired code.');

            expect(mockOnDisabled).not.toHaveBeenCalled();
        });

        it('Does not call onClose on error', async () => {
            mockDisable2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
            await screen.findByText('Invalid or expired code.');

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Allows retry after error', async () => {
            mockDisable2fa
                .mockRejectedValueOnce(new APIError('Invalid or expired code.', 422))
                .mockResolvedValueOnce(undefined);

            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
            await screen.findByText('Invalid or expired code.');

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(mockOnDisabled).toHaveBeenCalledTimes(1);
            });
        });

        it('Dismisses error alert when close is clicked', async () => {
            mockDisable2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '000000' },
            });
            await user.click(screen.getByRole('button', { name: /disable 2fa/i }));
            await screen.findByText('Invalid or expired code.');

            await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /close/i }));

            expect(screen.queryByText('Invalid or expired code.')).not.toBeInTheDocument();
        });
    });

    describe('Dialog behavior', () => {
        it('Calls onClose when Cancel is clicked', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /cancel/i }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('Calls onClose when close icon is clicked', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /close/i }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('Does not close on backdrop click', () => {
            renderComponent();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Does not close on escape key press', () => {
            renderComponent();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Does not close while loading when cancel is clicked', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
            });

            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Does not close while loading when close icon is clicked', async () => {
            mockDisable2fa.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(screen.getByLabelText(/authentication code/i), {
                target: { value: '123456' },
            });
            void user.click(screen.getByRole('button', { name: /disable 2fa/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
            });

            fireEvent.click(screen.getByRole('button', { name: /close/i }));
            expect(mockOnClose).not.toHaveBeenCalled();
        });
    });
});
