import { render, screen } from '@testing-library/react';
import DayjsDatePicker from 'components/DayjsDatePicker';
import dayjs from 'dayjs';

describe('<DayjsDatePicker />', () => {
    it('Should render the real picker with the dayjs adapter', () => {
        render(<DayjsDatePicker label="Date" value={dayjs('2026-03-27')} />);

        // The picker throws without a LocalizationProvider, so rendering the field proves the adapter is wired up
        const field = screen.getByRole('group', { name: 'Date' });
        expect(field).toHaveTextContent('03');
        expect(field).toHaveTextContent('27');
        expect(field).toHaveTextContent('2026');
    });
});
