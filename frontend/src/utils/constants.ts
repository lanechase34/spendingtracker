export const API_BASE_URL = '/spendingtracker/api/v1';

export const WS_URL = import.meta.env.PROD ? 'wss://chaselane.dev/spendingtracker/ws' : 'ws://localhost:8082/ws';

export const IS_DEV = import.meta.env.DEV;

export const BASE_URL = import.meta.env.BASE_URL;
