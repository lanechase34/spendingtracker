import { render } from '@test-utils';
import { screen, waitFor } from '@testing-library/react';
import ReceiptImg from 'expense/ReceiptImg';

import useFetchImage from '../../hooks/useFetchImage';

// Mocks
const mockFetchImage = jest.fn();

jest.mock('hooks/useFetchImage', () => ({
    __esModule: true,
    default: jest.fn(),
}));

const mockUseFetchImage = useFetchImage as jest.Mock;

/** Sets up useFetchImage mock with given state */
function setupHook({
    loading = false,
    error = false,
    imageSrc = '',
}: {
    loading?: boolean;
    error?: boolean;
    imageSrc?: string;
}) {
    mockUseFetchImage.mockReturnValue({
        loading,
        error,
        imageSrc,
        fetchImage: mockFetchImage,
    });
}

describe('ReceiptImg', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchImage.mockResolvedValue(undefined);
    });

    describe('Loading state', () => {
        it('Renders a loading spinner when loading is true', () => {
            setupHook({ loading: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('progressbar')).toBeInTheDocument();
        });

        it('Does not render the image while loading', () => {
            setupHook({ loading: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });

        it('Does not render the error message while loading', () => {
            setupHook({ loading: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.queryByText('Failed to load receipt.')).not.toBeInTheDocument();
        });
    });

    describe('Error state', () => {
        it('Renders the error message when error is true', () => {
            setupHook({ error: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByText('Failed to load receipt.')).toBeInTheDocument();
        });

        it('Does not render the image when error is true', () => {
            setupHook({ error: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });

        it('Does not render the loading spinner when error is true', () => {
            setupHook({ error: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        it('Renders the error Typography with error color', () => {
            setupHook({ error: true });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            const errorText = screen.getByText('Failed to load receipt.');
            expect(errorText).toBeInTheDocument();
        });
    });

    describe('Success state', () => {
        it('Renders the image when loading is false and no error', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toBeInTheDocument();
        });

        it('Sets the correct src on the image', () => {
            const blobUrl = 'blob:http://localhost/receipt-123';
            setupHook({ imageSrc: blobUrl });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toHaveAttribute('src', blobUrl);
        });

        it('Sets alt text as "{alt} receipt"', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toHaveAttribute('alt', 'Groceries receipt');
        });

        it('Applies correct inline styles to the image', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            const img = screen.getByRole('img');
            expect(img).toHaveStyle({ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' });
        });

        it('Does not render the spinner in success state', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        it('Does not render the error message in success state', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.queryByText('Failed to load receipt.')).not.toBeInTheDocument();
        });
    });

    describe('fetchImage invocation', () => {
        it('Calls fetchImage on mount when url is provided', () => {
            setupHook({});
            render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(mockFetchImage).toHaveBeenCalledTimes(1);
        });

        it('Does not call fetchImage when url is empty string', () => {
            setupHook({});
            render(<ReceiptImg alt="Groceries" url="" />);
            expect(mockFetchImage).not.toHaveBeenCalled();
        });

        it('Calls fetchImage again when url changes', () => {
            setupHook({});
            const { rerender } = render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(mockFetchImage).toHaveBeenCalledTimes(1);

            rerender(<ReceiptImg alt="Groceries" url="/api/receipt/2" />);
            expect(mockFetchImage).toHaveBeenCalledTimes(2);
        });

        it('Does not call fetchImage again when url is unchanged on rerender', () => {
            setupHook({});
            const { rerender } = render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(mockFetchImage).toHaveBeenCalledTimes(1);

            rerender(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(mockFetchImage).toHaveBeenCalledTimes(1);
        });

        it('Calls fetchImage again when fetchImage reference changes', () => {
            setupHook({});
            const { rerender } = render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(mockFetchImage).toHaveBeenCalledTimes(1);

            // Simulate hook returning a new fetchImage reference
            const newFetchImage = jest.fn().mockResolvedValue(undefined);
            mockUseFetchImage.mockReturnValue({
                loading: false,
                error: false,
                imageSrc: 'blob:http://localhost/receipt-123',
                fetchImage: newFetchImage,
            });

            rerender(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(newFetchImage).toHaveBeenCalledTimes(1);
        });

        it('Passes the correct url to useFetchImage', () => {
            setupHook({});
            render(<ReceiptImg alt="Groceries" url="/api/receipt/42" />);
            expect(mockUseFetchImage).toHaveBeenCalledWith({ url: '/api/receipt/42' });
        });
    });

    describe('Alt text', () => {
        it('Uses the alt prop in the image alt attribute', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="Office Supplies" url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toHaveAttribute('alt', 'Office Supplies receipt');
        });

        it('Handles alt text with special characters', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt='Lunch & "Dinner"' url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toHaveAttribute('alt', 'Lunch & "Dinner" receipt');
        });

        it('Handles empty alt text', () => {
            setupHook({ imageSrc: 'blob:http://localhost/receipt-123' });
            render(<ReceiptImg alt="" url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toHaveAttribute('alt', ' receipt');
        });
    });

    describe('State transitions', () => {
        it('Transitions from loading to success', async () => {
            setupHook({ loading: true });
            const { rerender } = render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('progressbar')).toBeInTheDocument();

            mockUseFetchImage.mockReturnValue({
                loading: false,
                error: false,
                imageSrc: 'blob:http://localhost/receipt-123',
                fetchImage: mockFetchImage,
            });

            rerender(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
            expect(screen.getByRole('img')).toBeInTheDocument();
        });

        it('Transitions from loading to error', async () => {
            setupHook({ loading: true });
            const { rerender } = render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('progressbar')).toBeInTheDocument();

            mockUseFetchImage.mockReturnValue({
                loading: false,
                error: true,
                imageSrc: '',
                fetchImage: mockFetchImage,
            });

            rerender(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
            expect(screen.getByText('Failed to load receipt.')).toBeInTheDocument();
        });

        it('Updates the image src when url changes and new image loads', async () => {
            const firstBlob = 'blob:http://localhost/receipt-1';
            const secondBlob = 'blob:http://localhost/receipt-2';

            mockUseFetchImage.mockReturnValue({
                loading: false,
                error: false,
                imageSrc: firstBlob,
                fetchImage: mockFetchImage,
            });

            const { rerender } = render(<ReceiptImg alt="Groceries" url="/api/receipt/1" />);
            expect(screen.getByRole('img')).toHaveAttribute('src', firstBlob);

            mockUseFetchImage.mockReturnValue({
                loading: false,
                error: false,
                imageSrc: secondBlob,
                fetchImage: mockFetchImage,
            });

            rerender(<ReceiptImg alt="Groceries" url="/api/receipt/2" />);
            await waitFor(() => expect(screen.getByRole('img')).toHaveAttribute('src', secondBlob));
        });
    });
});
