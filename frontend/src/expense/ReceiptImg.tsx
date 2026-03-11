import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import useFetchImage from 'hooks/useFetchImage';
import { useEffect } from 'react';

interface ReceiptImgProps {
    /**
     * Descriptive text used as the image `alt` attribute.
     */
    alt: string;
    /**
     * The authenticated API URL to fetch the receipt image from.
     */
    url: string;
}

/**
 * Displays a receipt image fetched from a secured API endpoint.
 *
 * Behaviour
 * - On mount (or when `url` changes), fetches the image via {useFetchImage}.
 * - While the image is loading, renders a {CircularProgress} spinner.
 * - If the fetch fails, renders an error message in place of the image.
 * - On success, renders the image constrained to a max height of 400px
 *   with `objectFit: contain` to preserve aspect ratio.
 */
export default function ReceiptImg({ alt, url }: ReceiptImgProps) {
    const { error, loading, imageSrc, fetchImage } = useFetchImage({ url });

    /**
     * Triggers an image fetch whenever `url` changes.
     * Skipped if `url` is empty to avoid unnecessary requests
     * when the component mounts without a valid URL.
     */
    useEffect(() => {
        if (url) void fetchImage();
    }, [url, fetchImage]);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: 400 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center">
                <Typography variant="body2" color="error">
                    Failed to load receipt.
                </Typography>
            </Box>
        );
    }

    return (
        <Box display="flex" justifyContent="center">
            <img
                style={{ display: 'block', maxHeight: 400, objectFit: 'contain', borderRadius: 8 }}
                src={imageSrc}
                alt={`${alt} receipt`}
            />
        </Box>
    );
}
