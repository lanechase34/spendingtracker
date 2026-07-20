import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthFetch_ from 'hooks/useAuthFetch';
import useToastContext_ from 'hooks/useToastContext';
import useUserContext_ from 'hooks/useUserContext';
import UserSettings from 'user/UserSettings';

configure({ asyncUtilTimeout: 200 });

// Mocks
const mockOnClose = jest.fn();
const mockShowToast = jest.fn();
const mockUpdateUser = jest.fn();
const mockUpdateProfile = jest.fn();

jest.mock('hooks/useAuthFetch', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useToastContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useUserContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('schema/user', () => ({
    userService: jest.fn(() => ({
        updateProfile: mockUpdateProfile,
    })),
}));

// Mock child dialogs to isolate UserSettings behavior
jest.mock('user/Setup2FADialog', () => ({
    __esModule: true,
    default: jest.fn(({ open, onClose, onEnabled }: { open: boolean; onClose: () => void; onEnabled: () => void }) =>
        open ? (
            <div data-testid="setup-2fa-dialog">
                <button onClick={onClose}>Close Setup</button>
                <button onClick={onEnabled}>Confirm Enabled</button>
            </div>
        ) : null
    ),
}));

jest.mock('user/Disable2FADialog', () => ({
    __esModule: true,
    default: jest.fn(({ open, onClose, onDisabled }: { open: boolean; onClose: () => void; onDisabled: () => void }) =>
        open ? (
            <div data-testid="disable-2fa-dialog">
                <button onClick={onClose}>Close Disable</button>
                <button onClick={onDisabled}>Confirm Disabled</button>
            </div>
        ) : null
    ),
}));

beforeAll(() =>
    jest.spyOn(console, 'error').mockImplementation(() => {
        // empty
    })
);
afterAll(() => (console.error as jest.Mock).mockRestore());

const mockUseAuthFetch = useAuthFetch_ as jest.Mock;
const mockUseToastContext = useToastContext_ as jest.Mock;
const mockUseUserContext = useUserContext_ as jest.Mock;

// Helpers
function buildUser(
    overrides: Partial<{
        salary: number;
        monthlyTakeHome: number;
        role: string;
        totpEnabled: boolean;
    }> = {}
) {
    return {
        salary: overrides.salary ?? 80000,
        monthlyTakeHome: overrides.monthlyTakeHome ?? 5000,
        role: overrides.role ?? 'USER',
        totpEnabled: overrides.totpEnabled ?? false,
    };
}

function renderComponent(
    props: {
        open?: boolean;
        onClose?: jest.Mock;
        totpEnabled?: boolean;
        userOverrides?: Partial<Parameters<typeof buildUser>[0]>;
    } = {}
) {
    mockUseAuthFetch.mockReturnValue(jest.fn());
    mockUseToastContext.mockReturnValue({ showToast: mockShowToast });
    mockUseUserContext.mockReturnValue({
        user: buildUser({ totpEnabled: props.totpEnabled ?? false, ...props.userOverrides }),
        updateUser: mockUpdateUser,
    });

    return render(<UserSettings open={props.open ?? true} onClose={props.onClose ?? mockOnClose} />);
}

const user = userEvent.setup({ delay: null });

describe('UserSettings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUpdateProfile.mockResolvedValue(undefined);
    });

    describe('Rendering', () => {
        it('Renders the dialog when open', () => {
            renderComponent();

            expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
        });

        it('Does not render when closed', () => {
            renderComponent({ open: false });

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('Renders Account section heading', () => {
            renderComponent();

            expect(screen.getByText('Account')).toBeInTheDocument();
        });

        it('Renders Security section heading', () => {
            renderComponent();

            expect(screen.getByText('Security')).toBeInTheDocument();
        });

        it('Renders password field', () => {
            renderComponent();

            expect(screen.getByLabelText(/change password/i)).toBeInTheDocument();
        });

        it('Renders salary field with current value', () => {
            renderComponent({ userOverrides: { salary: 80000 } });

            expect(screen.getByDisplayValue('80000')).toBeInTheDocument();
        });

        it('Renders monthly take home field with current value', () => {
            renderComponent({ userOverrides: { monthlyTakeHome: 5000 } });

            expect(screen.getByDisplayValue('5000')).toBeInTheDocument();
        });

        it('Does not render confirm password field initially', () => {
            renderComponent();

            expect(screen.queryByLabelText(/confirm new password/i)).not.toBeInTheDocument();
        });

        it('Renders Close and Save buttons', () => {
            renderComponent();

            // There are two close buttons - the icon and the text button
            expect(screen.getAllByRole('button', { name: /close/i })).toHaveLength(2);
            expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        });

        it('Save button is disabled by default when no changes made', () => {
            renderComponent();

            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        });
    });

    describe('Security section - 2FA disabled', () => {
        it('Shows disabled status text when 2FA is off', () => {
            renderComponent({ totpEnabled: false });

            expect(screen.getByText(/disabled - add an extra layer/i)).toBeInTheDocument();
        });

        it('Shows Enable button when 2FA is disabled', () => {
            renderComponent({ totpEnabled: false });

            expect(screen.getByRole('button', { name: /^enable$/i })).toBeInTheDocument();
        });

        it('Enable button has primary color when 2FA is disabled', () => {
            renderComponent({ totpEnabled: false });

            const btn = screen.getByRole('button', { name: /^enable$/i });
            expect(btn.className).toMatch(/colorPrimary/i);
        });

        it('Opens Setup2FADialog when Enable is clicked', async () => {
            renderComponent({ totpEnabled: false });

            await user.click(screen.getByRole('button', { name: /^enable$/i }));

            expect(screen.getByTestId('setup-2fa-dialog')).toBeInTheDocument();
        });

        it('Closes Setup2FADialog when its onClose is called', async () => {
            renderComponent({ totpEnabled: false });

            await user.click(screen.getByRole('button', { name: /^enable$/i }));
            expect(screen.getByTestId('setup-2fa-dialog')).toBeInTheDocument();

            const setupDialog = screen.getByTestId('setup-2fa-dialog');
            await user.click(within(setupDialog).getByText('Close Setup'));

            expect(screen.queryByTestId('setup-2fa-dialog')).not.toBeInTheDocument();
        });

        it('Calls updateUser with totpEnabled true when Setup2FA confirms', async () => {
            renderComponent({ totpEnabled: false });

            await user.click(screen.getByRole('button', { name: /^enable$/i }));

            const setupDialog = screen.getByTestId('setup-2fa-dialog');
            await user.click(within(setupDialog).getByText('Confirm Enabled'));

            expect(mockUpdateUser).toHaveBeenCalledWith({ totpEnabled: true });
        });

        it('Does not open Disable2FADialog when 2FA is disabled', async () => {
            renderComponent({ totpEnabled: false });

            await user.click(screen.getByRole('button', { name: /^enable$/i }));

            expect(screen.queryByTestId('disable-2fa-dialog')).not.toBeInTheDocument();
        });
    });

    describe('Security section - 2FA enabled', () => {
        it('Shows enabled status text when 2FA is on', () => {
            renderComponent({ totpEnabled: true });

            expect(screen.getByText(/enabled - your account is protected/i)).toBeInTheDocument();
        });

        it('Shows Disable button when 2FA is enabled', () => {
            renderComponent({ totpEnabled: true });

            expect(screen.getByRole('button', { name: /^disable$/i })).toBeInTheDocument();
        });

        it('Disable button has error color when 2FA is enabled', () => {
            renderComponent({ totpEnabled: true });

            const btn = screen.getByRole('button', { name: /^disable$/i });
            expect(btn.className).toMatch(/colorError/i);
        });

        it('Opens Disable2FADialog when Disable is clicked', async () => {
            renderComponent({ totpEnabled: true });

            await user.click(screen.getByRole('button', { name: /^disable$/i }));

            expect(screen.getByTestId('disable-2fa-dialog')).toBeInTheDocument();
        });

        it('Closes Disable2FADialog when its onClose is called', async () => {
            renderComponent({ totpEnabled: true });

            await user.click(screen.getByRole('button', { name: /^disable$/i }));
            expect(screen.getByTestId('disable-2fa-dialog')).toBeInTheDocument();

            const disableDialog = screen.getByTestId('disable-2fa-dialog');
            await user.click(within(disableDialog).getByText('Close Disable'));

            expect(screen.queryByTestId('disable-2fa-dialog')).not.toBeInTheDocument();
        });

        it('Calls updateUser with totpEnabled false when Disable2FA confirms', async () => {
            renderComponent({ totpEnabled: true });

            await user.click(screen.getByRole('button', { name: /^disable$/i }));

            const disableDialog = screen.getByTestId('disable-2fa-dialog');
            await user.click(within(disableDialog).getByText('Confirm Disabled'));

            expect(mockUpdateUser).toHaveBeenCalledWith({ totpEnabled: false });
        });

        it('Does not open Setup2FADialog when 2FA is enabled', async () => {
            renderComponent({ totpEnabled: true });

            await user.click(screen.getByRole('button', { name: /^disable$/i }));

            expect(screen.queryByTestId('setup-2fa-dialog')).not.toBeInTheDocument();
        });
    });

    describe('Password field', () => {
        it('Shows confirm password field when user starts typing', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'a');

            expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();
        });

        it('Hides confirm password field when password is cleared', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'a');
            expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument();

            await user.clear(screen.getByLabelText(/change password/i));
            expect(screen.queryByLabelText(/confirm new password/i)).not.toBeInTheDocument();
        });

        it('Shows password validation error for passwords shorter than 10 characters', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'short');
            fireEvent.blur(screen.getByLabelText(/change password/i));

            expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument();
        });

        it('Save button stays disabled when passwords do not match', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'longpassword1');
            await user.type(screen.getByLabelText(/confirm new password/i), 'differentpassword');

            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        });

        it('Save button is enabled when passwords match and are valid', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'validpassword1');
            await user.type(screen.getByLabelText(/confirm new password/i), 'validpassword1');

            expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
        });

        it('Shows confirm password error on blur when passwords do not match', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'longpassword1');
            await user.type(screen.getByLabelText(/confirm new password/i), 'different');
            fireEvent.blur(screen.getByLabelText(/confirm new password/i));

            expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument();
        });
    });

    describe('Save button enabled state', () => {
        it('Enables Save when salary is changed', () => {
            renderComponent({ userOverrides: { salary: 80000 } });

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
        });

        it('Enables Save when monthly take home is changed', () => {
            renderComponent({ userOverrides: { monthlyTakeHome: 5000 } });

            fireEvent.change(document.getElementById('outlined-adornment-takehome')!, {
                target: { value: '6000' },
            });

            expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
        });

        it('Disables Save when salary is changed back to original value', () => {
            renderComponent({ userOverrides: { salary: 80000 } });

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });
            expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '80000' },
            });
            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        });

        it('Disables Save when there are validation errors', () => {
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: 'notanumber' },
            });
            fireEvent.blur(document.getElementById('outlined-adornment-salary')!);

            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        });
    });

    describe('Successful save flow', () => {
        it('Calls updateProfile with correct values', async () => {
            renderComponent({ userOverrides: { salary: 80000, monthlyTakeHome: 5000 } });

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockUpdateProfile).toHaveBeenCalledWith({
                    password: '',
                    salary: '90000',
                    monthlyTakeHome: '5000',
                });
            });
        });

        it('Shows success toast after save', async () => {
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith('Successfully saved!', 'success');
            });
        });

        it('Calls onClose after save', async () => {
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalledWith({}, 'doneLoading');
            });
        });

        it('Saves with password when both password fields are filled and match', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/change password/i), 'newpassword1');
            await user.type(screen.getByLabelText(/confirm new password/i), 'newpassword1');

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockUpdateProfile).toHaveBeenCalledWith(expect.objectContaining({ password: 'newpassword1' }));
            });
        });

        it('Disables Save button after successful save when no further changes are made', async () => {
            renderComponent({ userOverrides: { salary: 80000 } });

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockOnClose).toHaveBeenCalled();
            });

            // Save button should be disabled since resetTo updated the baseline
            expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
        });

        it('Shows loading state while saving', async () => {
            mockUpdateProfile.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            void user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
            });
        });

        it('Disables close button while saving', async () => {
            mockUpdateProfile.mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 10000)));
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            void user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(
                    within(screen.getByRole('dialog'))
                        .getAllByRole('button', { name: /close/i })
                        .find((btn) => btn.textContent?.trim() === 'Close')!
                ).toBeDisabled();
            });
        });
    });

    describe('Error handling', () => {
        it('Shows error toast when updateProfile fails', async () => {
            mockUpdateProfile.mockRejectedValue(new Error('Network error'));
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
            });
        });

        it('Does not call onClose when updateProfile fails', async () => {
            mockUpdateProfile.mockRejectedValue(new Error('Network error'));
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalled();
            });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('Re-enables Save button after error', async () => {
            mockUpdateProfile.mockRejectedValue(new Error('Network error'));
            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
            });
        });

        it('Allows retry after error', async () => {
            mockUpdateProfile.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(undefined);

            renderComponent();

            fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
                target: { value: '90000' },
            });

            await user.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
            });

            await user.click(screen.getByRole('button', { name: /save/i }));
            await waitFor(() => {
                expect(mockShowToast).toHaveBeenCalledWith('Successfully saved!', 'success');
            });
        });
    });

    describe('Dialog behavior', () => {
        it('Calls onClose when Close button is clicked', async () => {
            renderComponent();

            // The text "Close" button in DialogActions
            await user.click(
                within(screen.getByRole('dialog'))
                    .getAllByRole('button', { name: /close/i })
                    .find((btn) => btn.textContent?.trim() === 'Close')!
            );

            expect(mockOnClose).toHaveBeenCalledWith({}, 'button');
        });

        it('Calls onClose when close icon in title is clicked', async () => {
            renderComponent();

            // The close icon button is within the DialogTitle
            const title = screen.getByRole('heading', { name: /settings/i }).closest('h2')!;
            await user.click(within(title).getByRole('button'));

            expect(mockOnClose).toHaveBeenCalled();
        });

        it('Does not prevent backdrop or escape close - delegates to onClose', () => {
            renderComponent();

            // Dialog passes onClose directly so MUI handles backdrop/escape
            // Just verify dialog renders and onClose prop is wired
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });
});
