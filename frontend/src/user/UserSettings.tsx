import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import InputLabel from '@mui/material/InputLabel';
import TextField from '@mui/material/TextField';
import useFormField from 'hooks/useFormField';
import useUserContext from 'hooks/useUserContext';
import { useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import useAuthFetch from 'hooks/useAuthFetch';
import useToastContext from 'hooks/useToastContext';
import { validateMoney } from 'validators/validateMoney';
import { userService } from 'schema/user';

interface UserSettingsProps {
    open: boolean;
    onClose: (_event: object, reason: string) => void;
}

export default function UserSettings({ open, onClose }: UserSettingsProps) {
    const [saving, setSaving] = useState<boolean>(false);

    const { user } = useUserContext();
    const { showToast } = useToastContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch: authFetch }), [authFetch]);

    const passwordField = useFormField({
        initialValue: '',
        validator: (value: string) => {
            if (!value || value.trim().length == 0) return null; // not required
            if (value.trim().length < 10) return 'Password must be at least 10 characters';
            return null;
        },
    });

    const salaryField = useFormField({
        initialValue: `${user!.salary!}`,
        validator: validateMoney,
    });

    const monthlyTakeHomeField = useFormField({
        initialValue: `${user!.monthlyTakeHome!}`,
        validator: validateMoney,
    });

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (saving) return;
        setSaving(true);

        // Final validation
        const newErrors = {
            password: passwordField.validateField(),
            salary: salaryField.validateField(),
            monthlyTakeHome: monthlyTakeHomeField.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some((err) => err && err !== null && err !== '');
        if (hasErrors) {
            setSaving(false);
            return;
        }

        try {
            await userAPI.updateProfile({
                password: passwordField.value,
                salary: salaryField.value,
                monthlyTakeHome: monthlyTakeHomeField.value,
            });

            showToast('Successfully saved!', 'success');
            onClose({}, 'doneLoading');
        } catch (err: unknown) {
            console.error('Network error:', err);
            showToast('Server Error. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth={true} maxWidth={'sm'} disableEscapeKeyDown={true}>
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                Settings
                <IconButton disabled={saving} aria-label="close" onClick={() => onClose({}, 'button')}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Box
                    component="form"
                    id="userForm"
                    onSubmit={(event) => void handleSubmit(event)}
                    sx={{}}
                    noValidate
                    autoComplete="off"
                >
                    <Stack spacing={3} sx={{ width: '100%' }}>
                        <TextField
                            id="inputPassword"
                            label="Change Password"
                            name="password"
                            type="password"
                            value={passwordField.value}
                            onChange={passwordField.handleChange}
                            onBlur={passwordField.handleBlur}
                            error={!!passwordField.error}
                            helperText={passwordField.error}
                        />
                        <FormControl variant="outlined" error={!!salaryField.error} fullWidth>
                            <InputLabel htmlFor="outlined-adornment-salary">Salary</InputLabel>
                            <OutlinedInput
                                id="outlined-adornment-salary"
                                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                label="Salary"
                                required
                                value={salaryField.value}
                                onChange={salaryField.handleChange}
                                onBlur={salaryField.handleBlur}
                            />
                            {salaryField.error && <FormHelperText>{salaryField.error}</FormHelperText>}
                        </FormControl>

                        <FormControl variant="outlined" error={!!monthlyTakeHomeField.error} fullWidth>
                            <InputLabel htmlFor="outlined-adornment-salary">Monthly Take Home</InputLabel>
                            <OutlinedInput
                                id="outlined-adornment-takehome"
                                startAdornment={<InputAdornment position="start">$</InputAdornment>}
                                label="Monthly Take Home"
                                required
                                value={monthlyTakeHomeField.value}
                                onChange={monthlyTakeHomeField.handleChange}
                                onBlur={monthlyTakeHomeField.handleBlur}
                            />
                            {monthlyTakeHomeField.error && (
                                <FormHelperText>{monthlyTakeHomeField.error}</FormHelperText>
                            )}
                        </FormControl>
                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 1 }}>
                <Button disabled={saving} variant="outlined" onClick={() => onClose({}, 'button')}>
                    Close
                </Button>
                <Button loading={saving} loadingPosition="start" variant="outlined" type="submit" form="userForm">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
