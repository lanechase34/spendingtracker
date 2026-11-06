import { defineConfig } from '@playwright/test';

import base from './playwright.config';

// The e2e suite against a production build
export default defineConfig({
    ...base,
    use: { ...base.use, baseURL: 'http://localhost:3008' },
    webServer: {
        command: 'npm run build-only && npm run serve -- --port 3008 --strictPort',
        url: 'http://localhost:3008/spendingtracker/',
        reuseExistingServer: false,
        timeout: 180_000,
    },
});
