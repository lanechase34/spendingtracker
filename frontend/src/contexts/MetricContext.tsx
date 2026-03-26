import { Client } from '@stomp/stompjs';
import useAuthContext from 'hooks/useAuthContext';
import type { ReactNode } from 'react';
import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import { createMetricsClient } from 'sockets/createMetricsClient';
import type { Metric } from 'types/MetricResponse.type';
import { WS_URL } from 'utils/constants';

export interface MetricContextType {
    metrics: Metric | null;
}

export const MetricContext = createContext<MetricContextType | undefined>(undefined);

/**
 * Metric context stores information related to metrics for the admin dashboard
 */
export const MetricContextProvider = ({ children }: { children: ReactNode }) => {
    const [metrics, setMetrics] = useState<Metric | null>(null);
    const clientRef = useRef<Client | null>(null);
    const failedRef = useRef<boolean>(false); // track if the client failed to connect
    const { authToken } = useAuthContext();

    useEffect(() => {
        if (!authToken) {
            void clientRef.current?.deactivate();
            clientRef.current = null;
            return;
        }

        if (failedRef.current) {
            return;
        }

        if (clientRef.current) {
            return;
        }

        const client = createMetricsClient({
            brokerURL: WS_URL,
            token: authToken,
            onMetrics: setMetrics,
            onError: (err) => console.error('Metrics socket error', err),
            onFailed: () => {
                failedRef.current = true;
            },
        });

        client.activate();
        clientRef.current = client;

        return () => {
            void clientRef.current?.deactivate();
            clientRef.current = null;
        };
    }, [authToken]);

    /**
     * Memoize the entire context
     */
    const value = useMemo<MetricContextType>(
        () => ({
            metrics: metrics,
        }),
        [metrics]
    );

    return <MetricContext value={value}>{children}</MetricContext>;
};
