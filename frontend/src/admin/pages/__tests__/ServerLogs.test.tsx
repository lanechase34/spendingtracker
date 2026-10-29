import { defined, render } from '@test-utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServerLogs from 'admin/pages/ServerLogs';
import useAuthFetch from 'hooks/useAuthFetch';
import { API_BASE_URL } from 'utils/constants';

jest.mock('hooks/useAuthFetch');
const mockAuthFetch = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);

const LIST_URL = `${API_BASE_URL}/admin/logs`;

function mockResponse(ok: boolean, body?: unknown) {
    return {
        ok,
        status: ok ? 200 : 500,
        json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    };
}

const logFiles = [
    { name: 'application.log', size: 2048, type: 'file', dateLastModified: '2026-03-27' },
    { name: 'empty.log', size: 0, type: 'file', dateLastModified: '2026-03-27' },
    { name: 'my server.log', size: 10, type: 'file', dateLastModified: '2026-03-27' },
];

const content = (overrides: Record<string, unknown> = {}) => ({
    error: false,
    data: {
        filename: 'application.log',
        lines: ['INFO server started', 'ERROR something broke'],
        count: 2,
        total: 10,
        truncated: false,
        filtered: false,
        ...overrides,
    },
});

/**
 * Route the mocked fetch by URL: the list endpoint and the content endpoint
 */
type MockResponse = ReturnType<typeof mockResponse> | null;

function mockApi({
    list = mockResponse(true, { error: false, data: logFiles }),
    file = mockResponse(true, content()),
}: { list?: MockResponse; file?: MockResponse } = {}) {
    mockAuthFetch.mockImplementation(({ url }: { url: string }) => Promise.resolve(url === LIST_URL ? list : file));
}

// Query params of the most recent content request
function lastContentRequest() {
    const calls = mockAuthFetch.mock.calls as [{ url: string }][];
    const url = calls
        .map((c) => c[0].url)
        .filter((u) => u !== LIST_URL)
        .at(-1);
    if (url === undefined) throw new Error('No content request was made');
    const [path = '', query = ''] = url.split('?');
    return { path, params: new URLSearchParams(query) };
}

const searchBox = () => screen.getByPlaceholderText('Search lines…');
const searchButton = () => {
    const button = screen.getByTestId('SearchIcon').closest('button');
    if (!button) throw new Error('No search button');
    return button;
};

describe('<ServerLogs />', () => {
    const setup = async () => {
        const user = userEvent.setup();
        render(<ServerLogs />);
        await screen.findByText('application.log');
        return user;
    };

    const openFile = async (user: ReturnType<typeof userEvent.setup>, name = 'application.log') => {
        await user.click(screen.getByRole('button', { name: new RegExp(name) }));
        await screen.findByText('INFO server started');
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        mockApi();
    });

    describe('File list', () => {
        it('Should list each log file with its size', async () => {
            await setup();

            expect(screen.getByRole('button', { name: /application\.log/ })).toHaveTextContent('2 KB');
            expect(screen.getByRole('button', { name: /empty\.log/ })).toHaveTextContent('0 B');
            expect(screen.getByText('Select a log file from the sidebar.')).toBeInTheDocument();
        });

        it('Should disable empty files', async () => {
            await setup();

            expect(screen.getByRole('button', { name: /empty\.log/ })).toHaveAttribute('aria-disabled', 'true');
        });

        it('Should disable search, line count, and refresh until a file is selected', async () => {
            await setup();

            expect(searchBox()).toBeDisabled();
            expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
            expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
        });

        it.each([
            [
                'the API reports an error',
                mockResponse(false, { error: true, messages: ['nope'] }),
                'Failed to load logs',
            ],
            ['the body is malformed', mockResponse(true, { error: false, data: 'nope' }), 'Invalid response format'],
            ['there is no response', null, 'Invalid state.'],
        ])('Should show an error when %s', async (_label, list, message) => {
            mockApi({ list });
            render(<ServerLogs />);

            expect(await screen.findByRole('alert')).toHaveTextContent(message);
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        it('Should show a generic error when the request throws', async () => {
            mockAuthFetch.mockRejectedValue(new Error('Network down'));
            render(<ServerLogs />);

            expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load logs');
        });
    });

    describe('Viewing a file', () => {
        it('Should request the default 200 lines and show them', async () => {
            const user = await setup();

            await openFile(user);

            const { path, params } = lastContentRequest();
            expect(path).toBe(`${API_BASE_URL}/admin/logs/application.log`);
            expect(params.get('lines')).toBe('200');
            expect(params.has('all')).toBe(false);
            expect(params.has('search')).toBe(false);
            expect(screen.getByText('ERROR something broke')).toBeInTheDocument();
            expect(screen.getByText('2 of 10 lines')).toBeInTheDocument();
        });

        it('Should URL encode the file name', async () => {
            const user = await setup();

            await openFile(user, 'my server.log');

            expect(lastContentRequest().path).toBe(`${API_BASE_URL}/admin/logs/my%20server.log`);
        });

        it('Should say when a file has no lines', async () => {
            mockApi({ file: mockResponse(true, content({ lines: [], count: 0, total: 0 })) });
            const user = await setup();

            await user.click(screen.getByRole('button', { name: /application\.log/ }));

            expect(await screen.findByText('No lines to display.')).toBeInTheDocument();
        });

        it.each([
            [
                'the API reports an error',
                mockResponse(false, { error: true, messages: ['x'] }),
                'Failed to load log content',
            ],
            ['the response is not ok', mockResponse(false, content()), 'Failed to load log content'],
            [
                'the body is malformed',
                mockResponse(true, { error: false, data: { lines: 'x' } }),
                'Invalid response format',
            ],
            ['there is no response', null, 'Invalid state.'],
        ])('Should show an error when %s', async (_label, file, message) => {
            mockApi({ file });
            const user = await setup();

            await user.click(screen.getByRole('button', { name: /application\.log/ }));

            expect(await screen.findByRole('alert')).toHaveTextContent(message);
        });

        it('Should refresh with the same settings', async () => {
            const user = await setup();
            await openFile(user);
            const callsBefore = mockAuthFetch.mock.calls.length;

            await user.click(screen.getByRole('button', { name: /refresh/i }));

            await waitFor(() => {
                expect(mockAuthFetch.mock.calls).toHaveLength(callsBefore + 1);
            });
            expect(lastContentRequest().params.get('lines')).toBe('200');
        });
    });

    describe('Line count', () => {
        it('Should request a specific number of lines', async () => {
            const user = await setup();
            await openFile(user);

            await user.click(screen.getByRole('combobox'));
            await user.click(screen.getByRole('option', { name: '1000' }));

            await waitFor(() => {
                expect(lastContentRequest().params.get('lines')).toBe('1000');
            });
        });

        it('Should request every line with all=true', async () => {
            const user = await setup();
            await openFile(user);

            await user.click(screen.getByRole('combobox'));
            await user.click(screen.getByRole('option', { name: 'All' }));

            await waitFor(() => {
                expect(lastContentRequest().params.get('all')).toBe('true');
            });
            expect(lastContentRequest().params.has('lines')).toBe(false);
        });

        it('Should keep the chosen line count when switching files', async () => {
            const user = await setup();
            await openFile(user);
            await user.click(screen.getByRole('combobox'));
            await user.click(screen.getByRole('option', { name: '500' }));

            await openFile(user, 'my server.log');

            expect(lastContentRequest().params.get('lines')).toBe('500');
        });

        it('Should only flag truncation when loading all lines', async () => {
            mockApi({ file: mockResponse(true, content({ truncated: true })) });
            const user = await setup();
            await openFile(user);

            expect(screen.queryByText('Truncated')).not.toBeInTheDocument();

            await user.click(screen.getByRole('combobox'));
            await user.click(screen.getByRole('option', { name: 'All' }));

            expect(await screen.findByText('Truncated')).toBeInTheDocument();
        });
    });

    describe('Search', () => {
        it('Should keep the search button disabled until there is text', async () => {
            const user = await setup();
            await openFile(user);

            expect(searchButton()).toBeDisabled();

            await user.type(searchBox(), 'error');

            expect(searchButton()).toBeEnabled();
        });

        it('Should search on Enter, show match counts, and highlight matches', async () => {
            const user = await setup();
            await openFile(user);
            mockApi({
                file: mockResponse(true, content({ lines: ['ERROR something broke'], count: 1, filtered: true })),
            });

            await user.type(searchBox(), 'broke{Enter}');

            await waitFor(() => {
                expect(lastContentRequest().params.get('search')).toBe('broke');
            });
            expect(await screen.findByText('1 of 10 matched')).toBeInTheDocument();
            const highlighted = defined(document.querySelector('mark'), 'highlighted match');
            expect(highlighted).toHaveTextContent('broke');
        });

        it('Should search with the search button', async () => {
            const user = await setup();
            await openFile(user);

            await user.type(searchBox(), 'started');
            await user.click(searchButton());

            await waitFor(() => {
                expect(lastContentRequest().params.get('search')).toBe('started');
            });
        });

        it('Should suggest a different term when a search finds nothing', async () => {
            const user = await setup();
            await openFile(user);
            mockApi({ file: mockResponse(true, content({ lines: [], count: 0, filtered: true })) });

            await user.type(searchBox(), 'zzz{Enter}');

            expect(await screen.findByText('No lines to display - try a different search term.')).toBeInTheDocument();
        });

        it('Should keep the search when refreshing and drop it when cleared', async () => {
            const user = await setup();
            await openFile(user);
            await user.type(searchBox(), 'error{Enter}');
            await waitFor(() => {
                expect(lastContentRequest().params.get('search')).toBe('error');
            });

            await user.click(screen.getByRole('button', { name: /refresh/i }));
            await waitFor(() => {
                expect(lastContentRequest().params.get('search')).toBe('error');
            });

            const callsBefore = mockAuthFetch.mock.calls.length;
            await user.click(screen.getByTestId('ClearIcon'));

            await waitFor(() => {
                expect(mockAuthFetch.mock.calls).toHaveLength(callsBefore + 1);
            });
            expect(lastContentRequest().params.has('search')).toBe(false);
            expect(searchBox()).toHaveValue('');
        });

        it('Should reset the search when another file is opened', async () => {
            const user = await setup();
            await openFile(user);
            await user.type(searchBox(), 'error{Enter}');

            await openFile(user, 'my server.log');

            expect(searchBox()).toHaveValue('');
            expect(lastContentRequest().params.has('search')).toBe(false);
            expect(screen.queryByTestId('ClearIcon')).not.toBeInTheDocument();
        });
    });
});
