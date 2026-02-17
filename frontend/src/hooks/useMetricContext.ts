import { MetricContext } from 'contexts/MetricContext';
import { useContext } from 'react';

/**
 * Wrapper for the Metric context.
 */
export default function useMetricContext() {
    const context = useContext(MetricContext);
    if (!context) {
        throw new Error('useMetricContext must be used within a MetricContextProvider');
    }
    return context;
}
