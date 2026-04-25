import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VerifyDialog from 'user/VerifyDialog';
import { APIError } from 'utils/apiError';

// Mock all external dependencies
const mockCloseVerifyDialog = jest.fn();
const mockLogout = jest.fn();
const mockSetToken = jest.fn();
const mockResendVerificationCode = jest.fn();
const mockVerify = jest.fn() as jest.Mock<Promise<string | null>, [FormData]>;
const mockSetCooldownUntil = jest.fn() as jest.Mock<void, [number | null]>;

// Default hook return values - overridden per test where needed
let mockVerifyDialogOpen = true;
let mockPendingToken: string | null = 'pending-token-123';
let mockCooldownUntil: number | null = null;

jest.mock('hooks/useAuthDialogContext', () => ({
    __esModule: true,
    default: () => ({
        verifyDialogOpen: mockVerifyDialogOpen,
        closeVerifyDialog: mockCloseVerifyDialog,
    }),
}));

jest.mock('hooks/useAuthContext', () => ({
    __esModule: true,
    default: () => ({
        login: mockSetToken,
        pendingToken: mockPendingToken,
        logout: mockLogout,
    }),
}));

jest.mock('hooks/usePendingFetch', () => ({
    __esModule: true,
    default: () => ({ Authorization: `Bearer ${mockPendingToken}` }),
}));

jest.mock('hooks/useLocalStorage', () => ({
    __esModule: true,
    default: ({ initialValue }: { key: string; initialValue: unknown }) => {
        return [mockCooldownUntil ?? initialValue, mockSetCooldownUntil];
    },
}));

jest.mock('schema/user', () => ({
    userService: () => ({
        resendVerificationCode: mockResendVerificationCode,
        verify: mockVerify,
    }),
}));

jest.mock('components/ErrorAlert', () => ({
    __esModule: true,
    default: ({ messages, onClose }: { messages: string[]; onClose: () => void }) => (
        <div data-testid="error-alert">
            {messages.map((m, _i) => (
                <span key={`${crypto.randomUUID()}`}>{m}</span>
            ))}
            <button type="button" data-testid="dismiss-error" onClick={onClose}>
                dismiss error
            </button>
        </div>
    ),
}));

jest.mock('utils/parseApiValidationError', () => ({
    parseApiValidationError: (msg: string) => [msg],
}));

jest.mock('utils/timeFormatter', () => ({
    formatSecondsToTime: (s: number) => `${s}s`,
}));

//  Helpers

const renderDialog = () => render(<VerifyDialog />);

const getVerifyCodeInput = () => screen.getByLabelText(/verification code/i);
const getVerifyButton = () => screen.getByRole('button', { name: /^verify$/i });
const getResendButton = () => screen.getByRole('button', { name: /resend verification code/i });

const typeCode = async (code: string) => {
    await userEvent.type(getVerifyCodeInput(), code);
};

describe('VerifyDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockVerifyDialogOpen = true;
        mockPendingToken = 'pending-token-123';
        mockCooldownUntil = null;

        jest.spyOn(console, 'error').mockImplementation(() => {
            // Silence expected errors
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('Rendering', () => {
        it('Renders the dialog when open', () => {
            renderDialog();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(screen.getByRole('heading', { name: 'Verify' })).toBeInTheDocument();
        });

        it('Does not render dialog content when closed', () => {
            mockVerifyDialogOpen = false;
            renderDialog();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('Renders the verification code input', () => {
            renderDialog();
            expect(getVerifyCodeInput()).toBeInTheDocument();
        });

        it('Renders the verify submit button', () => {
            renderDialog();
            expect(getVerifyButton()).toBeInTheDocument();
        });

        it('Renders the resend button', () => {
            renderDialog();
            expect(getResendButton()).toBeInTheDocument();
        });

        it('Renders the info alert with email instructions', () => {
            renderDialog();
            expect(screen.getByText(/check your email for a verification code/i)).toBeInTheDocument();
            expect(screen.getByText('@chaselane.dev')).toBeInTheDocument();
        });

        it('Does not show error alert initially', () => {
            renderDialog();
            expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
        });

        it('Does not show resend success alert initially', () => {
            renderDialog();
            expect(screen.queryByText(/success!/i)).not.toBeInTheDocument();
        });

        it('Resend button is disabled on initial load', () => {
            mockCooldownUntil = Date.now() + 10 * 60 * 1000;
            renderDialog();
            expect(screen.getByRole('button', { name: /resend verification code available in/i })).toBeDisabled();
        });
    });

    describe('Form validation', () => {
        it('Shows validation error when submitting empty code', async () => {
            renderDialog();
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(screen.getByText(/please enter a valid code/i)).toBeInTheDocument();
            });
        });

        it('Shows validation error when code is too short', async () => {
            renderDialog();
            await typeCode('ABC');
            fireEvent.blur(getVerifyCodeInput());
            await waitFor(() => {
                expect(screen.getByText(/please enter a valid code/i)).toBeInTheDocument();
            });
        });

        it('Does not call verify API when validation fails', async () => {
            renderDialog();
            await typeCode('SHORT');
            await userEvent.click(getVerifyButton());
            expect(mockVerify).not.toHaveBeenCalled();
        });

        it('Clears validation error after entering a valid code', async () => {
            mockVerify.mockResolvedValue('new-token');
            renderDialog();
            await typeCode('ABCD1234');
            fireEvent.blur(getVerifyCodeInput());
            // No error shown for valid 8-char code
            expect(screen.queryByText(/please enter a valid code/i)).not.toBeInTheDocument();
        });
    });

    describe('Verify submission', () => {
        it('Calls verify API with entered code', async () => {
            mockVerify.mockResolvedValue('new-token');
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(mockVerify).toHaveBeenCalledTimes(1);
            });
            const formData = mockVerify.mock.calls[0][0];
            expect(formData.get('verificationcode')).toBe('ABCD1234');
        });

        it('Calls setToken and closes dialog on success', async () => {
            mockVerify.mockResolvedValue('new-token-abc');
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(mockSetToken).toHaveBeenCalledWith('new-token-abc');
                expect(mockCloseVerifyDialog).toHaveBeenCalled();
            });
        });

        it('Shows error alert on APIError', async () => {
            mockVerify.mockRejectedValue(new APIError('Invalid code', 400));
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(screen.getByTestId('error-alert')).toBeInTheDocument();
                expect(screen.getByText('Invalid code')).toBeInTheDocument();
            });
        });

        it('Shows generic error on unexpected error', async () => {
            mockVerify.mockRejectedValue(new Error('Network failure'));
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(screen.getByText(/invalid verification. please try again/i)).toBeInTheDocument();
            });
        });

        it('Shows error when verify returns falsy token', async () => {
            mockVerify.mockResolvedValue(null);
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(screen.getByTestId('error-alert')).toBeInTheDocument();
            });
        });

        it('Dismisses error alert when close button clicked', async () => {
            mockVerify.mockRejectedValue(new APIError('Bad code', 400));
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => expect(screen.getByTestId('error-alert')).toBeInTheDocument());
            await userEvent.click(screen.getByTestId('dismiss-error'));
            await waitFor(() => {
                expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
            });
        });

        it('Does not submit again while loading', async () => {
            mockVerify.mockReturnValue(
                new Promise(() => {
                    // empty, never finishes
                })
            );
            renderDialog();
            await typeCode('ABCD1234');
            await userEvent.click(getVerifyButton());
            await waitFor(() => {
                expect(getVerifyButton()).toHaveAttribute('disabled');
            });
            expect(mockVerify).toHaveBeenCalledTimes(1);
        });
    });

    describe('Resend verification code', () => {
        it('Calls resendVerificationCode API when button clicked', async () => {
            mockResendVerificationCode.mockResolvedValue(undefined);
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => {
                expect(mockResendVerificationCode).toHaveBeenCalledTimes(1);
            });
        });

        it('Shows success alert after resend', async () => {
            mockResendVerificationCode.mockResolvedValue(undefined);
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => {
                expect(screen.getByText(/success! please check your email/i)).toBeInTheDocument();
            });
        });

        it('Sets cooldown after successful resend', async () => {
            mockResendVerificationCode.mockResolvedValue(undefined);
            const before = Date.now();
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => {
                expect(mockSetCooldownUntil).toHaveBeenCalledTimes(2);
                const until = mockSetCooldownUntil.mock.calls[1][0]!;
                expect(until).toBeGreaterThanOrEqual(before + 10 * 60 * 1000);
            });
        });

        it('Dismisses success alert when closed', async () => {
            mockResendVerificationCode.mockResolvedValue(undefined);
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => expect(screen.getByText(/success!/i)).toBeInTheDocument());
            await userEvent.click(screen.getByLabelText(/close/i));
            expect(screen.queryByText(/success!/i)).not.toBeInTheDocument();
        });

        it('Shows error on 429 rate limit response', async () => {
            mockResendVerificationCode.mockRejectedValue(new APIError('Too many requests', 429));
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => {
                expect(screen.getByText('Too many requests')).toBeInTheDocument();
            });
        });

        it('Shows generic error on non-429 API error', async () => {
            mockResendVerificationCode.mockRejectedValue(new Error('Network error'));
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => {
                expect(screen.getByText(/server error. please try again/i)).toBeInTheDocument();
            });
        });

        it('Does not resend while resend is already loading', async () => {
            mockResendVerificationCode.mockReturnValue(
                new Promise(() => {
                    // empty - never resolves
                })
            );
            renderDialog();
            await userEvent.click(getResendButton());
            await waitFor(() => {
                expect(getResendButton()).toBeDisabled();
            });
            expect(mockResendVerificationCode).toHaveBeenCalledTimes(1);
        });
    });

    describe('Cooldown', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('Resend button is enabled when no cooldown is active', () => {
            mockCooldownUntil = null;
            renderDialog();
            expect(getResendButton()).not.toBeDisabled();
        });

        it('Resend button is disabled when cooldown is active', () => {
            mockCooldownUntil = Date.now() + 10 * 60 * 1000;
            renderDialog();
            expect(screen.getByRole('button', { name: /resend verification code available in/i })).toBeDisabled();
        });

        it('Shows remaining time in button label during cooldown', () => {
            mockCooldownUntil = Date.now() + 5000; // 5 seconds from now
            renderDialog();
            expect(screen.getByText(/resend verification code available in/i)).toBeInTheDocument();
        });

        it('Does not call resend API when cooldown is active', () => {
            mockCooldownUntil = Date.now() + 10 * 60 * 1000;
            renderDialog();
            fireEvent.click(screen.getByRole('button', { name: /resend verification code available in/i }));
            expect(mockResendVerificationCode).not.toHaveBeenCalled();
        });

        it('Ticks countdown every second', () => {
            mockCooldownUntil = Date.now() + 3000;
            renderDialog();
            expect(screen.getByText(/3s/)).toBeInTheDocument();
            act(() => {
                jest.advanceTimersByTime(1000);
            });
            expect(screen.getByText(/2s/)).toBeInTheDocument();
            act(() => {
                jest.advanceTimersByTime(1000);
            });
            expect(screen.getByText(/1s/)).toBeInTheDocument();
        });

        it('Clears interval and shows resend button after cooldown expires', () => {
            mockCooldownUntil = Date.now() + 2000;
            renderDialog();
            act(() => {
                jest.advanceTimersByTime(3000);
            });
            // After expiry the remaining time should be 0 - button text returns to default
            // The interval self-clears; we just verify no errors thrown and button reflects state
            expect(screen.queryByText(/available in/i)).not.toBeInTheDocument();
        });
    });

    describe('Forced logout when pending token becomes null', () => {
        it('Calls logout and closeVerifyDialog when dialog is open and pendingToken becomes null', () => {
            mockPendingToken = null;
            mockVerifyDialogOpen = true;
            renderDialog();
            expect(mockLogout).toHaveBeenCalled();
            expect(mockCloseVerifyDialog).toHaveBeenCalled();
        });

        it('Does not logout when dialog is open and pendingToken is valid', () => {
            mockPendingToken = 'valid-token';
            mockVerifyDialogOpen = true;
            renderDialog();
            expect(mockLogout).not.toHaveBeenCalled();
        });

        it('Does not logout when dialog is closed even if pendingToken is null', () => {
            mockPendingToken = null;
            mockVerifyDialogOpen = false;
            renderDialog();
            expect(mockLogout).not.toHaveBeenCalled();
        });
    });
});
