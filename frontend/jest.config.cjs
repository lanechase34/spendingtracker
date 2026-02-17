module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    preset: 'ts-jest', // Use ts-jest for TypeScript support
    modulePaths: ['<rootDir>/src'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    moduleNameMapper: {
        '\\.(css|less|sass|scss)$': 'identity-obj-proxy', // Handle CSS modules
        '^@test-utils$': '<rootDir>/src/test-utils.tsx',
    },
    setupFiles: ['./src/setupTests.ts'],
    setupFilesAfterEnv: ['@testing-library/jest-dom'],
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/**/*.type.ts',
        '!src/**/__tests__/**',
        '!src/**/*.test.{ts,tsx}',
        '!src/**/*.spec.{ts,tsx}',
        '!src/index.tsx',
        '!src/App.tsx',
        '!src/test-utils.tsx',
        '!src/setupTests.ts',
    ],
    verbose: true,
    maxWorkers: process.env.CI ? 2 : '50%', // max workers for CI
};
