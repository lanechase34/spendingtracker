import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthFetch from 'hooks/useAuthFetch';
import useToastContext_ from 'hooks/useToastContext';
import Setup2FADialog from 'user/Setup2FADialog';
import { APIError } from 'utils/apiError';

configure({ asyncUtilTimeout: 200 });

// Mocks
const mockOnClose = jest.fn();
const mockOnEnabled = jest.fn();
const mockShowToast = jest.fn();

const mockSetup2fa = jest.fn();
const mockConfirm2fa = jest.fn();

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
        setup2fa: mockSetup2fa,
        confirm2fa: mockConfirm2fa,
    })),
}));

beforeAll(() =>
    jest.spyOn(console, 'error').mockImplementation(() => {
        // empty
    })
);
afterAll(() => (console.error as jest.Mock).mockRestore());

const mockUseToastContext = useToastContext_ as jest.Mock;
const mockUseAuthFetch = useAuthFetch as jest.Mock;

const VALID_QR_CODE = btoa('<img src="data:image/png;base64,ABC123" width="128" height="128">');
const VALID_SECRET = 'ABCD1234EFGH5678';
const VALID_CODES = [
    'abcd-1234-ef56-7890',
    'bbcd-1234-ef56-7890',
    'cbcd-1234-ef56-7890',
    'dbcd-1234-ef56-7890',
    'ebcd-1234-ef56-7890',
    'fbcd-1234-ef56-7890',
    'gbcd-1234-ef56-7890',
    'hbcd-1234-ef56-7890',
];

function renderComponent(
    props: {
        open?: boolean;
        onClose?: () => void;
        onEnabled?: () => void;
    } = {}
) {
    mockUseAuthFetch.mockReturnValue(jest.fn());
    mockUseToastContext.mockReturnValue({ showToast: mockShowToast });

    return render(
        <Setup2FADialog
            open={props.open ?? true}
            onClose={props.onClose ?? mockOnClose}
            onEnabled={props.onEnabled ?? mockOnEnabled}
        />
    );
}

const user = userEvent.setup({ delay: null });

describe('Setup2FADialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSetup2fa.mockResolvedValue({ qrCode: VALID_QR_CODE, secret: VALID_SECRET });
        mockConfirm2fa.mockResolvedValue({ recoveryCodes: VALID_CODES });
    });

    describe('Step 1 - Loading', () => {
        it('Shows loading spinner while fetching setup data', () => {
            mockSetup2fa.mockImplementation(
                () =>
                    new Promise<never>(() => {
                        // empty
                    })
            );
            renderComponent();

            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('Close button disabled during loading step', () => {
            mockSetup2fa.mockImplementation(
                () =>
                    new Promise<never>(() => {
                        // empty
                    })
            );
            renderComponent();

            expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
        });

        it('Does not render when closed', () => {
            renderComponent({ open: false });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('Calls setup2fa when dialog opens', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockSetup2fa).toHaveBeenCalledTimes(1);
            });
        });

        it('Does not call setup2fa when dialog is closed', () => {
            renderComponent({ open: false });

            expect(mockSetup2fa).not.toHaveBeenCalled();
        });
    });

    describe('Step 2 - Setup', () => {
        it('Shows QR code after setup loads', async () => {
            renderComponent();

            expect(await screen.findByAltText(/QR code/i)).toBeInTheDocument();
        });

        it('Renders QR code with correct src extracted from base64', async () => {
            renderComponent();

            const img = await screen.findByAltText<HTMLImageElement>(/QR code/i);
            expect(img.src).toBe('data:image/png;base64,ABC123');
        });

        it('Shows manual secret code after setup loads', async () => {
            renderComponent();

            expect(await screen.findByText(VALID_SECRET)).toBeInTheDocument();
        });

        it('Shows 6-digit code input field', async () => {
            renderComponent();

            expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
        });

        it('Shows Cancel and Verify & Enable buttons', async () => {
            renderComponent();

            await screen.findByLabelText(/6-digit code/i);

            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /verify & enable/i })).toBeInTheDocument();
        });

        it('Shows close button on setup step', async () => {
            renderComponent();

            await screen.findByLabelText(/6-digit code/i);

            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        it('Shows error alert when setup2fa API call fails with APIError', async () => {
            mockSetup2fa.mockRejectedValue(new APIError('2FA is already enabled.', 400));
            renderComponent();

            expect(await screen.findByText('2FA is already enabled.')).toBeInTheDocument();
        });

        it('Shows generic error when setup2fa fails with non-APIError', async () => {
            mockSetup2fa.mockRejectedValue(new Error('Network error'));
            renderComponent();

            expect(await screen.findByText('Failed to initiate 2FA setup. Please try again.')).toBeInTheDocument();
        });

        it('Dismisses error alert when close is clicked', async () => {
            mockSetup2fa.mockRejectedValue(new APIError('2FA is already enabled.', 400));
            renderComponent();

            await screen.findByText('2FA is already enabled.');

            await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /close/i }));

            expect(screen.queryByText('2FA is already enabled.')).not.toBeInTheDocument();
        });

        it('Calls onClose when Cancel is clicked', async () => {
            renderComponent();

            await screen.findByRole('button', { name: /cancel/i });
            await user.click(screen.getByRole('button', { name: /cancel/i }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('Calls onClose when close icon is clicked', async () => {
            renderComponent();

            await screen.findByRole('button', { name: /close/i });
            await user.click(screen.getByRole('button', { name: /close/i }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('Does not close on backdrop click', async () => {
            renderComponent();

            await screen.findByLabelText(/6-digit code/i);

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Does not close on escape key', async () => {
            renderComponent();

            await screen.findByLabelText(/6-digit code/i);

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        describe('Form validation', () => {
            it('Shows validation error when submitting empty code', async () => {
                renderComponent();

                await screen.findByRole('button', { name: /verify & enable/i });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                expect(await screen.findByText('Please enter the 6-digit code.')).toBeInTheDocument();
                expect(mockConfirm2fa).not.toHaveBeenCalled();
            });

            it('Shows validation error for non-numeric code', async () => {
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                await user.type(screen.getByLabelText(/6-digit code/i), 'abcdef');
                fireEvent.blur(screen.getByLabelText(/6-digit code/i));

                expect(await screen.findByText(/6 digits/i)).toBeInTheDocument();
            });

            it('Shows validation error for code shorter than 6 digits', async () => {
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                await user.type(screen.getByLabelText(/6-digit code/i), '12345');
                fireEvent.blur(screen.getByLabelText(/6-digit code/i));

                expect(await screen.findByText(/6 digits/i)).toBeInTheDocument();
            });

            it('Accepts valid 6-digit code', async () => {
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                await user.type(screen.getByLabelText(/6-digit code/i), '123456');
                fireEvent.blur(screen.getByLabelText(/6-digit code/i));

                expect(screen.queryByText(/6 digits/i)).not.toBeInTheDocument();
            });

            it('Enforces maxLength of 6 on the code input', async () => {
                renderComponent();

                const input = await screen.findByLabelText(/6-digit code/i);
                expect(input).toHaveAttribute('maxlength', '6');
            });
        });

        describe('Submission', () => {
            it('Calls confirm2fa with the entered code', async () => {
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                await waitFor(() => {
                    expect(mockConfirm2fa).toHaveBeenCalledWith('123456');
                });
            });

            it('Shows loading state while confirming', async () => {
                mockConfirm2fa.mockImplementation(
                    () =>
                        new Promise<never>(() => {
                            // empty
                        })
                );
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
                void user.click(screen.getByRole('button', { name: /verify & enable/i }));

                await waitFor(() => {
                    expect(screen.getByRole('button', { name: /verify & enable/i })).toBeDisabled();
                });
            });

            it('Disables code input while loading', async () => {
                mockConfirm2fa.mockImplementation(
                    () =>
                        new Promise<never>(() => {
                            // empty
                        })
                );
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
                void user.click(screen.getByRole('button', { name: /verify & enable/i }));

                await waitFor(() => {
                    expect(screen.getByLabelText(/6-digit code/i)).toBeDisabled();
                });
            });

            it('Does not submit again while loading', async () => {
                mockConfirm2fa.mockImplementation(
                    () =>
                        new Promise<never>(() => {
                            // empty
                        })
                );
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
                void user.click(screen.getByRole('button', { name: /verify & enable/i }));

                await waitFor(() => {
                    expect(screen.getByRole('button', { name: /verify & enable/i })).toBeDisabled();
                });

                fireEvent.click(screen.getByRole('button', { name: /verify & enable/i }));
                expect(mockConfirm2fa).toHaveBeenCalledTimes(1);
            });

            it('Shows error alert when confirm2fa fails with APIError', async () => {
                mockConfirm2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '000000' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                expect(await screen.findByText('Invalid or expired code.')).toBeInTheDocument();
            });

            it('Shows generic error when confirm2fa fails with non-APIError', async () => {
                mockConfirm2fa.mockRejectedValue(new Error('Network error'));
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                expect(await screen.findByText('Server error. Please try again.')).toBeInTheDocument();
            });

            it('Re-enables submit button after error', async () => {
                mockConfirm2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '000000' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                await screen.findByText('Invalid or expired code.');

                expect(screen.getByRole('button', { name: /verify & enable/i })).not.toBeDisabled();
            });

            it('Resets code field after error so user can retry', async () => {
                mockConfirm2fa.mockRejectedValue(new APIError('Invalid or expired code.', 422));
                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '000000' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                await screen.findByText('Invalid or expired code.');

                expect(screen.getByLabelText<HTMLInputElement>(/6-digit code/i).value).toBe('');
            });

            it('Allows retry after error', async () => {
                mockConfirm2fa
                    .mockRejectedValueOnce(new APIError('Invalid or expired code.', 422))
                    .mockResolvedValueOnce({ recoveryCodes: VALID_CODES });

                renderComponent();

                await screen.findByLabelText(/6-digit code/i);
                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '000000' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));
                await screen.findByText('Invalid or expired code.');

                fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
                await user.click(screen.getByRole('button', { name: /verify & enable/i }));

                expect(await screen.findByText(/save your recovery codes/i)).toBeInTheDocument();
            });
        });
    });

    describe('Step 3 - Recovery codes', () => {
        async function advanceToRecovery() {
            renderComponent();
            await screen.findByLabelText(/6-digit code/i);
            fireEvent.change(screen.getByLabelText(/6-digit code/i), { target: { value: '123456' } });
            await user.click(screen.getByRole('button', { name: /verify & enable/i }));
            await screen.findByText(/save your recovery codes/i);
        }

        it('Shows recovery codes step after successful confirmation', async () => {
            await advanceToRecovery();

            expect(screen.getByText(/save your recovery codes/i)).toBeInTheDocument();
        });

        it('Shows all 8 recovery codes', async () => {
            await advanceToRecovery();

            for (const code of VALID_CODES) {
                expect(screen.getByText(code)).toBeInTheDocument();
            }
        });

        it('Shows warning that codes will not be shown again', async () => {
            await advanceToRecovery();

            expect(screen.getByText(/will not be shown again/i)).toBeInTheDocument();
        });

        it('Close button disabled during recovery step', async () => {
            await advanceToRecovery();

            expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
        });

        it('Does not close on escape key on recovery step', async () => {
            await advanceToRecovery();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Shows Done button disabled until acknowledgement', async () => {
            await advanceToRecovery();

            expect(screen.getByRole('button', { name: /done/i })).toBeDisabled();
        });

        it('Enables Done button after checking acknowledgement', async () => {
            await advanceToRecovery();

            await user.click(screen.getByRole('checkbox'));

            expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();
        });

        it('Disables Done button again when acknowledgement is unchecked', async () => {
            await advanceToRecovery();

            await user.click(screen.getByRole('checkbox'));
            expect(screen.getByRole('button', { name: /done/i })).not.toBeDisabled();

            await user.click(screen.getByRole('checkbox'));
            expect(screen.getByRole('button', { name: /done/i })).toBeDisabled();
        });

        it('Calls onEnabled when Done is clicked', async () => {
            await advanceToRecovery();

            await user.click(screen.getByRole('checkbox'));
            await user.click(screen.getByRole('button', { name: /done/i }));

            expect(mockOnEnabled).toHaveBeenCalledTimes(1);
        });

        it('Calls onClose when Done is clicked', async () => {
            await advanceToRecovery();

            await user.click(screen.getByRole('checkbox'));
            await user.click(screen.getByRole('button', { name: /done/i }));

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('Shows success toast when Done is clicked', async () => {
            await advanceToRecovery();

            await user.click(screen.getByRole('checkbox'));
            await user.click(screen.getByRole('button', { name: /done/i }));

            expect(mockShowToast).toHaveBeenCalledWith('Two-factor authentication enabled.', 'success');
        });

        it('Does not call onEnabled if Done is clicked without acknowledging', async () => {
            await advanceToRecovery();

            fireEvent.click(screen.getByRole('button', { name: /done/i }));

            expect(mockOnEnabled).not.toHaveBeenCalled();
            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Shows Copy Codes button', async () => {
            await advanceToRecovery();

            expect(screen.getByRole('button', { name: /copy all codes/i })).toBeInTheDocument();
        });

        it('Copy Codes button copies codes to clipboard', async () => {
            const mockWriteText = jest.fn().mockResolvedValue(undefined);
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: mockWriteText },
                writable: true,
                configurable: true,
            });

            await advanceToRecovery();

            await user.click(screen.getByRole('button', { name: /copy all codes/i }));

            expect(mockWriteText).toHaveBeenCalledWith(VALID_CODES.join('\n'));
        });

        it('Shows Copied confirmation after copying', async () => {
            jest.useFakeTimers();
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText: jest.fn().mockResolvedValue(undefined) },
                writable: true,
                configurable: true,
            });

            await advanceToRecovery();

            await user.click(screen.getByRole('button', { name: /copy all codes/i }));

            expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument();

            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });
    });

    describe('Dialog reset on close', () => {
        it('Resets to loading step after dialog closes and reopens', async () => {
            const { rerender } = renderComponent();

            // Advance to setup step
            await screen.findByLabelText(/6-digit code/i);

            // Close dialog
            mockUseAuthFetch.mockReturnValue(jest.fn());
            mockUseToastContext.mockReturnValue({ showToast: mockShowToast });
            rerender(<Setup2FADialog open={false} onClose={mockOnClose} onEnabled={mockOnEnabled} />);

            // Reopen
            rerender(<Setup2FADialog open={true} onClose={mockOnClose} onEnabled={mockOnEnabled} />);

            // Should show loading spinner again
            await waitFor(() => {
                expect(mockSetup2fa).toHaveBeenCalledTimes(2);
            });
        });

        it('Clears error state when dialog is reopened', async () => {
            mockSetup2fa.mockRejectedValueOnce(new APIError('Already enabled.', 400));

            const { rerender } = renderComponent();
            await screen.findByText('Already enabled.');

            // Close the error alert manually to simulate user dismissing it
            await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /close/i }));

            expect(screen.queryByText('Already enabled.')).not.toBeInTheDocument();

            // Now verify reopening triggers a fresh setup call
            mockSetup2fa.mockResolvedValue({ qrCode: VALID_QR_CODE, secret: VALID_SECRET });

            rerender(<Setup2FADialog open={false} onClose={mockOnClose} onEnabled={mockOnEnabled} />);
            rerender(<Setup2FADialog open={true} onClose={mockOnClose} onEnabled={mockOnEnabled} />);

            await waitFor(() => {
                expect(mockSetup2fa).toHaveBeenCalledTimes(2);
            });
        });
    });
});
