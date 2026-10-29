import TextField from '@mui/material/TextField';
import type { DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import { lazy, Suspense } from 'react';

const DayjsDatePicker = lazy(() => import('./DayjsDatePicker'));

/**
 * Lazy loaded DatePicker (with dayjs adapter)
 * Every picker lives inside a dialog, so @mui/x-date-pickers is only downloaded once a dialog opens
 * Fallback is a disabled field of the same size to avoid layout shift while the chunk loads
 */
export default function LazyDatePicker(props: DatePickerProps) {
    return (
        <Suspense fallback={<TextField label={props.label} disabled />}>
            <DayjsDatePicker {...props} />
        </Suspense>
    );
}
