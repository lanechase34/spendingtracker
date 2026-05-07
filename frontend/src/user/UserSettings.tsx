import CloseIcon from '@mui/icons-material/Close';
import SecurityIcon from '@mui/icons-material/Security';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useAuthFetch from 'hooks/useAuthFetch';
import useFormField from 'hooks/useFormField';
import useToastContext from 'hooks/useToastContext';
import useUserContext from 'hooks/useUserContext';
import { type SubmitEvent } from 'react';
import { useMemo, useState } from 'react';
import { userService } from 'schema/user';
import { validateMoney } from 'validators/validateMoney';

import Disable2FADialog from './Disable2FADialog';
import Setup2FADialog from './Setup2FADialog';

interface UserSettingsProps {
    open: boolean;
    onClose: (_event: object, reason: string) => void;
}

/**
 * Various options pertaining to the user
 */
export default function UserSettings({ open, onClose }: UserSettingsProps) {
    const [saving, setSaving] = useState<boolean>(false);

    const [setup2FAOpen, setSetup2FAOpen] = useState<boolean>(false);
    const [disable2FAOpen, setDisable2FAOpen] = useState<boolean>(false);

    const { user, updateUser } = useUserContext();
    const { showToast } = useToastContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch: authFetch }), [authFetch]);

    const passwordField = useFormField({
        initialValue: '',
        validator: (value: string) => {
            if (!value || value.trim().length === 0) return null; // not required
            if (value.trim().length < 10) return 'Password must be at least 10 characters';
            return null;
        },
    });

    const confirmPasswordField = useFormField({
        initialValue: '',
        validator: (value: string) => {
            if (!value || value.trim().length === 0) return 'Please confirm your new password';
            if (value !== passwordField.value) return 'Passwords do not match';
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

    const handleExited = () => {
        passwordField.reset();
        confirmPasswordField.reset();
        salaryField.reset();
        monthlyTakeHomeField.reset();
    };

    /**
     * Whether the user has made any changes worth saving
     */
    const hasChanges = passwordField.value.trim().length > 0 || salaryField.isDirty || monthlyTakeHomeField.isDirty;

    /**
     * Whether a password is being changed - controls confirm field visibility
     */
    const isChangingPassword = passwordField.value.trim().length > 0;

    /**
     * Whether the form is valid to submit
     */
    const isValid =
        hasChanges &&
        !salaryField.error &&
        !monthlyTakeHomeField.error &&
        !passwordField.error &&
        // If changing password, confirm must match
        (!isChangingPassword || confirmPasswordField.value === passwordField.value);

    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();

        if (saving || !isValid) return;
        setSaving(true);

        // Final validation
        const newErrors = {
            password: passwordField.validateField(),
            salary: salaryField.validateField(),
            monthlyTakeHome: monthlyTakeHomeField.validateField(),
        };

        if (isChangingPassword) {
            newErrors.password = confirmPasswordField.validateField();
        }

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

            salaryField.resetTo(salaryField.value);
            monthlyTakeHomeField.resetTo(monthlyTakeHomeField.value);
            passwordField.reset();
            confirmPasswordField.reset();

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
        <>
            <Dialog
                open={open}
                onClose={onClose}
                fullWidth={true}
                maxWidth={'sm'}
                slotProps={{
                    transition: {
                        onExited: handleExited,
                    },
                }}
            >
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
                    {/* Account section */}
                    <Box
                        component="form"
                        id="userForm"
                        onSubmit={(event) => void handleSubmit(event)}
                        sx={{ pb: 3 }}
                        noValidate
                        autoComplete="off"
                    >
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                            Account
                        </Typography>

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

                            {/* Confirm password - only shown when user starts typing a new password */}
                            {isChangingPassword && (
                                <TextField
                                    id="inputConfirmPassword"
                                    label="Confirm New Password"
                                    name="confirmPassword"
                                    type="password"
                                    value={confirmPasswordField.value}
                                    onChange={confirmPasswordField.handleChange}
                                    onBlur={confirmPasswordField.handleBlur}
                                    error={!!confirmPasswordField.error}
                                    helperText={confirmPasswordField.error ?? ' '}
                                />
                            )}

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
                                <InputLabel htmlFor="outlined-adornment-takehome">Monthly Take Home</InputLabel>
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

                    <Divider />

                    {/* Security section */}
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ my: 2 }}>
                            Security
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                p: 2,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <SecurityIcon fontSize="small" color={user?.totpEnabled ? 'success' : 'action'} />
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                        Two-Factor Authentication
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {user?.totpEnabled
                                            ? 'Enabled - your account is protected with 2FA.'
                                            : 'Disabled - add an extra layer of security.'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Button
                                variant="outlined"
                                size="small"
                                color={user?.totpEnabled ? 'error' : 'primary'}
                                onClick={() => (user?.totpEnabled ? setDisable2FAOpen(true) : setSetup2FAOpen(true))}
                                sx={{ ml: 2, flexShrink: 0 }}
                            >
                                {user?.totpEnabled ? 'Disable' : 'Enable'}
                            </Button>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button disabled={saving} variant="outlined" onClick={() => onClose({}, 'button')}>
                        Close
                    </Button>
                    <Button
                        loading={saving}
                        loadingPosition="start"
                        variant="outlined"
                        type="submit"
                        form="userForm"
                        disabled={!isValid || saving}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            <Setup2FADialog
                open={setup2FAOpen}
                onClose={() => setSetup2FAOpen(false)}
                onEnabled={() => updateUser({ totpEnabled: true })}
            />

            <Disable2FADialog
                open={disable2FAOpen}
                onClose={() => setDisable2FAOpen(false)}
                onDisabled={() => updateUser({ totpEnabled: false })}
            />
        </>
    );
}
