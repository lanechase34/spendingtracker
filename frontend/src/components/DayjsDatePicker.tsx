import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

/**
 * MUI DatePicker wrapped in a dayjs LocalizationProvider
 * Only import this through LazyDatePicker so @mui/x-date-pickers stays in its own chunk
 */
export default function DayjsDatePicker(props: DatePickerProps) {
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker {...props} />
        </LocalizationProvider>
    );
}
