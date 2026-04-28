import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ErrorAlert from 'components/ErrorAlert';
import useAuthFetch from 'hooks/useAuthFetch';
import useFormField from 'hooks/useFormField';
import useToastContext from 'hooks/useToastContext';
import type { SubmitEvent } from 'react';
import { useMemo, useState } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { validate2FACode } from 'validators/validateTOTP';

interface Disable2FADialogProps {
    open: boolean;
    onClose: () => void;
    onDisabled: () => void; // called after successful disable so parent can refresh user state
}

/**
 * Confirms and disables 2FA for the authenticated user.
 * Requires a valid TOTP code or recovery code before disabling.
 */
export default function Disable2FADialog({ open, onClose, onDisabled }: Disable2FADialogProps) {
    /**
     * Dialog state
     */
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string[] | null>(null);

    const { showToast } = useToastContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch }), [authFetch]);

    /**
     * TOTP field for 6-digit code or recovery code
     */
    const codeField = useFormField({
        initialValue: '',
        validator: validate2FACode,
    });

    const handleExited = () => {
        codeField.reset();
        setError(null);
        setLoading(false);
    };

    const handleClose = () => {
        if (loading) return;
        onClose();
    };

    /**
     * Submit the code
     */
    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();
        if (loading) return;

        const codeError = codeField.validateField();
        if (codeError) return;

        setLoading(true);
        setError(null);

        try {
            await userAPI.disable2fa(codeField.value);
            onDisabled();
            showToast('Two-factor authentication has been disabled.', 'success');
            onClose();
        } catch (err) {
            if (err instanceof APIError) {
                setError([err.message]);
            } else {
                setError(['Server error. Please try again.']);
            }
            codeField.reset();
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={(_e, reason) => {
                if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
                handleClose();
            }}
            fullWidth
            maxWidth="sm"
            slotProps={{
                transition: {
                    onExited: handleExited,
                },
            }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Disable Two-Factor Authentication
                <IconButton disabled={loading} aria-label="close" onClick={handleClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Stack spacing={3}>
                    {error && <ErrorAlert messages={error} onClose={() => setError(null)} />}

                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        Enter your current 6-digit authenticator code to confirm. If you no longer have access to your
                        authenticator app, enter one of your recovery codes.
                    </Typography>

                    <Box component="form" id="disable2FAForm" onSubmit={(e) => void handleSubmit(e)} noValidate>
                        <FormControl fullWidth>
                            <TextField
                                required
                                id="inputDisable2FACode"
                                label="Authentication Code"
                                name="code"
                                autoComplete="one-time-code"
                                slotProps={{ htmlInput: { maxLength: 19 } }}
                                value={codeField.value}
                                onChange={codeField.handleChange}
                                onBlur={codeField.handleBlur}
                                error={!!codeField.error}
                                helperText={codeField.error ?? ' '}
                                disabled={loading}
                            />
                        </FormControl>
                    </Box>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, py: 1.5 }}>
                <Button disabled={loading} variant="outlined" onClick={handleClose}>
                    Cancel
                </Button>

                <Button
                    loading={loading}
                    loadingPosition="start"
                    variant="outlined"
                    color="error"
                    type="submit"
                    form="disable2FAForm"
                >
                    Disable 2FA
                </Button>
            </DialogActions>
        </Dialog>
    );
}
