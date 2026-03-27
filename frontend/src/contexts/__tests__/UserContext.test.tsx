import { act, render, screen, waitFor } from '@testing-library/react';
import { UserContext, UserContextProvider } from 'contexts/UserContext';
import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import { useContext } from 'react';
import type { UserRoles } from 'types/Roles.type';
import type { User } from 'types/UserContext.type';

// Mock dependencies
const mockAuthFetch = jest.fn();
const mockIsInitializing = jest.fn();

jest.mock('hooks/useAuthContext', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('hooks/useAuthFetch', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('utils/constants', () => ({
    API_BASE_URL: 'https://api.test.com',
}));

const mockUseAuthContext = useAuthContext as jest.MockedFunction<typeof useAuthContext>;
const mockUseAuthFetch = useAuthFetch as jest.MockedFunction<typeof useAuthFetch>;

// Helpers
function buildValidApiResponse(
    overrides?: Partial<{
        salary: number;
        monthlytakehome: number;
        role: UserRoles;
        error: boolean;
    }>
) {
    return {
        error: overrides?.error ?? false,
        data: {
            salary: overrides?.salary ?? 80000,
            monthlytakehome: overrides?.monthlytakehome ?? 5000,
            role: overrides?.role ?? ('ADMIN' as UserRoles),
        },
    };
}

function buildMockResponse(body: unknown, ok = true) {
    return {
        ok,
        json: jest.fn().mockResolvedValue(body),
    };
}

function TestConsumer() {
    const context = useContext(UserContext);
    if (!context) return <div data-testid="no-context">No context</div>;
    return (
        <div>
            <span data-testid="loading">{String(context.loading)}</span>
            <span data-testid="user">{context.user ? JSON.stringify(context.user) : 'null'}</span>
            <span data-testid="is-authorized">{String(context.isAuthorized())}</span>
            <span data-testid="has-role-admin">{String(context.hasRole('ADMIN' as UserRoles))}</span>
            <span data-testid="has-role-user">{String(context.hasRole('USER' as UserRoles))}</span>
        </div>
    );
}

function renderWithProvider(authToken: string | null = 'token-abc', isInitializing = false) {
    mockIsInitializing.mockReturnValue(isInitializing);
    mockUseAuthContext.mockReturnValue({
        authToken,
        isInitializing: mockIsInitializing,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockUseAuthFetch.mockReturnValue(mockAuthFetch);

    return render(
        <UserContextProvider>
            <TestConsumer />
        </UserContextProvider>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockAuthFetch.mockResolvedValue(null);

    jest.spyOn(console, 'error').mockImplementation(() => {
        // Silence expected errors
    });
});

describe('UserContext', () => {
    it('Is undefined when consumed outside a provider', () => {
        render(<TestConsumer />);
        expect(screen.getByTestId('no-context')).toBeInTheDocument();
    });
});

describe('UserContextProvider - initializing state', () => {
    it('Does not fetch when isInitializing returns true', async () => {
        renderWithProvider('token-abc', true);

        await act(async () => {
            // empty
        });

        expect(mockAuthFetch).not.toHaveBeenCalled();
    });

    it('Shows loading true while isInitializing is true', async () => {
        renderWithProvider('token-abc', true);

        await act(async () => {
            // empty
        });

        expect(screen.getByTestId('loading')).toHaveTextContent('true');
    });
});

describe('UserContextProvider - no auth token', () => {
    it('Sets loading to false when authToken is null', async () => {
        renderWithProvider(null);

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });

    it('Sets user to null when authToken is null', async () => {
        renderWithProvider(null);

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('null');
        });
    });

    it('Does not call authFetch when authToken is null', async () => {
        renderWithProvider(null);

        await act(async () => {
            // empty
        });

        expect(mockAuthFetch).not.toHaveBeenCalled();
    });
});

describe('UserContextProvider - successful profile load', () => {
    beforeEach(() => {
        const apiBody = buildValidApiResponse();
        mockAuthFetch.mockResolvedValue(buildMockResponse(apiBody));
    });

    it('Calls authFetch with the correct URL and method', async () => {
        renderWithProvider();

        await waitFor(() => {
            expect(mockAuthFetch).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://api.test.com/me',
                    method: 'GET',
                })
            );
        });
    });

    it('Passes an AbortSignal to authFetch', async () => {
        let capturedSignal: AbortSignal | undefined;

        mockAuthFetch.mockImplementation((options: { signal: AbortSignal }) => {
            capturedSignal = options.signal;
            return Promise.resolve(buildMockResponse(buildValidApiResponse()));
        });

        renderWithProvider();

        await waitFor(() => {
            expect(capturedSignal).toBeInstanceOf(AbortSignal);
        });
    });

    it('Sets loading to false after a successful fetch', async () => {
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });

    it('Populates user with salary, monthlyTakeHome, and role', async () => {
        renderWithProvider();

        await waitFor(() => {
            const user = JSON.parse(screen.getByTestId('user').textContent ?? 'null') as User;

            expect(user).toEqual({
                salary: 80000,
                monthlyTakeHome: 5000,
                role: 'ADMIN',
            });
        });
    });

    it('Maps monthlytakehome from API to monthlyTakeHome on the user object', async () => {
        const apiBody = buildValidApiResponse({ monthlytakehome: 3500 });
        mockAuthFetch.mockResolvedValue(buildMockResponse(apiBody));

        renderWithProvider();

        await waitFor(() => {
            const user = JSON.parse(screen.getByTestId('user').textContent ?? 'null') as User;

            expect(user.monthlyTakeHome).toBe(3500);
        });
    });
});

describe('UserContextProvider - isAuthorized', () => {
    it('Returns true when user has a non-empty role', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse({ role: 'ADMIN' as UserRoles })));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('is-authorized')).toHaveTextContent('true');
        });
    });

    it('Returns false when user is null', async () => {
        renderWithProvider(null);

        await waitFor(() => {
            expect(screen.getByTestId('is-authorized')).toHaveTextContent('false');
        });
    });

    it('Returns false when user role is an empty string', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse({ role: '' as UserRoles })));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('is-authorized')).toHaveTextContent('false');
        });
    });
});

describe('UserContextProvider - hasRole', () => {
    it('Returns true when user role matches the queried role', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse({ role: 'ADMIN' as UserRoles })));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('has-role-admin')).toHaveTextContent('true');
        });
    });

    it('Returns false when user role does not match the queried role', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse({ role: 'ADMIN' as UserRoles })));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('has-role-user')).toHaveTextContent('false');
        });
    });

    it('Returns false for any role when user is null', async () => {
        renderWithProvider(null);

        await waitFor(() => {
            expect(screen.getByTestId('has-role-admin')).toHaveTextContent('false');
        });
    });
});

describe('UserContextProvider - API response validation failures', () => {
    it('Sets user to null when the API response fails schema validation', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse({ unexpected: 'shape' }));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('null');
        });
    });

    it('Sets loading to false after a schema validation failure', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse({ unexpected: 'shape' }));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });

    it('Sets user to null when the API returns error: true', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse({ error: true })));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('null');
        });
    });

    it('Sets loading to false when the API returns error: true', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse({ error: true })));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });
});

describe('UserContextProvider - authFetch returns null', () => {
    it('Does not update user when authFetch returns null', async () => {
        mockAuthFetch.mockResolvedValue(null);
        renderWithProvider();

        // loading stays true because finally block is never hit with early return
        await act(async () => {
            // empty
        });

        expect(screen.getByTestId('user')).toHaveTextContent('null');
    });
});

describe('UserContextProvider - network errors', () => {
    it('Sets user to null on a fetch rejection', async () => {
        mockAuthFetch.mockRejectedValue(new Error('Network failure'));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('null');
        });
    });

    it('Sets loading to false after a fetch rejection', async () => {
        mockAuthFetch.mockRejectedValue(new Error('Network failure'));
        renderWithProvider();

        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });
    });

    it('Logs the error to console when fetch rejects', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {
            // empty
        });
        mockAuthFetch.mockRejectedValue(new Error('Network failure'));
        renderWithProvider();

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Failed to load user profile:', expect.any(Error));
        });

        consoleSpy.mockRestore();
    });
});

describe('UserContextProvider - abort / cleanup', () => {
    it('Does not update state when the request is aborted', () => {
        let resolveRequest!: (v: unknown) => void;
        mockAuthFetch.mockReturnValue(
            new Promise((res) => {
                resolveRequest = res;
            })
        );

        const { unmount } = renderWithProvider();

        // Unmount triggers the cleanup, aborting the controller
        unmount();

        // Resolve after abort - state updates must be suppressed
        act(() => {
            resolveRequest(buildMockResponse(buildValidApiResponse()));
        });

        // No assertion on DOM (unmounted), but no "can't update unmounted component" error
    });

    it('Aborts the in-flight request when the component unmounts', async () => {
        let capturedSignal!: AbortSignal;
        mockAuthFetch.mockImplementation(({ signal }: { signal: AbortSignal }) => {
            capturedSignal = signal;
            return new Promise(() => {
                // never resolves
            });
        });

        const { unmount } = renderWithProvider();

        await waitFor(() => expect(capturedSignal).toBeDefined());

        unmount();

        expect(capturedSignal.aborted).toBe(true);
    });
});

describe('UserContextProvider - hasLoadedProfileRef deduplication', () => {
    it('Does not fetch again when authToken has not changed and profile is already loaded', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse()));

        mockIsInitializing.mockReturnValue(false);
        mockUseAuthContext.mockReturnValue({
            authToken: 'same-token',
            isInitializing: mockIsInitializing,
        } as unknown as ReturnType<typeof useAuthContext>);
        mockUseAuthFetch.mockReturnValue(mockAuthFetch);

        const { rerender } = render(
            <UserContextProvider>
                <TestConsumer />
            </UserContextProvider>
        );

        // Wait for first load to complete
        await waitFor(() => {
            expect(screen.getByTestId('loading')).toHaveTextContent('false');
        });

        const callCount = mockAuthFetch.mock.calls.length;

        // Re-render with the same token - hasLoadedProfileRef.current is true, so no second fetch
        rerender(
            <UserContextProvider>
                <TestConsumer />
            </UserContextProvider>
        );

        await act(async () => {
            // empty
        });

        expect(mockAuthFetch).toHaveBeenCalledTimes(callCount);
    });

    it('Resets hasLoadedProfileRef and clears user when authToken becomes null', async () => {
        mockAuthFetch.mockResolvedValue(buildMockResponse(buildValidApiResponse()));

        mockIsInitializing.mockReturnValue(false);
        mockUseAuthContext.mockReturnValue({
            authToken: 'token-abc',
            isInitializing: mockIsInitializing,
        } as unknown as ReturnType<typeof useAuthContext>);
        mockUseAuthFetch.mockReturnValue(mockAuthFetch);

        const { rerender } = render(
            <UserContextProvider>
                <TestConsumer />
            </UserContextProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('user')).not.toHaveTextContent('null');
        });

        // Simulate logout
        mockUseAuthContext.mockReturnValue({
            authToken: null,
            isInitializing: jest.fn().mockReturnValue(false),
        } as unknown as ReturnType<typeof useAuthContext>);

        rerender(
            <UserContextProvider>
                <TestConsumer />
            </UserContextProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('user')).toHaveTextContent('null');
        });
    });
});
