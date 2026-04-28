import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ErrorAlert from 'components/ErrorAlert';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import useFormField from 'hooks/useFormField';
import { usePending2FAFetch } from 'hooks/usePendingFetch';
import { type SubmitEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { parseApiValidationError } from 'utils/parseApiValidationError';
import { validate2FACode } from 'validators/validateTOTP';

/**
 * Dialog for completing 2FA verification during login.
 * Shown after successful password authentication when the account has 2FA enabled.
 * Accepts either a 6-digit TOTP code from an authenticator app or a recovery code.
 * Non-dismissable - the user must complete or abandon the login flow.
 */
export default function Verify2FADialog() {
    /**
     * Verify 2FA Dialog State
     */
    const { verify2FADialogOpen, closeVerify2FADialog } = useAuthDialogContext();
    const { pending2FAToken, complete2FALogin, logout } = useAuthContext();

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string[] | null>(null);

    const handleExited = () => {
        // Reset fields when modal finishes closing - only happens when this abruptly closes to invalid state
        codeField.reset();
        setError(null);
        setLoading(false);
    };

    /**
     * Pending 2FA fetch to use pending2fa token
     */
    const pending2FAFetch = usePending2FAFetch();
    const userAPI = useMemo(() => userService({ pending2FAFetch: pending2FAFetch }), [pending2FAFetch]);

    /**
     * 2FA Code Input
     */
    const codeField = useFormField({
        initialValue: '',
        validator: validate2FACode,
    });

    /**
     * If verify 2fa dialog open and pending 2fa token gets set to null (invalid state),
     * force close the verify dialog and logout
     */
    useEffect(() => {
        if (verify2FADialogOpen && pending2FAToken == null) {
            // Reset modal state
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setError(null);
            logout();
            closeVerify2FADialog();
        }
    }, [pending2FAToken, verify2FADialogOpen, closeVerify2FADialog, logout]);

    /**
     * Submit the 2FA code
     */
    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();

        if (loading) return;

        const codeError = codeField.validateField();
        if (codeError) {
            return;
        }

        if (!pending2FAToken) {
            setError(['Invalid session. Please log in again.']);
            return;
        }

        setLoading(true);

        // Build the form data packet
        const formData = new FormData();
        formData.append('code', codeField.value);

        try {
            // Verify2FA endpoints returns new valid JWT
            const token = await userAPI.verify2fa(formData);
            if (!token) throw new Error('Invalid state');

            await complete2FALogin(token);
            closeVerify2FADialog();
        } catch (err: unknown) {
            if (err instanceof APIError) {
                setError(parseApiValidationError(err.message));
            } else {
                console.error('Network error:', err);
                setError(['Server error. Please try again.']);
            }
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={verify2FADialogOpen}
            onClose={() => {
                // Dialog is non-closable
                return;
            }}
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
                Two-Factor Authentication
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Box component="form" id="verify2FAForm" onSubmit={(event) => void handleSubmit(event)} noValidate>
                    <Stack spacing={3} sx={{ width: '100%' }}>
                        {error && <ErrorAlert messages={error} onClose={() => setError(null)} />}

                        <Typography variant="body2" color="text.secondary">
                            Enter the 6-digit code from your authenticator app. If you no longer have access to your
                            app, enter one of your recovery codes.
                        </Typography>

                        <FormControl>
                            <TextField
                                required
                                id="input2FACode"
                                label="Authentication Code"
                                name="code"
                                autoComplete="one-time-code"
                                slotProps={{
                                    htmlInput: { maxLength: 19 }, // max length of recovery code
                                }}
                                value={codeField.value}
                                onChange={codeField.handleChange}
                                onBlur={codeField.handleBlur}
                                error={!!codeField.error}
                                helperText={codeField.error ?? ' '}
                            />
                        </FormControl>
                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 1 }}>
                <Button loading={loading} loadingPosition="start" variant="outlined" type="submit" form="verify2FAForm">
                    Verify
                </Button>
            </DialogActions>
        </Dialog>
    );
}
