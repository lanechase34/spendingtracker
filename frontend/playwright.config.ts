import process from 'node:process';

import { defineConfig, devices, type Project } from '@playwright/test';

const isWindows = process.platform === 'win32';
const isCI = Boolean(process.env['CI']);

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
    },

    ...(!isWindows
        ? [
              {
                  name: 'Mobile Safari',
                  use: { ...devices['iPhone 12'] },
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
    workers: isCI ? 1 : 2,
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
