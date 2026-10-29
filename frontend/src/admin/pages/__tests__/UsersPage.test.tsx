import { render } from '@test-utils';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UsersPage from 'admin/pages/UsersPage';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import type { UserRecord } from 'types/UserList.type';

jest.mock('hooks/usePaginatedFetch');
const mockUsePaginatedFetch = usePaginatedFetch as jest.Mock;

const users: UserRecord[] = [
    { id: 1, email: 'verified@example.com', security_level: 'ADMIN', verified: true, lastlogin: '2026-03-27T10:15:30' },
    { id: 2, email: 'pending@example.com', security_level: 'UNVERIFIED', verified: false, lastlogin: null },
];

function mockFetchResult(overrides: Record<string, unknown> = {}) {
    mockUsePaginatedFetch.mockReturnValue({
        data: { users },
        loading: false,
        error: false,
        paginationModel: { page: 0, pageSize: 25 },
        sortModel: [],
        filterModel: { items: [], quickFilterValues: [] },
        totalRowCount: users.length,
        handlePaginationModelChange: jest.fn(),
        handleSortModelChange: jest.fn(),
        handleFilterModelChange: jest.fn(),
        ...overrides,
    });
}

// Finds the grid row containing the email
const rowFor = (email: string) => {
    const row = screen.getByText(email).closest('[role="row"]');
    if (!(row instanceof HTMLElement)) throw new Error(`No row for ${email}`);
    return row;
};

describe('<UsersPage />', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchResult();
    });

    it('Should request users sorted by last login', () => {
        render(<UsersPage />);

        expect(mockUsePaginatedFetch).toHaveBeenCalledWith(
            expect.objectContaining({
                endpoint: expect.stringContaining('/users') as string,
                defaultSort: [{ field: 'lastlogin', sort: 'desc' }],
            })
        );
    });

    it('Should show a check only for verified users', async () => {
        render(<UsersPage />);

        await screen.findByText('verified@example.com');
        expect(within(rowFor('verified@example.com')).getByTestId('CheckIcon')).toBeInTheDocument();
        expect(within(rowFor('pending@example.com')).queryByTestId('CheckIcon')).not.toBeInTheDocument();
    });

    it('Should format the last login and show Never when missing', async () => {
        render(<UsersPage />);

        await screen.findByText('verified@example.com');
        expect(within(rowFor('verified@example.com')).getByText('03/27/2026 10:15:30')).toBeInTheDocument();
        expect(within(rowFor('pending@example.com')).getByText('Never')).toBeInTheDocument();
    });

    it('Should open the details dialog for a user who never logged in', async () => {
        const user = userEvent.setup();
        render(<UsersPage />);

        await screen.findByText('pending@example.com');
        await user.click(within(rowFor('pending@example.com')).getByRole('button'));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('pending@example.com')).toBeInTheDocument();
        expect(within(dialog).getByText('Never logged in')).toBeInTheDocument();
        expect(within(dialog).getByText('No')).toBeInTheDocument();
    });

    it('Should show the formatted last login for a verified user and close', async () => {
        const user = userEvent.setup();
        render(<UsersPage />);

        await screen.findByText('verified@example.com');
        await user.click(within(rowFor('verified@example.com')).getByRole('button'));

        const dialog = await screen.findByRole('dialog');
        expect(within(dialog).getByText('03/27/2026 10:15:30')).toBeInTheDocument();
        expect(within(dialog).getByTestId('CheckIcon')).toBeInTheDocument();

        await user.click(within(dialog).getByRole('button', { name: 'Close' }));
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    it('Should show the error card when fetching fails', () => {
        mockFetchResult({ error: true, data: null });
        render(<UsersPage />);

        expect(screen.getByTestId('error-card')).toBeInTheDocument();
        expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
});
