import { render, screen } from '@testing-library/react';
import LazyDatePicker from 'components/LazyDatePicker';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';

/**
 * Stand-in for the real picker so the test can tell when the lazy chunk has rendered
 * and inspect the props passed through
 */
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
    DatePicker: ({ label, value, minDate }: { label: string; value: Dayjs | null; minDate?: Dayjs }) => (
        <div data-testid="real-picker">
            <span>{label}</span>
            <span>{value?.format('YYYY-MM-DD')}</span>
            <span>{minDate ? `min ${minDate.format('YYYY-MM-DD')}` : ''}</span>
        </div>
    ),
}));

describe('<LazyDatePicker />', () => {
    it('Should show a disabled field with the same label while the picker loads', async () => {
        render(<LazyDatePicker label="Date" value={dayjs('2026-03-27')} />);

        const fallback = screen.getByRole('textbox', { name: 'Date' });
        expect(fallback).toBeDisabled();
        expect(screen.queryByTestId('real-picker')).not.toBeInTheDocument();

        expect(await screen.findByTestId('real-picker')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: 'Date' })).not.toBeInTheDocument();
    });

    it('Should pass every prop through to the picker', async () => {
        render(<LazyDatePicker label="Start" value={dayjs('2026-03-27')} minDate={dayjs('2025-03-27')} />);

        const picker = await screen.findByTestId('real-picker');
        expect(picker).toHaveTextContent('Start');
        expect(picker).toHaveTextContent('2026-03-27');
        expect(picker).toHaveTextContent('min 2025-03-27');
    });
});
