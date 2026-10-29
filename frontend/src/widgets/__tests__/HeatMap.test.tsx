import { render } from '@test-utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import useAuthFetch from 'hooks/useAuthFetch';
import useBreakpoint from 'hooks/useBreakpoint';
import { API_BASE_URL } from 'utils/constants';
import { COLOR_PALETTES } from 'utils/palettes';
import HeatMap from 'widgets/HeatMap';

jest.mock('hooks/useAuthFetch');
jest.mock('hooks/useBreakpoint');
// Sun Mar 1 2026 - Thu Apr 30 2026, which pads out to Sat May 2: 9 weeks
jest.mock('hooks/useDateRangeContext', () => ({
    __esModule: true,
    default: () => ({
        startDate: dayjs('2026-03-01'),
        endDate: dayjs('2026-04-30'),
        formattedStartDate: '03-01-2026',
        formattedEndDate: '04-30-2026',
    }),
}));
jest.mock('components/LoadingCard', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-card" />,
}));
jest.mock('components/ErrorCard', () => ({
    __esModule: true,
    default: () => <div data-testid="error-card" />,
}));
jest.mock('components/EmptyCard', () => ({
    __esModule: true,
    default: () => <div data-testid="empty-card" />,
}));

const mockAuthFetch = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);
const mockUseBreakpoint = useBreakpoint as jest.Mock;

const WEEKS = 9;

function mockResponse(ok: boolean, body: unknown) {
    return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) };
}

const heatMapData = { '2026-03-04': 1, '2026-03-05': 3, '2026-04-10': 12 };

// Day cells are the only fixed-size squares in the widget
function cells(size = 16) {
    return [...document.querySelectorAll<HTMLElement>('div')].filter((el) => {
        const style = getComputedStyle(el);
        return style.width === `${String(size)}px` && style.height === `${String(size)}px`;
    });
}

// Cell index within the grid: weeks are columns starting Sun Mar 1
const cellFor = (date: string, size = 16) => {
    const index = dayjs(date).diff(dayjs('2026-03-01'), 'day');
    const cell = cells(size)[index];
    if (!cell) throw new Error(`No cell for ${date}`);
    return cell;
};

describe('<HeatMap />', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        mockUseBreakpoint.mockReturnValue({ isMobile: false });
        jest.spyOn(console, 'error').mockImplementation(() => {
            /* Silence expected query errors */
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Should request the selected date range', async () => {
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: heatMapData }));
        render(<HeatMap />);

        await screen.findByText('Expenses Heatmap');
        expect(mockAuthFetch).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `${API_BASE_URL}/widgets/heatMap?startDate=03-01-2026&endDate=04-30-2026`,
                method: 'GET',
            })
        );
    });

    it('Should show the loading card while fetching', () => {
        mockAuthFetch.mockReturnValue(
            new Promise(() => {
                /* never resolves */
            })
        );
        render(<HeatMap />);

        expect(screen.getByTestId('loading-card')).toBeInTheDocument();
    });

    it.each([
        ['there is no response', null],
        ['the response is not ok', mockResponse(false, { error: true, messages: ['x'] })],
        ['the API reports an error', mockResponse(true, { error: true, messages: ['x'] })],
        ['the body is malformed', mockResponse(true, { error: false, data: { '2026-03-01': 'many' } })],
    ])('Should show the error card when %s', async (_label, response) => {
        mockAuthFetch.mockResolvedValue(response);
        render(<HeatMap />);

        expect(await screen.findByTestId('error-card')).toBeInTheDocument();
    });

    it('Should show the empty card when there are no expenses', async () => {
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: {} }));
        render(<HeatMap />);

        expect(await screen.findByTestId('empty-card')).toBeInTheDocument();
    });

    it('Should draw a cell for every day of every padded week', async () => {
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: heatMapData }));
        render(<HeatMap />);

        await screen.findByText('Expenses Heatmap');
        expect(cells()).toHaveLength(WEEKS * 7);
    });

    it('Should label each month once and the days of the week', async () => {
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: heatMapData }));
        render(<HeatMap />);

        await screen.findByText('Expenses Heatmap');
        expect(screen.getAllByText('Mar')).toHaveLength(1);
        expect(screen.getAllByText('Apr')).toHaveLength(1);
        // The week of Apr 26 - May 2 is still April by its Thursday
        expect(screen.queryByText('May')).not.toBeInTheDocument();
        for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
            expect(screen.getByText(day)).toBeInTheDocument();
        }
    });

    it('Should shade each day by its expense count', async () => {
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: heatMapData }));
        render(<HeatMap color="teal" />);

        await screen.findByText('Expenses Heatmap');
        const toRgb = (hex: string) => {
            const probe = document.createElement('div');
            probe.style.backgroundColor = hex;
            return probe.style.backgroundColor;
        };
        const [none, one, , upToFour, many] = COLOR_PALETTES.teal;
        expect(getComputedStyle(cellFor('2026-03-03')).backgroundColor).toBe(toRgb(none));
        expect(getComputedStyle(cellFor('2026-03-04')).backgroundColor).toBe(toRgb(one));
        expect(getComputedStyle(cellFor('2026-03-05')).backgroundColor).toBe(toRgb(upToFour));
        expect(getComputedStyle(cellFor('2026-04-10')).backgroundColor).toBe(toRgb(many));
    });

    it.each([
        ['2026-03-04', '2026-03-04: 1 expense'],
        ['2026-03-05', '2026-03-05: 3 expenses'],
        ['2026-03-06', '2026-03-06: 0 expenses'],
    ])('Should show the count for %s on hover', async (date, label) => {
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: heatMapData }));
        const user = userEvent.setup();
        render(<HeatMap />);

        await screen.findByText('Expenses Heatmap');
        await user.hover(cellFor(date));

        await waitFor(() => {
            expect(screen.getByRole('tooltip')).toHaveTextContent(label);
        });
    });

    it('Should use smaller cells on mobile', async () => {
        mockUseBreakpoint.mockReturnValue({ isMobile: true });
        mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false, data: heatMapData }));
        render(<HeatMap />);

        await screen.findByText('Expenses Heatmap');
        expect(cells(10)).toHaveLength(WEEKS * 7);
        expect(cells(16)).toHaveLength(0);
    });
});
