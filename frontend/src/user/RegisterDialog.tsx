import CloseIcon from '@mui/icons-material/Close';
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
import ErrorAlert from 'components/ErrorAlert';
import useAuthContext from 'hooks/useAuthContext';
import useAuthDialogContext from 'hooks/useAuthDialogContext';
import useFormField from 'hooks/useFormField';
import useToastContext from 'hooks/useToastContext';
import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { userService } from 'schema/user';
import { APIError } from 'utils/apiError';
import { parseApiValidationError } from 'utils/parseApiValidationError';
import { validateEmail } from 'validators/validateEmail';
import { validateMoney } from 'validators/validateMoney';
import { validatePassword } from 'validators/validatePassword';

/**
 * Registration form inside dialog
 */
export default function RegisterDialog() {
    const { registerDialogOpen, closeRegisterDialog, openVerifyDialog } = useAuthDialogContext();
    const { setPendingToken } = useAuthContext();

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string[] | null>(null);

    const { showToast } = useToastContext();
    const userAPI = useMemo(() => userService({}), []);

    const handleClose = (_event: object, reason: string) => {
        if (loading || reason === 'backdropClick') return;
        closeRegisterDialog();
    };

    const handleExited = () => {
        // Reset fields when modal finishes closing
        emailField.reset();
        passwordField.reset();
        salaryField.reset();
        monthlyTakeHomeField.reset();
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

    const salaryField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    const monthlyTakeHomeField = useFormField({
        initialValue: '',
        validator: validateMoney,
    });

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (loading) return;
        setLoading(true);

        // Final validation
        const newErrors = {
            email: emailField.validateField(),
            password: passwordField.validateField(),
            salary: salaryField.validateField(),
            monthlyTakeHome: monthlyTakeHomeField.validateField(),
        };

        // Don't submit if error(s) exist
        const hasErrors = Object.values(newErrors).some((err) => err && err !== null && err !== '');
        if (hasErrors) {
            setLoading(false);
            return;
        }

        try {
            const token = await userAPI.register({
                email: emailField.value,
                password: passwordField.value,
                salary: salaryField.value,
                monthlyTakeHome: monthlyTakeHomeField.value,
            });

            showToast('Successfully registered! Please check your email for verification', 'success');
            openVerifyDialog(); // Show the verify dialog
            setPendingToken(token); // set the pending user JWT
            closeRegisterDialog();
        } catch (err: unknown) {
            console.error('Network error:', err);
            if (err instanceof APIError) {
                setError(parseApiValidationError(err.message));
            } else {
                setError(['Server Error. Please try again.']);
            }
            setLoading(false);
        }
    };

    return (
        <>
            <Dialog
                open={registerDialogOpen}
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
                    Register
                    <IconButton disabled={loading} aria-label="close" onClick={() => handleClose({}, 'button')}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <Divider />
                <DialogContent>
                    <Box
                        component="form"
                        id="registrationForm"
                        onSubmit={(event) => void handleSubmit(event)}
                        sx={{}}
                        noValidate
                    >
                        <Stack spacing={3} sx={{ width: '100%' }}>
                            {error && <ErrorAlert messages={error} onClose={() => setError(null)} />}

                            <FormControl>
                                <TextField
                                    required
                                    id="inputEmailRegister"
                                    label="Email"
                                    name="email"
                                    value={emailField.value}
                                    onChange={emailField.handleChange}
                                    onBlur={emailField.handleBlur}
                                    error={!!emailField.error}
                                    helperText={emailField.error}
                                />
                            </FormControl>

                            <FormControl>
                                <TextField
                                    required
                                    id="inputPasswordRegister"
                                    label="Password"
                                    name="password"
                                    type="password"
                                    value={passwordField.value}
                                    onChange={passwordField.handleChange}
                                    onBlur={passwordField.handleBlur}
                                    error={!!passwordField.error}
                                    helperText={passwordField.error}
                                />
                            </FormControl>

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
                    <Button
                        loading={loading}
                        loadingPosition="start"
                        variant="outlined"
                        type="submit"
                        form="registrationForm"
                    >
                        Register
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
