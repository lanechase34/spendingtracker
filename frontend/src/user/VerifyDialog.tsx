import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ErrorAlert from 'components/ErrorAlert';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import useCooldownAction from 'hooks/useCooldownAction';
import useFormField from 'hooks/useFormField';
import usePendingFetch from 'hooks/usePendingFetch';
import React, { useEffect, useMemo, useState } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { parseApiValidationError } from 'utils/parseApiValidationError';
import { formatSecondsToTime } from 'utils/timeFormatter';

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
     * State for when user is allowed to resend a verification code
     */
    const [resendAlert, setResendAlert] = useState<string | null>(null);

    /**
     * If verify dialog open and pending token gets set to null (invalid state),
     * force close the verify dialog and logout
     */
    useEffect(() => {
        if (verifyDialogOpen && pendingToken == null) {
            // Reset modal state
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setResendAlert(null);
            setError(null);
            logout();
            closeVerifyDialog();
        }
    }, [pendingToken, verifyDialogOpen, closeVerifyDialog, logout]);

    const {
        execute: executeResend,
        loading: resendLoading,
        isCooldownActive,
        remainingSeconds,
    } = useCooldownAction<void>({
        cooldownMs: COOLDOWN_MS,
        storageKey: 'verificationResendCooldownUntil',
        setInitialCooldown: true,
    });

    /**
     * Handles resend verification code when users requests it
     */
    const handleResend = async () => {
        setError(null);
        try {
            await executeResend(async () => {
                await userAPI.resendVerificationCode();
                setResendAlert('Success! Please check your email for a new verification code.');
            });
        } catch (err: unknown) {
            if (err instanceof APIError && err.statusCode === 429) {
                setError(parseApiValidationError(err.message));
            } else {
                setError(['Server error. Please try again.']);
            }
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
    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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

                        <Alert severity="info" icon={<InfoOutlinedIcon fontSize="small" />}>
                            <Box>
                                Check your email for a verification code and enter it below. You may need to check your
                                'Spam' and 'Junk' folders and trust senders from '<b>@chaselane.dev</b>'
                            </Box>

                            <Box sx={{ mt: 2 }}>
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
