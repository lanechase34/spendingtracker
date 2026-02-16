import { Client, IFrame, IMessage } from '@stomp/stompjs';
import { createMetricsClient } from 'sockets/createMetricsClient';
import type { Metric } from 'types/MetricResponse.type';
import { MetricResponseSchema } from 'types/MetricResponse.type';

// Mock STOMP JS client
jest.mock('@stomp/stompjs', () => ({
    Client: jest.fn().mockImplementation(() => ({
        subscribe: jest.fn(),
        activate: jest.fn(),
        deactivate: jest.fn(),
    })),
}));

// Mock the MetricResponseSchema
jest.mock('types/MetricResponse.type', () => ({
    MetricResponseSchema: {
        safeParse: jest.fn(),
    },
}));

describe('createMetricsClient', () => {
    const defaultArgs = {
        brokerURL: 'ws://localhost:8080',
        token: 'test-jwt-token',
        onMetrics: jest.fn(),
        onError: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Should create a Client with correct configuration', () => {
        createMetricsClient(defaultArgs);

        expect(Client).toHaveBeenCalledWith({
            brokerURL: 'ws://localhost:8080',
            reconnectDelay: 5000,
            heartbeatIncoming: 10000,
            heartbeatOutgoing: 10000,
            connectionTimeout: 5000,
            connectHeaders: {
                login: 'test-jwt-token',
            },
        });
    });

    it('Subscribes to metrics on connect', () => {
        const onMetrics = jest.fn();
        const subscribeMock = jest.fn();

        const client = createMetricsClient({ ...defaultArgs, onMetrics });

        // Mock subscribe function
        client.subscribe = subscribeMock;

        // Simulate STOMP connect
        client.onConnect({} as IFrame);

        expect(subscribeMock).toHaveBeenCalledWith('metrics', expect.any(Function));
    });

    it('Calls onMetrics for valid message', () => {
        const mockMetricResponse: Metric = {
            cpu: { cores: 4, processPercent: 10, systemPercent: 20 },
            memory: { totalMB: 8000, usedMB: 4000, maxMB: 8000 },
            concurrency: {
                activeRequests: 1,
                maxRequests: 10,
                slowRequests: [],
            },
        };

        const mockResponse = {
            error: false,
            data: mockMetricResponse,
        };

        // eslint-disable-next-line @typescript-eslint/unbound-method
        const mockSafeParse = MetricResponseSchema.safeParse as jest.Mock;
        mockSafeParse.mockReturnValue({
            success: true,
            data: mockResponse,
        });

        const onMetrics = jest.fn();
        const client = createMetricsClient({ ...defaultArgs, onMetrics });

        // Mock subscribe and capture the callback
        type SubscribeCallback = (message: IMessage) => void;
        let subscribeCallback: SubscribeCallback | undefined;
        const subscribeMock = jest.fn((_destination: string, callback: SubscribeCallback) => {
            subscribeCallback = callback;
            return { id: 'test-subscription', unsubscribe: jest.fn() };
        });

        client.subscribe = subscribeMock;

        // Trigger connect
        client.onConnect({} as IFrame);

        // Verify subscribe was called
        expect(subscribeMock).toHaveBeenCalledWith('metrics', expect.any(Function));

        // Create mock message
        const mockMessage: IMessage = {
            body: JSON.stringify(mockResponse),
            headers: {},
            ack: jest.fn(),
            nack: jest.fn(),
            command: 'MESSAGE',
            isBinaryBody: false,
            binaryBody: new Uint8Array(),
        };

        // Trigger the callback
        expect(subscribeCallback).toBeDefined();
        subscribeCallback?.(mockMessage);

        // Verify the flow
        expect(mockSafeParse).toHaveBeenCalledWith(mockResponse);
        expect(onMetrics).toHaveBeenCalledTimes(1);
        // Only the result.data will be stored in state
        expect(onMetrics).toHaveBeenCalledWith(mockMetricResponse);
    });

    it('Should call onError when JSON parsing fails', () => {
        const onError = jest.fn();

        const client = createMetricsClient({ ...defaultArgs, onError });

        // Mock subscribe and capture the callback
        type SubscribeCallback = (message: IMessage) => void;
        let subscribeCallback: SubscribeCallback | undefined;
        const subscribeMock = jest.fn((_destination: string, callback: SubscribeCallback) => {
            subscribeCallback = callback;
            return { id: 'test-subscription', unsubscribe: jest.fn() };
        });

        client.subscribe = subscribeMock;

        // Trigger connect
        client.onConnect({} as IFrame);

        // Invalid JSON
        const mockMessage: IMessage = {
            body: 'invalid json{',
        } as IMessage;

        // Trigger the callback
        expect(subscribeCallback).toBeDefined();
        subscribeCallback?.(mockMessage);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('Calls onError for invalid message', () => {
        const onError = jest.fn();
        const onMetrics = jest.fn();

        const client = createMetricsClient({ ...defaultArgs, onMetrics, onError });

        // Mock subscribe and capture callback
        type SubscribeCallback = (message: IMessage) => void;
        let subscribeCallback: SubscribeCallback | undefined;

        client.subscribe = jest.fn((_, callback: SubscribeCallback) => {
            subscribeCallback = callback;
            return { id: 'test', unsubscribe: jest.fn() };
        });

        client.onConnect({} as IFrame);

        // Mock failed validation
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const mockSafeParse = MetricResponseSchema.safeParse as jest.Mock;
        mockSafeParse.mockReturnValue({
            success: false,
            error: { issues: [] },
        });

        const mockMessage: IMessage = {
            body: JSON.stringify({ invalid: 'data' }),
            headers: {},
            ack: jest.fn(),
            nack: jest.fn(),
            command: 'MESSAGE',
            isBinaryBody: false,
            binaryBody: new Uint8Array(),
        };

        subscribeCallback?.(mockMessage);

        expect(onMetrics).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('Calls onError when message contains error flag', () => {
        const onError = jest.fn();
        const onMetrics = jest.fn();

        const client = createMetricsClient({ ...defaultArgs, onMetrics, onError });

        type SubscribeCallback = (message: IMessage) => void;
        let subscribeCallback: SubscribeCallback | undefined;

        client.subscribe = jest.fn((_, callback: SubscribeCallback) => {
            subscribeCallback = callback;
            return { id: 'test', unsubscribe: jest.fn() };
        });

        client.onConnect({} as IFrame);

        // Mock successful parse but with error flag
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const mockSafeParse = MetricResponseSchema.safeParse as jest.Mock;
        mockSafeParse.mockReturnValue({
            success: true,
            data: { error: true },
        });

        const mockMessage: IMessage = {
            body: JSON.stringify({ error: true }),
            headers: {},
            ack: jest.fn(),
            nack: jest.fn(),
            command: 'MESSAGE',
            isBinaryBody: false,
            binaryBody: new Uint8Array(),
        };

        subscribeCallback?.(mockMessage);

        expect(onMetrics).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Metric error',
            })
        );
    });

    describe('onStompError handler', () => {
        it('Should call onError with error message from frame headers', () => {
            const onError = jest.fn();
            const client = createMetricsClient({ ...defaultArgs, onError: onError });

            const mockFrame: IFrame = {
                command: 'ERROR',
                headers: {
                    message: 'Authentication failed',
                },
                body: '',
                isBinaryBody: false,
                binaryBody: new Uint8Array(),
            };

            client.onStompError(mockFrame);
            expect(onError).toHaveBeenCalledWith(new Error('Authentication failed'));
        });

        it('Should call onError with default message when no message in headers', () => {
            const onError = jest.fn();
            const client = createMetricsClient({ ...defaultArgs, onError: onError });

            const mockFrame: IFrame = {
                command: 'ERROR',
                headers: {},
                body: '',
                isBinaryBody: false,
                binaryBody: new Uint8Array(),
            };

            client.onStompError(mockFrame);
            expect(onError).toHaveBeenCalledWith(new Error('STOMP broker error'));
        });

        it('Should not throw when onError is not provided', () => {
            const client = createMetricsClient({
                brokerURL: 'ws://localhost:8080',
                token: 'test-jwt-token',
                onMetrics: jest.fn(),
            });

            const mockFrame: IFrame = {
                command: 'ERROR',
                headers: {},
                body: '',
                isBinaryBody: false,
                binaryBody: new Uint8Array(),
            };

            expect(() => client.onStompError(mockFrame)).not.toThrow();
        });
    });

    describe('onWebSocketClose handler', () => {
        it('Should call onError when WebSocket closes', () => {
            const onError = jest.fn();
            const client = createMetricsClient({ ...defaultArgs, onError: onError });

            client.onWebSocketClose({} as CloseEvent);
            expect(onError).toHaveBeenCalledWith(new Error('WebSocket closed'));
        });

        it('Should not throw when onError is not provided', () => {
            const client = createMetricsClient({
                brokerURL: 'ws://localhost:8080',
                token: 'test-jwt-token',
                onMetrics: jest.fn(),
            });

            expect(() => client.onWebSocketClose({} as CloseEvent)).not.toThrow();
        });
    });

    it('Should handle different broker URLs', () => {
        const args = {
            ...defaultArgs,
            brokerURL: 'wss://production.example.com:443/ws',
        };

        createMetricsClient(args);
        expect(Client).toHaveBeenCalledWith(
            expect.objectContaining({
                brokerURL: args.brokerURL,
            })
        );
    });
});
