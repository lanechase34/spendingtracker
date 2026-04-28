import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ErrorAlert from 'components/ErrorAlert';
import useAuthFetch from 'hooks/useAuthFetch';
import useFormField from 'hooks/useFormField';
import useToastContext from 'hooks/useToastContext';
import type { SubmitEvent } from 'react';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { validateTOTPCode } from 'validators/validateTOTP';

type Step = 'loading' | 'setup' | 'recovery';

interface Setup2FADialogProps {
    open: boolean;
    onClose: () => void;
    onEnabled: () => void; // called after successful activation so parent can refresh user state
}

/**
 * Extracts the src attribute from a base64-encoded img tag
 * The API returns a base64 encoded HTML img tag e.g. <img src="data:image/jpg;base64,...">
 */
function extractQRCodeSrc(base64EncodedImgTag: string): string {
    const decoded = atob(base64EncodedImgTag);
    const match = /src="([^"]+)"/.exec(decoded);
    return match?.[1] ?? '';
}

/**
 * Three-step dialog for setting up 2FA:
 * 1. Loading - calls /setup2fa and fetches QR code + secret
 * 2. Setup   - shows QR code and secret, user enters code to confirm
 * 3. Recovery - shows one-time recovery codes, requires acknowledgement before closing
 */
export default function Setup2FADialog({ open, onClose, onEnabled }: Setup2FADialogProps) {
    /**
     * Dialog steps state
     */
    const [step, setStep] = useState<Step>('loading');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string[] | null>(null);
    const [qrCode, setQrCode] = useState<string>('');
    const [secret, setSecret] = useState<string>('');
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
    const [acknowledged, setAcknowledged] = useState<boolean>(false);
    const [copied, setCopied] = useState<boolean>(false);

    const { showToast } = useToastContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch }), [authFetch]);

    /**
     * TOTP field for 6-digit code
     */
    const codeField = useFormField({
        initialValue: '',
        validator: validateTOTPCode,
    });

    const handleExited = () => {
        setStep('loading');
        setError(null);
        setAcknowledged(false);
        setCopied(false);
        codeField.reset();
    };

    const fetchSetup = useEffectEvent(async () => {
        try {
            const result = await userAPI.setup2fa();
            setQrCode(result.qrCode);
            setSecret(result.secret);
            setStep('setup');
        } catch (err) {
            if (err instanceof APIError) {
                setError([err.message]);
            } else {
                setError(['Failed to initiate 2FA setup. Please try again.']);
            }
            setStep('setup');
        }
    });

    /**
     * Fetch QR code and secret when dialog opens
     */
    useEffect(() => {
        if (!open) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchSetup();
    }, [open]);

    /**
     * Submit the auth code generated after entering qr code / secret
     */
    const handleSubmit = async (event: SubmitEvent) => {
        event.preventDefault();
        if (loading) return;

        const codeError = codeField.validateField();
        if (codeError) return;

        setLoading(true);
        setError(null);

        try {
            const result = await userAPI.confirm2fa(codeField.value);
            setRecoveryCodes(result.recoveryCodes);
            setStep('recovery');
        } catch (err) {
            if (err instanceof APIError) {
                setError([err.message]);
            } else {
                setError(['Server error. Please try again.']);
            }
            codeField.reset();
        } finally {
            setLoading(false);
        }
    };

    /**
     * Copy recovery codes to clipboard
     */
    const handleCopyCodes = async () => {
        await navigator.clipboard.writeText(recoveryCodes.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    /**
     * Finish the set up
     */
    const handleFinish = () => {
        onEnabled(); // notify parent to refresh user state
        showToast('Two-factor authentication enabled.', 'success');
        onClose();
    };

    const handleClose = () => {
        if (loading || step === 'recovery') return;
        onClose();
    };

    const title = step === 'recovery' ? 'Save Your Recovery Codes' : 'Set Up Two-Factor Authentication';

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
                {title}
                {step !== 'recovery' && step !== 'loading' && (
                    <IconButton disabled={loading} aria-label="close" onClick={handleClose}>
                        <CloseIcon />
                    </IconButton>
                )}
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Stack spacing={3} sx={{ width: '100%' }}>
                    {error && <ErrorAlert messages={error} onClose={() => setError(null)} />}

                    {/* Step 1: Loading */}
                    {step === 'loading' && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {/* Step 2: Setup */}
                    {step === 'setup' && (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                Scan the QR code below with your authenticator app (Google Authenticator, Authy,
                                1Password, etc.), then enter the 6-digit code to confirm.
                            </Typography>

                            {qrCode && (
                                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                    <img
                                        src={extractQRCodeSrc(qrCode)}
                                        alt="QR code for authenticator app"
                                        width={200}
                                        height={200}
                                        style={{ borderRadius: 8 }}
                                    />
                                </Box>
                            )}

                            {secret && (
                                <Box>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ mb: 0.5, display: 'block' }}
                                    >
                                        Can't scan? Enter this code manually:
                                    </Typography>
                                    <Box
                                        sx={{
                                            bgcolor: 'action.selected',
                                            borderRadius: 1,
                                            px: 2,
                                            py: 1.5,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                        }}
                                    >
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontFamily: 'monospace',
                                                letterSpacing: 2,
                                                wordBreak: 'break-all',
                                                userSelect: 'all', // lets user triple-click to select all
                                            }}
                                        >
                                            {secret}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            <Box component="form" id="confirm2FAForm" onSubmit={(e) => void handleSubmit(e)} noValidate>
                                <FormControl fullWidth>
                                    <TextField
                                        required
                                        id="input2FAConfirmCode"
                                        label="6-Digit Code"
                                        name="code"
                                        autoComplete="one-time-code"
                                        slotProps={{ htmlInput: { maxLength: 6 } }}
                                        value={codeField.value}
                                        onChange={codeField.handleChange}
                                        onBlur={codeField.handleBlur}
                                        error={!!codeField.error}
                                        helperText={codeField.error ?? ' '}
                                        disabled={loading}
                                    />
                                </FormControl>
                            </Box>
                        </>
                    )}

                    {/* Step 3: Recovery codes */}
                    {step === 'recovery' && (
                        <>
                            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                Save these recovery codes somewhere safe. Each code can only be used once. If you lose
                                access to your authenticator app, these are your only way back in.{' '}
                                <strong>They will not be shown again.</strong>
                            </Typography>

                            <Box
                                sx={{
                                    bgcolor: 'action.hover',
                                    borderRadius: 1,
                                    p: 2,
                                    fontFamily: 'monospace',
                                    fontSize: '0.875rem',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: 1,
                                }}
                            >
                                {recoveryCodes.map((code) => (
                                    <Typography key={code} variant="body2" sx={{ fontFamily: 'monospace' }}>
                                        {code}
                                    </Typography>
                                ))}
                            </Box>

                            <Tooltip title={copied ? 'Copied!' : 'Copy all codes'}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={copied ? <CheckCircleIcon /> : undefined}
                                    onClick={() => void handleCopyCodes()}
                                    sx={{ alignSelf: 'flex-start' }}
                                >
                                    {copied ? 'Copied!' : 'Copy codes'}
                                </Button>
                            </Tooltip>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={acknowledged}
                                        onChange={(e) => setAcknowledged(e.target.checked)}
                                        color="primary"
                                        sx={{ pl: 0 }}
                                    />
                                }
                                label="I have saved my recovery codes in a safe place."
                            />
                        </>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 1 }}>
                {step === 'setup' && (
                    <>
                        <Button disabled={loading} variant="outlined" onClick={handleClose}>
                            Cancel
                        </Button>
                        <Button
                            loading={loading}
                            loadingPosition="start"
                            variant="outlined"
                            type="submit"
                            form="confirm2FAForm"
                        >
                            Verify & Enable
                        </Button>
                    </>
                )}
                {step === 'recovery' && (
                    <Button variant="outlined" disabled={!acknowledged} onClick={handleFinish}>
                        Done
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}
