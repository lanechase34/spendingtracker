import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import { useState, useMemo, useEffect } from 'react';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import useFormField from 'hooks/useFormField';
import Stack from '@mui/material/Stack';
import type { FormEvent } from 'react';
import Alert from '@mui/material/Alert';
import InfoOutlineIcon from '@mui/icons-material/InfoOutline';
import usePendingFetch from 'hooks/usePendingFetch';
import useLocalStorage from 'hooks/useLocalStorage';
import { formatSecondsToTime } from 'utils/timeFormatter';
import { APIError } from 'utils/apiError';
import { userService } from 'schema/user';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import ErrorAlert from 'components/ErrorAlert';
import { parseApiValidationError } from 'utils/parseApiValidationError';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 Minutes

/**
 * Account verification form inside dialog
 */
export default function VerifyDialog() {
    /**
     * Verify Dialog State
     */
    const { verifyDialogOpen, closeVerifyDialog } = useAuthDialogContext();
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string[] | null>(null);

    const handleExited = () => {
        // Reset fields when modal finishes closing - only happens when this abruptly closes to invalid state
        verificationField.reset();
        setError(null);
        setLoading(false);
    };

    const { login: setToken, pendingToken, logout } = useAuthContext();

    /**
     * Pending fetch to use pending token for unverified user
     */
    const pendingFetch = usePendingFetch();
    const userAPI = useMemo(() => userService({ pendingFetch: pendingFetch }), [pendingFetch]);

    /**
     * If verify dialog open and pending token gets set to null (invalid state),
     * force close the verify dialog and logout
     */
    useEffect(() => {
        if (verifyDialogOpen && pendingToken == null) {
            // Reset modal state
            setResendAlert(null);
            setError(null);
            logout();
            closeVerifyDialog();
        }
    }, [pendingToken, verifyDialogOpen, closeVerifyDialog, logout]);

    /**
     * State for when user is allowed to resend a verification code
     */
    const [resendLoading, setResendLoading] = useState<boolean>(false);
    const [cooldownUntil, setCooldownUntil] = useLocalStorage<number | null>({
        key: 'verificationResendCooldownUntil',
        initialValue: Date.now() + COOLDOWN_MS,
    });
    const [resendAlert, setResendAlert] = useState<string | null>(null);

    /**
     * Tracks active cooldown and remaining seconds for cooldown
     */
    const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

    useEffect(() => {
        if (!cooldownUntil) {
            setRemainingSeconds(0);
            return;
        }

        const tick = () => {
            const diff = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
            setRemainingSeconds(diff);
        };

        tick();
        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [cooldownUntil]);

    const isCooldownActive = remainingSeconds > 0;

    /**
     * Handles resend verification code when users requests it
     */
    const handleResend = async () => {
        if (resendLoading || isCooldownActive) return;

        setResendLoading(true);

        try {
            await userAPI.resendVerificationCode();
            // Success
            setError(null);
            setResendAlert('Success! Please check your email for a new verification code.');

            // Set cooldown til next time they can send
            const until = Date.now() + COOLDOWN_MS;
            setCooldownUntil(until);
        } catch (err: unknown) {
            if (err instanceof APIError && err.statusCode == 429) {
                setError(parseApiValidationError(err.message));
            } else {
                console.error('Network error:', err);
                setError(['Server error. Please try again.']);
            }
        } finally {
            setResendLoading(false);
        }
    };

    const verificationField = useFormField({
        initialValue: '',
        validator: (value: string): string | null => {
            if (!value.trim() || value.length != 8) return 'Please enter a valid code.';
            return null;
        },
    });

    /**
     * Submit the verification code
     */
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;
        setLoading(true);

        // Final validation
        const newErrors = {
            verificationCode: verificationField.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some((err) => err && err !== null && err !== '');
        if (hasErrors) {
            setLoading(false);
            return;
        }

        // Build the form data packet
        const formData = new FormData();
        formData.append('verificationcode', verificationField.value);

        try {
            // Verify endpoint returns new valid JWT
            const token = await userAPI.verify(formData);
            if (!token) throw new Error('Invalid state');

            void setToken(token); // Set the JWT
            closeVerifyDialog();
        } catch (err: unknown) {
            if (err instanceof APIError) {
                setError(parseApiValidationError(err.message));
            } else {
                console.error('Network error:', err);
                setError(['Invalid verification. Please try again.']);
            }
            setLoading(false);
        }
    };

    return (
        <Dialog
            open={verifyDialogOpen}
            onClose={() => {
                return;
            }}
            fullWidth={true}
            maxWidth={'sm'}
            disableEscapeKeyDown={true}
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
                Verify
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Box component="form" id="verifyForm" onSubmit={(event) => void handleSubmit(event)} sx={{}} noValidate>
                    <Stack spacing={3} sx={{ width: '100%' }}>
                        {error && <ErrorAlert messages={error} onClose={() => setError(null)} />}

                        {resendAlert && (
                            <Alert
                                severity="success"
                                onClose={() => {
                                    setResendAlert(null);
                                }}
                            >
                                {resendAlert}
                            </Alert>
                        )}

                        <Alert severity="info" icon={<InfoOutlineIcon fontSize="small" />}>
                            <Box>
                                Check your email for a verification code and enter it below. You may need to check your
                                'Spam' and 'Junk' folders and trust senders from '<b>@chaselane.dev</b>'
                            </Box>

                            <Box mt={2}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => {
                                        void handleResend();
                                    }}
                                    disabled={isCooldownActive || resendLoading}
                                >
                                    {isCooldownActive
                                        ? `Resend verification code available in (${formatSecondsToTime(remainingSeconds)})`
                                        : 'Resend verification code'}
                                </Button>
                            </Box>
                        </Alert>

                        <TextField
                            required
                            id="inputVerificatoinCode"
                            label="Verification Code"
                            name="verificationcode"
                            value={verificationField.value}
                            onChange={verificationField.handleChange}
                            onBlur={verificationField.handleBlur}
                            error={!!verificationField.error}
                            helperText={verificationField.error}
                        />
                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 1 }}>
                <Button loading={loading} loadingPosition="start" variant="outlined" type="submit" form="verifyForm">
                    Verify
                </Button>
            </DialogActions>
        </Dialog>
    );
}
