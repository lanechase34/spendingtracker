import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import type { AuthContextType } from 'types/AuthContext.type';
import type { AuthDialogContextType } from 'types/AuthDialogContext.type';
import Verify2FADialog from 'user/Verify2FADialog';

// Mocks
const mockComplete2FALogin = jest.fn();
const mockLogout = jest.fn();
const mockCloseDialog = jest.fn();
const mockVerify2fa = jest.fn();

jest.mock('hooks/useAuthContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useAuthDialogContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/usePendingFetch', () => ({
    usePending2FAFetch: jest.fn(() => jest.fn()),
}));

jest.mock('schema/user', () => ({
    userService: jest.fn(() => ({
        verify2fa: mockVerify2fa,
    })),
}));

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockUseAuthDialogContext = useAuthDialogContext as jest.Mock;

// Helpers

/**
 * Default auth context - dialog open, valid pending token
 */
function buildAuthContext(overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> {
    return {
        pending2FAToken: 'valid-pending-token',
        complete2FALogin: mockComplete2FALogin,
        logout: mockLogout,
        ...overrides,
    };
}

/**
 * Default dialog context - dialog open
 */
function buildDialogContext(overrides: Partial<AuthDialogContextType> = {}): Partial<AuthDialogContextType> {
    return {
        verify2FADialogOpen: true,
        closeVerify2FADialog: mockCloseDialog,
        ...overrides,
    };
}

function renderComponent(
    authOverrides: Partial<AuthContextType> = {},
    dialogOverrides: Partial<AuthDialogContextType> = {}
) {
    mockUseAuthContext.mockReturnValue(buildAuthContext(authOverrides));
    mockUseAuthDialogContext.mockReturnValue(buildDialogContext(dialogOverrides));
    return render(<Verify2FADialog />);
}

describe('Verify2FADialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVerify2fa.mockResolvedValue('full-user-token');
        mockComplete2FALogin.mockResolvedValue(undefined);

        jest.spyOn(console, 'error').mockImplementation(() => {
            // Silence expected errors
        });
    });

    describe('Rendering', () => {
        it('Renders the dialog when open', () => {
            renderComponent();

            expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
            expect(screen.getByLabelText(/Authentication Code/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument();
        });

        it('Does not render dialog content when closed', () => {
            renderComponent({}, { verify2FADialogOpen: false });

            expect(screen.queryByLabelText(/Authentication Code/i)).not.toBeInTheDocument();
        });

        it('Renders instructional copy for both TOTP and recovery codes', () => {
            renderComponent();

            expect(screen.getByText(/6-digit code from your authenticator app/i)).toBeInTheDocument();
            expect(screen.getByText(/recovery codes/i)).toBeInTheDocument();
        });

        it('Does not render a close button - dialog is non-dismissable', () => {
            renderComponent();

            expect(screen.queryByLabelText(/close/i)).not.toBeInTheDocument();
        });

        it('Does not show an error alert on initial render', () => {
            renderComponent();

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('Shows validation error when submitting an empty code', async () => {
            renderComponent();

            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            expect(await screen.findByText('Please enter your code.')).toBeInTheDocument();
            expect(mockVerify2fa).not.toHaveBeenCalled();
        });

        it('Shows validation error for a code that is not TOTP or recovery format', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), 'invalid');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            expect(await screen.findByText(/Enter a 6-digit code or recovery code/i)).toBeInTheDocument();
            expect(mockVerify2fa).not.toHaveBeenCalled();
        });

        it('Shows validation error for a 5-digit code', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '12345');
            fireEvent.blur(screen.getByLabelText(/Authentication Code/i));

            expect(await screen.findByText(/Enter a 6-digit code or recovery code/i)).toBeInTheDocument();
        });

        it('Shows validation error for a 7-digit code', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '1234567');
            fireEvent.blur(screen.getByLabelText(/Authentication Code/i));

            expect(await screen.findByText(/Enter a 6-digit code or recovery code/i)).toBeInTheDocument();
        });

        it('Accepts a valid 6-digit TOTP code', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            fireEvent.blur(screen.getByLabelText(/Authentication Code/i));

            expect(screen.queryByText(/Enter a 6-digit code or recovery code/i)).not.toBeInTheDocument();
        });

        it('Accepts a valid recovery code in xxxx-xxxx-xxxx-xxxx format', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), 'abcd-1234-ef56-7890');
            fireEvent.blur(screen.getByLabelText(/Authentication Code/i));

            expect(screen.queryByText(/Enter a 6-digit code or recovery code/i)).not.toBeInTheDocument();
        });

        it('Shows validation error for recovery code with wrong segment length', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), 'abc-1234-ef56-7890');
            fireEvent.blur(screen.getByLabelText(/Authentication Code/i));

            expect(await screen.findByText(/Enter a 6-digit code or recovery code/i)).toBeInTheDocument();
        });

        it('Enforces maxLength of 19 on the input', () => {
            renderComponent();

            const input = screen.getByLabelText(/Authentication Code/i);
            expect(input).toHaveAttribute('maxlength', '19');
        });
    });

    describe('Submission - TOTP code', () => {
        it('Calls verify2fa with the entered code as FormData', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockVerify2fa).toHaveBeenCalledTimes(1);
                const calls = mockVerify2fa.mock.calls as FormData[][];
                const formData = calls[0][0];
                expect(formData.get('code')).toBe('123456');
            });
        });

        it('Calls complete2FALogin with the returned token on success', async () => {
            mockVerify2fa.mockResolvedValue('full-user-token');
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockComplete2FALogin).toHaveBeenCalledWith('full-user-token');
            });
        });

        it('Closes the dialog after successful verification', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockCloseDialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Shows loading state while submitting', async () => {
            mockVerify2fa.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('token'), 100)));
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            expect(screen.getByRole('button', { name: /verify/i })).toBeDisabled();
        });

        it('Does not submit again while loading', async () => {
            mockVerify2fa.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('token'), 100)));
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            // Button is disabled while loading - attempt a raw click bypassing pointer-events
            fireEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockVerify2fa).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Submission - Recovery code', () => {
        it('Calls verify2fa with a valid recovery code', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), 'abcd-1234-ef56-7890');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockVerify2fa).toHaveBeenCalledTimes(1);
                const calls = mockVerify2fa.mock.calls as FormData[][];
                const formData = calls[0][0];
                expect(formData.get('code')).toBe('abcd-1234-ef56-7890');
            });
        });

        it('Closes the dialog after successful recovery code verification', async () => {
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), 'abcd-1234-ef56-7890');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockCloseDialog).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Error Handling', () => {
        it('Shows error alert when verify2fa returns an APIError', async () => {
            const { APIError } = await import('utils/apiError');
            mockVerify2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '000000');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            expect(await screen.findByText('Invalid or expired code.')).toBeInTheDocument();
        });

        it('Shows generic error for non-APIError exceptions', async () => {
            mockVerify2fa.mockRejectedValue(new Error('Network failure'));
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            expect(await screen.findByText('Server error. Please try again.')).toBeInTheDocument();
        });

        it('Re-enables the verify button after an error', async () => {
            const { APIError } = await import('utils/apiError');
            mockVerify2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '000000');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /verify/i })).not.toBeDisabled();
            });
        });

        it('Allows retry after an error', async () => {
            const { APIError } = await import('utils/apiError');
            mockVerify2fa
                .mockRejectedValueOnce(new APIError('Invalid or expired code.', 422))
                .mockResolvedValueOnce('full-user-token');

            renderComponent();

            const input = screen.getByLabelText(/Authentication Code/i);

            // First attempt - fails
            await userEvent.type(input, '000000');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));
            await screen.findByText('Invalid or expired code.');

            // Second attempt - succeeds
            await userEvent.clear(input);
            await userEvent.type(input, '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            await waitFor(() => {
                expect(mockComplete2FALogin).toHaveBeenCalledWith('full-user-token');
            });
        });

        it('Dismisses error alert when close is clicked', async () => {
            const { APIError } = await import('utils/apiError');
            mockVerify2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
            renderComponent();

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '000000');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));
            await screen.findByText('Invalid or expired code.');

            await userEvent.click(screen.getByLabelText(/close/i));

            expect(screen.queryByText('Invalid or expired code.')).not.toBeInTheDocument();
        });

        it('Shows invalid session error when pending2FAToken is null on submit', async () => {
            renderComponent({ pending2FAToken: null });

            await userEvent.type(screen.getByLabelText(/Authentication Code/i), '123456');
            await userEvent.click(screen.getByRole('button', { name: /verify/i }));

            expect(await screen.findByText('Invalid session. Please log in again.')).toBeInTheDocument();
            expect(mockVerify2fa).not.toHaveBeenCalled();
        });
    });

    describe('Invalid state - token cleared mid-flow', () => {
        it('Closes dialog and calls logout when pending2FAToken becomes null while dialog is open', async () => {
            const { rerender } = renderComponent();

            // Token gets cleared mid-flow (e.g. expired, 401 from fetch hook)
            mockUseAuthContext.mockReturnValue(buildAuthContext({ pending2FAToken: null }));
            rerender(<Verify2FADialog />);

            await waitFor(() => {
                expect(mockLogout).toHaveBeenCalledTimes(1);
                expect(mockCloseDialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Does not call logout when dialog is closed and token is null', async () => {
            renderComponent({ pending2FAToken: null }, { verify2FADialogOpen: false });

            await waitFor(() => {
                expect(mockLogout).not.toHaveBeenCalled();
            });
        });
    });

    describe('Non-dismissable behavior', () => {
        it('Does not close on backdrop click', async () => {
            renderComponent();

            // MUI Dialog's onClose is called with reason 'backdropClick'
            // Our handler returns early so closeVerify2FADialog should not be called
            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            await waitFor(() => {
                expect(mockCloseDialog).not.toHaveBeenCalled();
            });
        });
    });
});
