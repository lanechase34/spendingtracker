import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceiptUpload from 'expense/ReceiptUpload';
import type { ChangeEvent } from 'react';
import { useState } from 'react';

// Wrap the receipt upload to utilize state for the selected receipt
function Wrapper() {
    const [selectedReceipt, setSelectedReceipt] = useState<File | null>(null);

    const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) setSelectedReceipt(e.target.files[0]);
    };

    return (
        <ReceiptUpload
            selectedReceipt={selectedReceipt}
            error={null}
            handleReceiptChange={handleReceiptChange}
            validExtensions=".pdf,.jpg,.png"
        />
    );
}

describe('ReceiptUpload', () => {
    const handleReceiptChangeMock = jest.fn<void, [ChangeEvent<HTMLInputElement>]>();

    beforeEach(() => {
        handleReceiptChangeMock.mockClear();
    });

    it('Renders the upload button with default text', () => {
        render(
            <ReceiptUpload
                selectedReceipt={null}
                error={null}
                handleReceiptChange={handleReceiptChangeMock}
                validExtensions=".pdf,.jpg,.png"
            />
        );

        expect(screen.getByTestId('uploadReceiptBtn')).toHaveTextContent('Upload Receipt');
    });

    it('Displays selected file name if provided', () => {
        const file = new File(['dummy content'], 'receipt.pdf', { type: 'application/pdf' });

        render(
            <ReceiptUpload
                selectedReceipt={file}
                error={null}
                handleReceiptChange={handleReceiptChangeMock}
                validExtensions=".pdf,.jpg,.png"
            />
        );

        expect(screen.getByText(/Selected:/)).toHaveTextContent('Selected: receipt.pdf');
    });

    it('Displays error message if provided', () => {
        const errorMsg = 'Invalid file type';

        render(
            <ReceiptUpload
                selectedReceipt={null}
                error={errorMsg}
                handleReceiptChange={handleReceiptChangeMock}
                validExtensions=".pdf,.jpg,.png"
            />
        );

        expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });

    it('The visually hidden input element exists within the button', () => {
        render(
            <ReceiptUpload
                selectedReceipt={null}
                error={null}
                handleReceiptChange={handleReceiptChangeMock}
                validExtensions=".pdf,.jpg,.png"
            />
        );

        const hiddenInput = screen.getByTestId('uploadReceipt');
        expect(hiddenInput).toBeInTheDocument();
        expect(hiddenInput).toHaveAttribute('type', 'file');
    });

    it('Calls handleReceiptChange when file is uploaded', async () => {
        render(
            <ReceiptUpload
                selectedReceipt={null}
                error={null}
                handleReceiptChange={handleReceiptChangeMock}
                validExtensions=".pdf,.jpg,.png"
            />
        );

        const hiddenInput = screen.getByTestId('uploadReceipt');

        const file = new File(['dummy content'], 'receipt.pdf', { type: 'application/pdf' });

        // Use userEvent.upload for file inputs
        await userEvent.upload(hiddenInput, file);

        await waitFor(() => {
            expect(handleReceiptChangeMock).toHaveBeenCalledTimes(1);
        });

        // Check that the event contains the file
        const event = handleReceiptChangeMock.mock.calls[0][0];
        expect(event.target.files).toHaveLength(1);
        expect(event.target.files![0]).toStrictEqual(file);
    });

    it('Will upload button text based on file selected in state', async () => {
        render(<Wrapper />);

        const hiddenInput = screen.getByTestId('uploadReceipt');
        const file = new File(['dummy content'], 'receipt.pdf', { type: 'application/pdf' });

        await userEvent.upload(hiddenInput, file);

        await waitFor(() => {
            // Now the button text will update because state changed
            expect(screen.getByTestId('uploadReceiptBtn')).toHaveTextContent('Replace Receipt');
        });
    });
});
