import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';

interface ConfirmDialogProps {
    open: boolean;
    message: string;
    handleConfirm: () => void;
    handleClose: () => void;
    confirmed: boolean;
}

/**
 * Shows a dialog asking the user to confirm their choice
 * On confirmation, will run handleConfirm()
 */
export default function ConfirmDialog({ open, message, handleConfirm, handleClose, confirmed }: ConfirmDialogProps) {
    return (
        <Dialog open={open} fullWidth={true} maxWidth={'sm'} disableEscapeKeyDown={true} data-testid="confirm-dialog">
            <Divider />
            <DialogContent>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {message}
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 1 }}>
                <Button disabled={confirmed} aria-label="cancel" variant="outlined" color="error" onClick={handleClose}>
                    Cancel
                </Button>
                <Button
                    loading={confirmed}
                    aria-label="confirm"
                    variant="outlined"
                    color="success"
                    onClick={handleConfirm}
                >
                    Confirm
                </Button>
            </DialogActions>
        </Dialog>
    );
}
