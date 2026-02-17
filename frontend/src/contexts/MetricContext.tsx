import { Client } from '@stomp/stompjs';
import useAuthContext from 'hooks/useAuthContext';
import type { ReactNode } from 'react';
import { createContext, useEffect, useMemo, useRef,useState } from 'react';
import { createMetricsClient } from 'sockets/createMetricsClient';
import type { Metric } from 'types/MetricResponse.type';

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
    const { authToken } = useAuthContext();

    const BROKER_URL = import.meta.env.PROD ? 'wss://chaselane.dev/spendingtracker/ws' : 'ws://localhost:8082/ws';

    useEffect(() => {
        if (!authToken) {
            void clientRef.current?.deactivate();
            clientRef.current = null;
            return;
        }

        if (clientRef.current) {
            return;
        }

        const client = createMetricsClient({
            brokerURL: BROKER_URL,
            token: authToken,
            onMetrics: setMetrics,
            onError: (err) => console.error('Metrics socket error', err),
        });

        client.activate();
        clientRef.current = client;

        return () => {
            void clientRef.current?.deactivate();
            clientRef.current = null;
        };
    }, [authToken, BROKER_URL]);

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
