import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ErrorAlert from 'components/ErrorAlert';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import useCooldownAction from 'hooks/useCooldownAction';
import useFormField from 'hooks/useFormField';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type SubmitEvent } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { parseApiValidationError } from 'utils/parseApiValidationError';
import { formatSecondsToTime } from 'utils/timeFormatter';

const COOLDOWN_MS = 10 * 60 * 1000; // 10 Minutes

/**
 * Codes are 8 uppercase characters, strip whitespace (e.g. pasted from the email) and uppercase
 */
const normalizeCode = (value: string) => value.replace(/\s+/g, '').toUpperCase();

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
    const { login: setToken, pendingVerification, setPendingVerification } = useAuthContext();

    /**
     * Verify and resend are unauthenticated - the user's credentials are sent instead of a token
     */
    const userAPI = useMemo(() => userService({}), []);

    /**
     * State for when user is allowed to resend a verification code
     */
    const [resendAlert, setResendAlert] = useState<string | null>(null);

    /**
     * If verify dialog open and pending credentials get set to null (invalid state, ie. logout),
     * force close the verify dialog
     */
    useEffect(() => {
        if (verifyDialogOpen && pendingVerification == null) {
            closeVerifyDialog();
        }
    }, [pendingVerification, verifyDialogOpen, closeVerifyDialog]);

    /**
     * Closing the dialog discards the in-memory credentials
     */
    const handleClose = useCallback(() => {
        if (loading) return;
        setPendingVerification(null);
        closeVerifyDialog();
    }, [loading, setPendingVerification, closeVerifyDialog]);

    const {
        execute: executeResend,
        loading: resendLoading,
        isCooldownActive,
        remainingSeconds,
        startCooldown,
    } = useCooldownAction({
        cooldownMs: COOLDOWN_MS,
        storageKey: 'verificationResendCooldownUntil',
    });

    /**
     * Handles resend verification code when users requests it
     */
    const handleResend = async () => {
        setError(null);
        if (pendingVerification == null) return;
        try {
            await executeResend(async () => {
                await userAPI.resendVerificationCode({
                    email: pendingVerification.email,
                    password: pendingVerification.password,
                });
                setResendAlert('If your account needs verifying, a new code has been sent.');
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
            if (normalizeCode(value).length !== 8) return 'Please enter a valid code.';
            return null;
        },
    });

    const handleExited = useCallback(() => {
        // Reset fields when modal finishes closing
        verificationField.reset();
        setResendAlert(null);
        setError(null);
        setLoading(false);
    }, [verificationField]);

    /**
     * Start the resend cooldown when the dialog opens, but only if a code was just emailed (register)
     * An unverified login sends no email, so the user can resend right away
     */
    const handleEnter = useCallback(() => {
        if (pendingVerification?.codeSent === true) startCooldown();
    }, [pendingVerification, startCooldown]);

    /**
     * Submit the verification code
     */
    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();

        if (loading) return;
        setLoading(true);

        // Final validation
        const newErrors = {
            verificationCode: verificationField.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some(Boolean);
        if (hasErrors || pendingVerification == null) {
            setLoading(false);
            return;
        }

        try {
            // Verify endpoint returns new valid JWT
            const token = await userAPI.verify({
                email: pendingVerification.email,
                password: pendingVerification.password,
                verificationCode: normalizeCode(verificationField.value),
            });
            if (!token) throw new Error('Invalid state');

            setPendingVerification(null); // Credentials are no longer needed
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
                // Dialog is only closable via the close button
                return;
            }}
            fullWidth={true}
            maxWidth={'sm'}
            slotProps={{
                transition: {
                    onEnter: handleEnter,
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
                <IconButton disabled={loading} aria-label="close" onClick={handleClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Box component="form" id="verifyForm" onSubmit={(event) => void handleSubmit(event)} sx={{}} noValidate>
                    <Stack spacing={3} sx={{ width: '100%' }}>
                        {error && (
                            <ErrorAlert
                                messages={error}
                                onClose={() => {
                                    setError(null);
                                }}
                            />
                        )}

                        {resendAlert != null && (
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
                            id="inputVerificationCode"
                            label="Verification Code"
                            name="verificationcode"
                            value={verificationField.value}
                            onChange={verificationField.handleChange}
                            onBlur={verificationField.handleBlur}
                            error={!(verificationField.error == null)}
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
