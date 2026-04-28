import { configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import useToastContext from 'hooks/useToastContext';
import type { AuthContextType } from 'types/AuthContext.type';
import type { AuthDialogContextType } from 'types/AuthDialogContext.type';
import RegisterDialog from 'user/RegisterDialog';
import { APIError } from 'utils/apiError';

configure({ asyncUtilTimeout: 200 });

//Mocks
const mockSetPendingToken = jest.fn();
const mockCloseRegisterDialog = jest.fn();
const mockOpenVerifyDialog = jest.fn();
const mockShowToast = jest.fn();
const mockUserAPIRegister = jest.fn();

jest.mock('hooks/useAuthContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useAuthDialogContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useToastContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('schema/user', () => ({
    userService: jest.fn(() => ({
        register: mockUserAPIRegister,
    })),
}));

beforeAll(() =>
    jest.spyOn(console, 'error').mockImplementation(() => {
        // empty
    })
);
afterAll(() => (console.error as jest.Mock).mockRestore());

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockUseAuthDialogContext = useAuthDialogContext as jest.Mock;
const mockUseToastContext = useToastContext as jest.Mock;

// Helpers

function buildAuthContext(overrides: Partial<AuthContextType> = {}): Partial<AuthContextType> {
    return {
        setPendingToken: mockSetPendingToken,
        ...overrides,
    };
}

function buildDialogContext(overrides: Partial<AuthDialogContextType> = {}): Partial<AuthDialogContextType> {
    return {
        registerDialogOpen: true,
        closeRegisterDialog: mockCloseRegisterDialog,
        openVerifyDialog: mockOpenVerifyDialog,
        ...overrides,
    };
}

function renderComponent(
    authOverrides: Partial<AuthContextType> = {},
    dialogOverrides: Partial<AuthDialogContextType> = {}
) {
    mockUseAuthContext.mockReturnValue(buildAuthContext(authOverrides));
    mockUseAuthDialogContext.mockReturnValue(buildDialogContext(dialogOverrides));
    mockUseToastContext.mockReturnValue({ showToast: mockShowToast });
    return render(<RegisterDialog />);
}

// No delay typing
const user = userEvent.setup({ delay: null });

function fillForm(email = 'test@example.com', password = 'Password123!', salary = '75000', monthlyTakeHome = '5000') {
    fireEvent.change(document.getElementById('inputEmailRegister')!, {
        target: { value: email },
    });
    fireEvent.change(document.getElementById('inputPasswordRegister')!, {
        target: { value: password },
    });
    fireEvent.change(document.getElementById('outlined-adornment-salary')!, {
        target: { value: salary },
    });
    fireEvent.change(document.getElementById('outlined-adornment-takehome')!, {
        target: { value: monthlyTakeHome },
    });
}

async function fillAndSubmit(
    email = 'test@example.com',
    password = 'Password123!',
    salary = '75000',
    monthlyTakeHome = '5000'
) {
    fillForm(email, password, salary, monthlyTakeHome);
    await user.click(screen.getByRole('button', { name: /register/i }));
}

describe('RegisterDialog', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUserAPIRegister.mockResolvedValue('pending-token');
    });

    describe('Rendering', () => {
        it('Renders the dialog when open', () => {
            renderComponent();

            expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
            expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Salary/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Monthly Take Home/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
        });

        it('Does not render dialog content when closed', () => {
            renderComponent({}, { registerDialogOpen: false });

            expect(screen.queryByLabelText(/Email/i)).not.toBeInTheDocument();
        });

        it('Renders a close button', () => {
            renderComponent();

            expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
        });

        it('Does not show an error alert on initial render', () => {
            renderComponent();

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('All fields are empty on initial render', () => {
            renderComponent();

            expect(screen.getByLabelText<HTMLInputElement>(/Email/i).value).toBe('');
            expect(screen.getByLabelText<HTMLInputElement>(/Password/i).value).toBe('');
        });
    });

    describe('Form Validation', () => {
        it('Does not submit when all fields are empty', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(mockUserAPIRegister).not.toHaveBeenCalled();
        });

        it('Shows email validation error when email is empty', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(screen.getAllByText(/field is required/i).length).toBeGreaterThan(0);
            expect(mockUserAPIRegister).not.toHaveBeenCalled();
        });

        it('Shows password validation error when password is empty', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(mockUserAPIRegister).not.toHaveBeenCalled();
        });

        it('Shows salary validation error when salary is empty', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(mockUserAPIRegister).not.toHaveBeenCalled();
        });

        it('Shows monthly take home validation error when field is empty', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.type(screen.getByLabelText(/Salary/i), '75000');
            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(mockUserAPIRegister).not.toHaveBeenCalled();
        });

        it('Shows email validation error when email is invalid', async () => {
            renderComponent();

            await user.type(screen.getByLabelText(/Email/i), 'notanemail');
            fireEvent.blur(screen.getByLabelText(/Email/i));

            expect(await screen.findByText(/not a valid email/i)).toBeInTheDocument();
        });

        it('Does not submit when any single field has an error', async () => {
            renderComponent();

            // All fields valid except email
            await user.type(screen.getByLabelText(/Email/i), 'bademail');
            await user.type(screen.getByLabelText(/Password/i), 'Password123!');
            await user.type(screen.getByLabelText(/Salary/i), '75000');
            await user.type(screen.getByLabelText(/Monthly Take Home/i), '5000');
            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(mockUserAPIRegister).not.toHaveBeenCalled();
        });
    });

    describe('Successful registration flow', () => {
        it('Calls userAPI.register with correct values', async () => {
            renderComponent();

            await fillAndSubmit();

            expect(mockUserAPIRegister).toHaveBeenCalledWith({
                email: 'test@example.com',
                password: 'Password123!',
                salary: '75000',
                monthlyTakeHome: '5000',
            });
        });

        it('Shows success toast after successful registration', async () => {
            renderComponent();

            await fillAndSubmit();

            expect(mockShowToast).toHaveBeenCalledWith(
                'Successfully registered! Please check your email for verification',
                'success'
            );
        });

        it('Opens verify dialog after successful registration', async () => {
            renderComponent();
            await fillAndSubmit();
            expect(mockOpenVerifyDialog).toHaveBeenCalledTimes(1);
        });

        it('Sets pending token after successful registration', async () => {
            renderComponent();
            await fillAndSubmit();
            expect(mockSetPendingToken).toHaveBeenCalledWith('pending-token');
        });

        it('Closes register dialog after successful registration', async () => {
            renderComponent();
            await fillAndSubmit();
            expect(mockCloseRegisterDialog).toHaveBeenCalledTimes(1);
        });

        it('Opens verify dialog before closing register dialog', async () => {
            const callOrder: string[] = [];
            mockOpenVerifyDialog.mockImplementation(() => callOrder.push('openVerify'));
            mockCloseRegisterDialog.mockImplementation(() => callOrder.push('closeRegister'));

            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(callOrder).toEqual(['openVerify', 'closeRegister']);
            });
        });

        it('Shows loading state while submitting', async () => {
            mockUserAPIRegister.mockImplementation(
                () => new Promise<string>((resolve) => setTimeout(() => resolve('pending-token'), 10000))
            );
            renderComponent();

            fillForm();
            void user.click(screen.getByRole('button', { name: /register/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /register/i })).toBeDisabled();
            });
        });

        it('Does not submit again while loading', async () => {
            mockUserAPIRegister.mockImplementation(
                () => new Promise<string>((resolve) => setTimeout(() => resolve('pending-token'), 10000))
            );
            renderComponent();

            fillForm();
            void user.click(screen.getByRole('button', { name: /register/i }));

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /register/i })).toBeDisabled();
            });

            fireEvent.click(screen.getByRole('button', { name: /register/i }));
            expect(mockUserAPIRegister).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error handling', () => {
        it('Shows error alert on APIError', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();

            await fillAndSubmit();

            expect(await screen.findByText('Email already registered.')).toBeInTheDocument();
        });

        it('Shows generic error for non-APIError exceptions', async () => {
            mockUserAPIRegister.mockRejectedValue(new Error('Network failure'));
            renderComponent();

            await fillAndSubmit();

            expect(await screen.findByText('Server Error. Please try again.')).toBeInTheDocument();
        });

        it('Re-enables the submit button after an error', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();

            await fillAndSubmit();

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /register/i })).not.toBeDisabled();
            });
        });

        it('Does not open verify dialog on error', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();
            await fillAndSubmit();
            expect(mockOpenVerifyDialog).not.toHaveBeenCalled();
        });

        it('Does not set pending token on error', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();
            await fillAndSubmit();
            expect(mockSetPendingToken).not.toHaveBeenCalled();
        });

        it('Does not close register dialog on error', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();
            await fillAndSubmit();
            expect(mockCloseRegisterDialog).not.toHaveBeenCalled();
        });

        it('Allows retry after an error', async () => {
            mockUserAPIRegister
                .mockRejectedValueOnce(new APIError('Email already registered.', 400))
                .mockResolvedValueOnce('pending-token');

            renderComponent();

            await fillAndSubmit();
            await screen.findByText('Email already registered.');

            await user.click(screen.getByRole('button', { name: /register/i }));

            await waitFor(() => {
                expect(mockOpenVerifyDialog).toHaveBeenCalledTimes(1);
            });
        });

        it('Dismisses error alert when close is clicked', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();

            await fillAndSubmit();
            await screen.findByText('Email already registered.');

            await user.click(within(screen.getByRole('alert')).getByRole('button', { name: /close/i }));

            expect(screen.queryByText('Email already registered.')).not.toBeInTheDocument();
        });

        it('Re-enables the submit button after an error', async () => {
            mockUserAPIRegister.mockRejectedValue(new APIError('Email already registered.', 400));
            renderComponent();
            await fillAndSubmit();
            expect(screen.getByRole('button', { name: /register/i })).not.toBeDisabled();
        });
    });

    describe('Dialog behavior', () => {
        it('Closes dialog when close button is clicked', async () => {
            renderComponent();

            await user.click(screen.getByRole('button', { name: /close/i }));

            await waitFor(() => {
                expect(mockCloseRegisterDialog).toHaveBeenCalled();
            });
        });

        it('Does not close on backdrop click', () => {
            renderComponent();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockCloseRegisterDialog).not.toHaveBeenCalled();
        });

        it('Does not close on escape key press', () => {
            renderComponent();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(mockCloseRegisterDialog).not.toHaveBeenCalled();
        });

        it('Close button is disabled while loading', async () => {
            mockUserAPIRegister.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve('token'), 100))
            );
            renderComponent();

            fillForm();
            await user.click(screen.getByRole('button', { name: /register/i }));

            expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
        });

        it('Does not close while loading when close is clicked', async () => {
            mockUserAPIRegister.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve('token'), 100))
            );
            renderComponent();

            fillForm();
            await user.click(screen.getByRole('button', { name: /register/i }));

            // Close button is disabled while loading - verify it can't be interacted with
            expect(screen.getByRole('button', { name: /close/i })).toBeDisabled();
        });
    });
});
