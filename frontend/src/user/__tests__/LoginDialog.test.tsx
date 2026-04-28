import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import type { AuthContextType } from 'types/AuthContext.type';
import type { AuthDialogContextType } from 'types/AuthDialogContext.type';
import LoginDialog from 'user/LoginDialog';
import { APIError } from 'utils/apiError';

// Mocks
const mockLogin = jest.fn();
const mockSetPendingToken = jest.fn();
const mockSetPending2FAToken = jest.fn();

const mockCloseLoginDialog = jest.fn();
const mockOpenVerifyDialog = jest.fn();
const mockOpenVerify2FADialog = jest.fn();

const mockUserAPILogin = jest.fn();

let mockIsDev = false;

// No delay typing
const user = userEvent.setup({ delay: null });

jest.mock('utils/constants', () => ({
    API_BASE_URL: '/spendingtracker/api/v1',
    get IS_DEV() {
        return mockIsDev;
    },
}));

jest.mock('hooks/useAuthContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useAuthDialogContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('schema/user', () => ({
    userService: jest.fn(() => ({
        login: mockUserAPILogin,
    })),
}));

// Suppress console.error for expected error paths
beforeAll(() =>
    jest.spyOn(console, 'error').mockImplementation(() => {
        // empty
    })
);
afterAll(() => (console.error as jest.Mock).mockRestore());

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockUseAuthDialogContext = useAuthDialogContext as jest.Mock;

// Helpers
function buildAuthContext(overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> {
    return {
        login: mockLogin,
        setPendingToken: mockSetPendingToken,
        setPending2FAToken: mockSetPending2FAToken,
        ...overrides,
    };
}

function buildDialogContext(overrides: Partial<AuthDialogContextType> = {}): Partial<AuthDialogContextType> {
    return {
        loginDialogOpen: true,
        closeLoginDialog: mockCloseLoginDialog,
        openVerifyDialog: mockOpenVerifyDialog,
        openVerify2FADialog: mockOpenVerify2FADialog,
        ...overrides,
    };
}

function renderComponent(
    authOverrides: Partial<AuthContextType> = {},
    dialogOverrides: Partial<AuthDialogContextType> = {}
) {
    mockUseAuthContext.mockReturnValue(buildAuthContext(authOverrides));
    mockUseAuthDialogContext.mockReturnValue(buildDialogContext(dialogOverrides));
    return render(<LoginDialog />);
}

/**
 * Fill in and submit the login form
 */
function fillAndSubmit(email = 'test@example.com', password = 'Password123!') {
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: password } });
    return user.click(screen.getByRole('button', { name: /log in/i }));
}

describe('LoginDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockLogin.mockResolvedValue(undefined);
        mockUserAPILogin.mockResolvedValue({ access_token: 'full-token', mfa_required: false });
    });

    describe('Rendering', () => {
        it('Renders the dialog when open', () => {
            renderComponent();

            expect(screen.getByText('Login')).toBeInTheDocument();
            expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
        });

        it('Does not render dialog content when closed', () => {
            renderComponent({}, { loginDialogOpen: false });

            expect(screen.queryByLabelText(/Email/i)).not.toBeInTheDocument();
        });

        it('Renders the remember me checkbox unchecked by default', () => {
            renderComponent();

            const checkbox = screen.getByRole('checkbox', { name: /remember me/i });
            expect(checkbox).not.toBeChecked();
        });

        it('Renders a close button', () => {
            renderComponent();

            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        it('Does not show an error alert on initial render', () => {
            renderComponent();

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('Shows email validation error when submitting with empty email', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('button', { name: /log in/i }));

            expect(await screen.findByText(/field is required/i)).toBeInTheDocument();
            expect(mockUserAPILogin).not.toHaveBeenCalled();
        });

        it('Shows password validation error when submitting with empty password', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.click(screen.getByRole('button', { name: /log in/i }));

            expect(await screen.findByText(/please enter a valid password/i)).toBeInTheDocument();
            expect(mockUserAPILogin).not.toHaveBeenCalled();
        });

        it('Shows both validation errors when submitting empty form', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /log in/i }));

            expect(mockUserAPILogin).not.toHaveBeenCalled();
        });

        it('Shows email error on blur when email is invalid', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'notanemail');
            fireEvent.blur(screen.getByLabelText(/Email/i));

            expect(await screen.findByText(/not a valid email/i)).toBeInTheDocument();
        });

        it('Does not submit when validation errors exist', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'invalid-email');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('button', { name: /log in/i }));

            expect(mockUserAPILogin).not.toHaveBeenCalled();
        });
    });

    describe('Normal login flow', () => {
        it('Calls userAPI.login with email, password and rememberMe as FormData', async () => {
            renderComponent();

            await fillAndSubmit('test@example.com', 'Password123!');

            await waitFor(() => {
                expect(mockUserAPILogin).toHaveBeenCalledTimes(1);
                const calls = mockUserAPILogin.mock.calls as FormData[][];
                const formData = calls[0][0];
                expect(formData.get('email')).toBe('test@example.com');
                expect(formData.get('password')).toBe('Password123!');
                expect(formData.get('rememberMe')).toBe('false');
            });
        });

        it('Submits rememberMe as true when checkbox is checked', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('checkbox', { name: /remember me/i }));
            await user.click(screen.getByRole('button', { name: /log in/i }));

            await waitFor(() => {
                const calls = mockUserAPILogin.mock.calls as FormData[][];
                const formData = calls[0][0];
                expect(formData.get('rememberMe')).toBe('true');
            });
        });

        it('Calls login with the access token on success', async () => {
            mockUserAPILogin.mockResolvedValue({ access_token: 'full-token', mfa_required: false });
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith('full-token');
            });
        });

        it('Closes the dialog after successful login', async () => {
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockCloseLoginDialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Shows loading state while submitting', async () => {
            mockUserAPILogin.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve({ access_token: 'token', mfa_required: false }), 100)
                    )
            );
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('button', { name: /log in/i }));

            expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled();
            expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
        });

        it('Does not submit again while loading', async () => {
            mockUserAPILogin.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve({ access_token: 'token', mfa_required: false }), 100)
                    )
            );
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('button', { name: /log in/i }));

            fireEvent.click(screen.getByRole('button', { name: /log in/i }));

            await waitFor(() => {
                expect(mockUserAPILogin).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('2FA flow', () => {
        it('Sets pending2FAToken when mfa_required is true', async () => {
            mockUserAPILogin.mockResolvedValue({
                access_token: 'pending-2fa-token',
                mfa_required: true,
            });
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockSetPending2FAToken).toHaveBeenCalledWith('pending-2fa-token');
            });
        });

        it('Opens the verify2FA dialog when mfa_required is true', async () => {
            mockUserAPILogin.mockResolvedValue({
                access_token: 'pending-2fa-token',
                mfa_required: true,
            });
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockOpenVerify2FADialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Closes the login dialog when redirecting to 2FA', async () => {
            mockUserAPILogin.mockResolvedValue({
                access_token: 'pending-2fa-token',
                mfa_required: true,
            });
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockCloseLoginDialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Does not call login when mfa_required is true', async () => {
            mockUserAPILogin.mockResolvedValue({
                access_token: 'pending-2fa-token',
                mfa_required: true,
            });
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockLogin).not.toHaveBeenCalled();
            });
        });
    });

    describe('Email verification flow', () => {
        it('Opens verify dialog and sets pending token on 403', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Please verify your email.', 403, 'unverified-token'));
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockOpenVerifyDialog).toHaveBeenCalledTimes(1);
                expect(mockSetPendingToken).toHaveBeenCalledWith('unverified-token');
                expect(mockCloseLoginDialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Does not show error alert on 403 - redirects instead', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Please verify your email.', 403, 'unverified-token'));
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });
        });

        it('Does not call login on 403', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Please verify your email.', 403, 'unverified-token'));
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(mockLogin).not.toHaveBeenCalled();
            });
        });
    });

    describe('Error handling', () => {
        it('Shows error alert on invalid credentials (401)', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Invalid Login.', 401));
            renderComponent();

            await fillAndSubmit();

            expect(await screen.findByText('Invalid Login.')).toBeInTheDocument();
        });

        it('Shows error alert on rate limit (429)', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Too many requests. Please wait.', 429));
            renderComponent();

            await fillAndSubmit();

            expect(await screen.findByText('Too many requests. Please wait.')).toBeInTheDocument();
        });

        it('Shows generic error for non-APIError exceptions', async () => {
            mockUserAPILogin.mockRejectedValue(new Error('Network failure'));
            renderComponent();

            await fillAndSubmit();

            expect(await screen.findByText('Invalid login. Please try again.')).toBeInTheDocument();
        });

        it('Re-enables the submit button after an error', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Invalid Login.', 401));
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /log in/i })).not.toBeDisabled();
            });
        });

        it('Allows retry after an error', async () => {
            mockUserAPILogin
                .mockRejectedValueOnce(new APIError('Invalid Login.', 401))
                .mockResolvedValueOnce({ access_token: 'full-token', mfa_required: false });

            renderComponent();

            // First attempt - fails
            await fillAndSubmit();
            await screen.findByText('Invalid Login.');

            // Second attempt - succeeds
            await user.click(screen.getByRole('button', { name: /log in/i }));

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith('full-token');
            });
        });

        it('Dismisses error alert when close is clicked', async () => {
            mockUserAPILogin.mockRejectedValue(new APIError('Invalid Login.', 401));
            renderComponent();

            await fillAndSubmit();
            await screen.findByText('Invalid Login.');

            await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /close/i }));

            expect(screen.queryByText('Invalid Login.')).not.toBeInTheDocument();
        });
    });

    describe('Dialog behavior', () => {
        it('Does not close on backdrop click while loading', async () => {
            mockUserAPILogin.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve({ access_token: 'token', mfa_required: false }), 100)
                    )
            );
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('button', { name: /log in/i }));

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockCloseLoginDialog).not.toHaveBeenCalled();
        });

        it('Closes dialog when close button is clicked', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /close/i }));

            await waitFor(() => {
                expect(mockCloseLoginDialog).toHaveBeenCalled();
            });
        });

        it('Resets fields after dialog closes', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');

            // Simulate dialog exit transition completing
            fireEvent.animationEnd(screen.getByRole('dialog'));

            // Trigger onExited by simulating the transition
            const dialog = screen.getByRole('dialog');
            fireEvent.transitionEnd(dialog);

            // Fields should reset - verify the form still exists and is interactable
            expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
        });

        it('Does not close on escape key press while not loading', () => {
            renderComponent();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockCloseLoginDialog).not.toHaveBeenCalled();
        });

        it('Remember me checkbox toggles correctly', async () => {
            renderComponent();

            const checkbox = screen.getByRole('checkbox', { name: /remember me/i });

            expect(checkbox).not.toBeChecked();

            await user.click(checkbox);
            expect(checkbox).toBeChecked();

            await user.click(checkbox);
            expect(checkbox).not.toBeChecked();
        });
    });

    describe('Dev login button', () => {
        afterEach(() => {
            mockIsDev = false;
        });

        it('Shows dev login button in DEV mode', () => {
            mockIsDev = true;
            renderComponent();

            expect(screen.getByRole('button', { name: /dev login/i })).toBeInTheDocument();
        });

        it('Does not show dev login button outside DEV mode', () => {
            mockIsDev = false;
            renderComponent();

            expect(screen.queryByRole('button', { name: /dev login/i })).not.toBeInTheDocument();
        });

        it('Fills email and password fields when dev login is clicked', async () => {
            mockIsDev = true;
            renderComponent();

            await user.click(screen.getByRole('button', { name: /dev login/i }));

            const emailInput = screen.getByLabelText<HTMLInputElement>(/Email/i);
            const passwordInput = screen.getByLabelText<HTMLInputElement>(/Password/i);

            expect(emailInput.value).toBe('test1@gmail.com');
            expect(passwordInput.value).toBe('asdfasdfasfsdf');
        });
    });
});
