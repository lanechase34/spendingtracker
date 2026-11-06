import os from 'node:os';
import process from 'node:process';

import { defineConfig, devices, type Project } from '@playwright/test';

const isWindows = process.platform === 'win32';
const isCI = Boolean(process.env['CI']);

function workerCount(): number {
    const override = process.env['E2E_WORKERS'];
    if (override !== undefined && override !== '') return Number(override);
    if (isCI) return 1;

    const threads = os.availableParallelism();
    return threads >= 12 ? Math.floor(threads / 2) : 2;
}

// Run tests in this order, one browser at a time
const browserProjects: (Omit<Project, 'dependencies'> & { name: string })[] = [
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
        grepInvert: /@desktop/,
    },

    ...(!isWindows
        ? [
              {
                  name: 'Mobile Safari',
                  use: { ...devices['iPhone 12'] },
                  grepInvert: /@desktop/,
              },
          ]
        : []),
];

export default defineConfig({
    testDir: './e2e',
    timeout: 30000,
    expect: {
        timeout: 12000,
    },
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: workerCount(),
    reporter: 'html',
    use: {
        actionTimeout: 0,
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        headless: true,
    },
    // Chain each project onto the previous one so they run sequentially
    projects: browserProjects.map((project, index) => {
        const previous = browserProjects[index - 1];
        return previous ? { ...project, dependencies: [previous.name] } : project;
    }),
});
