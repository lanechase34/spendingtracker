import { Client, IFrame, IMessage } from '@stomp/stompjs';
import type { Metric } from 'types/MetricResponse.type';
import { MetricResponseSchema } from 'types/MetricResponse.type';

interface CreateMetricsClientArgs {
    brokerURL: string;
    token: string;
    onMetrics: (data: Metric) => void;
    onError?: (err: unknown) => void;
}

/**
 * Creates the STOMP JS websocket client connection
 * @param brokerURL - websocket url to connect to
 * @param token - users JWT
 * @param onMetrics - function to handle metrics returned
 * @param onError - function to handle error (optional)
 * @returns Client instance
 */
export function createMetricsClient({ brokerURL, token, onMetrics, onError }: CreateMetricsClientArgs): Client {
    const client = new Client({
        brokerURL,
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        connectionTimeout: 5000,
        connectHeaders: {
            login: token,
        },
    });

    client.onConnect = () => {
        client.subscribe('metrics', (message: IMessage) => {
            try {
                // Validate response
                const json: unknown = JSON.parse(message.body);
                const parsed = MetricResponseSchema.safeParse(json);

                if (!parsed.success) {
                    throw new Error('Metric validation failed');
                }

                const result = parsed.data;

                // Check errors
                if (result.error) {
                    throw new Error('Metric error');
                }

                onMetrics(result.data);
            } catch (err) {
                onError?.(err);
            }
        });
    };

    client.onStompError = (frame: IFrame) => {
        onError?.(new Error(frame.headers.message || 'STOMP broker error'));
    };

    client.onWebSocketClose = () => {
        onError?.(new Error('WebSocket closed'));
    };

    client.onWebSocketError = (event) => {
        onError?.(new Error(`WebSocket error: ${event}`));
    };

    client.onUnhandledMessage = (message) => {
        onError?.(new Error(`Unhandled message: ${message.body}`));
    };

    client.onDisconnect = () => {
        onError?.(new Error('Client disconnected'));
    };

    return client;
}
