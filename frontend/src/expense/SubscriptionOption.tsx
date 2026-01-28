import type { ChangeEvent } from 'react';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormHelperText from '@mui/material/FormHelperText';

interface SubscriptionOptionProps {
    isSubscription: boolean;
    handleIsSubscriptionChange: (event: ChangeEvent<HTMLInputElement>, checked: boolean) => void;
    subscriptionInterval: string | null;
    handleSubscriptionIntervalChange: (event: ChangeEvent<HTMLInputElement>, value: string) => void;
    error?: boolean;
    helperText: string | null;
}

export default function SubscriptionOption({
    isSubscription,
    handleIsSubscriptionChange,
    subscriptionInterval,
    handleSubscriptionIntervalChange,
    error,
    helperText,
}: SubscriptionOptionProps) {
    return (
        <>
            <FormControl component="fieldset" variant="outlined" error={error}>
                <FormControlLabel
                    value="subscription"
                    control={<Checkbox checked={isSubscription} onChange={handleIsSubscriptionChange} />}
                    label="Subscription"
                    labelPlacement="end"
                />
                {isSubscription && (
                    <FormControl>
                        <RadioGroup
                            row
                            aria-labelledby="subscription-interval-label"
                            name="interval"
                            value={subscriptionInterval}
                            onChange={handleSubscriptionIntervalChange}
                        >
                            <FormControlLabel value="Y" control={<Radio />} label="Yearly" />
                            <FormControlLabel value="M" control={<Radio />} label="Monthly" />
                        </RadioGroup>
                    </FormControl>
                )}
                {error && <FormHelperText>{helperText}</FormHelperText>}
            </FormControl>
        </>
    );
}
