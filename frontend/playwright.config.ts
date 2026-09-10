import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

const isWindows = process.platform === 'win32';

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    expect: {
        timeout: 12000,
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : 2,
    reporter: 'html',
    use: {
        actionTimeout: 0,
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        headless: true,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
            },
        },
        {
            name: 'firefox',
            use: {
                ...devices['Desktop Firefox'],
                launchOptions: {
                    timeout: 60000,
                },
            },
        },
        ...(!isWindows
            ? [
                  {
                      name: 'webkit',
                      use: { ...devices['Desktop Safari'] },
                  },
              ]
            : []),

        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },

        ...(!isWindows
            ? [
                  {
                      name: 'Mobile Safari',
                      use: { ...devices['iPhone 12'] },
                  },
              ]
            : []),
    ],
});
