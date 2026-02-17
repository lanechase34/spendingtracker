import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import useFetchImage from 'hooks/useFetchImage';
import { useEffect } from 'react';

interface ReceiptDialogProps {
    open: boolean;
    handleClose: () => void;
    title: string; // dialog title
    url: string; // image url
}

export default function ReceiptDialog({ open, handleClose, title, url }: ReceiptDialogProps) {
    const { error, loading, imageSrc, fetchImage } = useFetchImage({ url });

    /**
     * Fetch image when dialog opens or URL changes
     */
    useEffect(() => {
        if (open && url) void fetchImage();
    }, [open, url, fetchImage]);

    return (
        <Dialog
            open={open}
            onClose={(_event: object, reason: string) => {
                if (reason !== 'backdropClick') handleClose();
            }}
            fullWidth={true}
            maxWidth={'sm'}
            disableEscapeKeyDown={true}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                {title}
                <IconButton aria-label="close" onClick={handleClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        height: '100%',
                        minHeight: 200,
                    }}
                >
                    {loading && <CircularProgress />}
                    {!loading && !error && (
                        <img style={{ width: '100%', height: 'auto' }} src={imageSrc} alt={`${title} receipt`} />
                    )}
                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 1 }}>
                <Button variant="outlined" onClick={handleClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
