import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import ErrorAlert from 'components/ErrorAlert';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import useFormField from 'hooks/useFormField';
import type { FormEvent } from 'react';
import { useMemo,useState } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { parseApiValidationError } from 'utils/parseApiValidationError';
import { validateEmail } from 'validators/validateEmail';
import { validatePassword } from 'validators/validatePassword';

/**
 * Login form inside dialog
 */
export default function LoginDialog() {
    const { loginDialogOpen, closeLoginDialog, openVerifyDialog } = useAuthDialogContext();

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string[] | null>(null);
    const [rememberMe, setRememberMe] = useState<boolean>(false);

    const { login: setToken, setPendingToken } = useAuthContext();
    const userAPI = useMemo(() => userService({}), []);

    const handleClose = (_event: object, reason: string) => {
        if (loading || reason === 'backdropClick') return;
        closeLoginDialog();
    };

    const handleExited = () => {
        // Reset fields when modal finishes closing
        emailField.reset();
        passwordField.reset();
        setRememberMe(false);
        setError(null);
        setLoading(false);
    };

    const emailField = useFormField({
        initialValue: '',
        validator: validateEmail,
    });

    const passwordField = useFormField({
        initialValue: '',
        validator: validatePassword,
    });

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;
        setLoading(true);

        // Final validation
        const newErrors = {
            email: emailField.validateField(),
            password: passwordField.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some((err) => err && err !== null && err !== '');
        if (hasErrors) {
            setLoading(false);
            return;
        }

        // Build the form data packet
        const formData = new FormData();
        formData.append('email', emailField.value);
        formData.append('password', passwordField.value);
        formData.append('rememberMe', rememberMe.toString());

        try {
            const token = await userAPI.login(formData);
            // Set the JWT
            await setToken(token);
            closeLoginDialog();
        } catch (err: unknown) {
            if (err instanceof APIError) {
                if (err.statusCode == 403) {
                    openVerifyDialog(); // Show the verify dialog
                    setPendingToken(err.data); // set the pending user JWT
                    closeLoginDialog();
                } else {
                    setError(parseApiValidationError(err.message));
                    setLoading(false);
                }
            } else {
                console.error('Network error:', err);
                setError(['Invalid login. Please try again.']);
                setLoading(false);
            }
        }
    };

    return (
        <>
            <Dialog
                open={loginDialogOpen}
                onClose={handleClose}
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
                    Login
                    <IconButton disabled={loading} aria-label="close" onClick={() => handleClose({}, 'button')}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Box
                        component="form"
                        id="loginForm"
                        onSubmit={(event) => void handleSubmit(event)}
                        sx={{}}
                        noValidate
                    >
                        <Stack spacing={3} sx={{ width: '100%' }}>
                            {error && <ErrorAlert messages={error} onClose={() => setError(null)} />}

                            <TextField
                                required
                                id="inputEmailLogin"
                                label="Email"
                                name="email"
                                value={emailField.value}
                                onChange={emailField.handleChange}
                                onBlur={emailField.handleBlur}
                                error={!!emailField.error}
                                helperText={emailField.error}
                            />

                            <TextField
                                required
                                id="inputPasswordLogin"
                                label="Password"
                                name="password"
                                type="password"
                                value={passwordField.value}
                                onChange={passwordField.handleChange}
                                onBlur={passwordField.handleBlur}
                                error={!!passwordField.error}
                                helperText={passwordField.error}
                            />

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        name="rememberMe"
                                        color="primary"
                                        sx={{ pl: 0 }}
                                    />
                                }
                                label="Remember me"
                                sx={{ m: 0, p: 0 }}
                            />
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    {import.meta.env.DEV && (
                        <Button
                            variant="outlined"
                            color="secondary"
                            disabled={loading}
                            onClick={() => {
                                emailField.setValue('test1@gmail.com');
                                passwordField.setValue('asdfasdfasfsdf');
                            }}
                        >
                            Dev Login
                        </Button>
                    )}
                    <Button loading={loading} loadingPosition="start" variant="outlined" type="submit" form="loginForm">
                        Log In
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
