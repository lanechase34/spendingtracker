import { render } from '@test-utils';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useAuthFetch from 'hooks/useAuthFetch';
import { API_BASE_URL } from 'utils/constants';
import ExportExpensesCard from 'widgets/Export';

jest.mock('hooks/useAuthFetch');
jest.mock('hooks/useDateRangeContext', () => ({
    __esModule: true,
    default: () => ({ formattedStartDate: '01-01-2026', formattedEndDate: '03-31-2026' }),
}));

const mockAuthFetch = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);

function fileResponse(blob = new Blob(['data'])) {
    return { ok: true, status: 200, blob: () => Promise.resolve(blob) };
}

function errorResponse(body?: unknown, status = 400) {
    return {
        ok: false,
        status,
        json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    };
}

/**
 * Both exports share the same flow, they differ in endpoint, file name, cooldown and copy
 */
describe.each([
    {
        name: 'CSV export',
        button: 'Export to CSV',
        url: `${API_BASE_URL}/expenses/export`,
        fileName: 'expenses_01-01-2026_to_03-31-2026.csv',
        success: 'Export successful! Your download should begin shortly.',
        storageKey: 'expenseExportCsvCooldownUntil',
        cooldownText: /export available in \(1:00\)/i,
    },
    {
        name: 'Receipt download',
        button: 'Download Receipts',
        url: `${API_BASE_URL}/receipts/export`,
        fileName: 'receipts_01-01-2026_to_03-31-2026.zip',
        success: 'Receipts exported! Your download should begin shortly.',
        storageKey: 'expenseExportReceiptCooldownUntil',
        cooldownText: /download available in \(10:00\)/i,
    },
])('<ExportExpensesCard /> $name', ({ button, url, fileName, success, storageKey, cooldownText }) => {
    let clickSpy: jest.SpyInstance;
    let downloads: string[];

    const exportButton = () => screen.getByRole('button', { name: button });

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        localStorage.clear();

        // jsdom has no object URLs, and anchor clicks would try to navigate
        URL.createObjectURL = jest.fn(() => 'blob:mock');
        URL.revokeObjectURL = jest.fn();
        downloads = [];
        clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            downloads.push(this.download);
        });
    });

    afterEach(() => {
        clickSpy.mockRestore();
    });

    it('Should POST the selected date range', async () => {
        mockAuthFetch.mockResolvedValue(fileResponse());
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());

        await waitFor(() => {
            expect(mockAuthFetch).toHaveBeenCalledWith({
                url,
                method: 'POST',
                body: { startDate: '01-01-2026', endDate: '03-31-2026' },
            });
        });
    });

    it('Should download the file, clean up the object URL, and confirm', async () => {
        mockAuthFetch.mockResolvedValue(fileResponse());
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());

        expect(await screen.findByText(success)).toBeInTheDocument();
        expect(downloads).toEqual([fileName]);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
        expect(document.querySelector('a[download]')).not.toBeInTheDocument();
    });

    it('Should start a cooldown after a successful export', async () => {
        mockAuthFetch.mockResolvedValue(fileResponse());
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());

        expect(await screen.findByText(cooldownText)).toBeInTheDocument();
        expect(exportButton()).toBeDisabled();
        expect(Number(localStorage.getItem(storageKey))).toBeGreaterThan(Date.now());
    });

    it('Should start disabled when a cooldown is already stored', () => {
        localStorage.setItem(storageKey, JSON.stringify(Date.now() + 30_000));
        render(<ExportExpensesCard />);

        expect(exportButton()).toBeDisabled();
    });

    it.each([
        [
            'parsed validation messages',
            errorResponse({
                error: true,
                messages: ["Invalid Parameters. The 'startDate' value is not a date; Too far back"],
            }),
            ['Start Date not a date', 'Too far back'],
        ],
        [
            'a generic message for a malformed body',
            errorResponse({ error: 'yes' }),
            ['Export failed. Invalid response format.'],
        ],
        [
            'a generic message for a non-JSON body',
            errorResponse(undefined, 502),
            ['Export failed. Invalid response format.'],
        ],
        ['a fallback when the API sends no messages', errorResponse({ error: false, data: {} }), ['Export failed.']],
        ['a failure when not authenticated', null, ['Export failed']],
    ])('Should show %s', async (_label, response, messages) => {
        mockAuthFetch.mockResolvedValue(response);
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());

        const alert = await screen.findByRole('alert');
        for (const message of messages) {
            expect(within(alert).getByText(message)).toBeInTheDocument();
        }
        expect(downloads).toEqual([]);
    });

    it('Should show a generic error when the request throws', async () => {
        mockAuthFetch.mockRejectedValue(new Error('Network down'));
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());

        expect(await screen.findByText('Export failed. Please try again.')).toBeInTheDocument();
    });

    it('Should not start a cooldown when the export fails, so the user can retry', async () => {
        mockAuthFetch.mockResolvedValue(errorResponse({ error: true, messages: ['Server busy'] }));
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());
        await screen.findByText('Server busy');

        expect(exportButton()).toBeEnabled();
        expect(screen.queryByText(cooldownText)).not.toBeInTheDocument();
        expect(localStorage.getItem(storageKey)).toBe('null');
    });

    it('Should let the user dismiss the error', async () => {
        mockAuthFetch.mockResolvedValue(errorResponse({ error: true, messages: ['Server busy'] }));
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(exportButton());
        const alert = await screen.findByRole('alert');
        await user.click(within(alert).getByRole('button', { name: /close/i }));

        await waitFor(() => {
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
});

describe('<ExportExpensesCard /> receipts', () => {
    it('Should reject an empty zip file', async () => {
        mockAuthFetch.mockReset();
        localStorage.clear();
        mockAuthFetch.mockResolvedValue(fileResponse(new Blob([])));
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(screen.getByRole('button', { name: 'Download Receipts' }));

        expect(await screen.findByText('Received empty file')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Download Receipts' })).toBeEnabled();
    });

    it('Should keep the two exports independent', async () => {
        mockAuthFetch.mockReset();
        localStorage.clear();
        URL.createObjectURL = jest.fn(() => 'blob:mock');
        URL.revokeObjectURL = jest.fn();
        const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
        mockAuthFetch.mockResolvedValue(fileResponse());
        const user = userEvent.setup();
        render(<ExportExpensesCard />);

        await user.click(screen.getByRole('button', { name: 'Export to CSV' }));
        await screen.findByText(/export available in/i);

        expect(screen.getByRole('button', { name: 'Download Receipts' })).toBeEnabled();
        expect(screen.queryByText(/receipts exported/i)).not.toBeInTheDocument();
        clickSpy.mockRestore();
    });
});
