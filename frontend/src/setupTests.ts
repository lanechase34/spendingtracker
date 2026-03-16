import { TextDecoder, TextEncoder } from 'util';

jest.mock('utils/constants', () => ({
    API_BASE_URL: '/spendingtracker/api/v1',
    WS_URL: 'ws://localhost:8082/ws',
}));

Object.assign(global, { TextDecoder, TextEncoder });
