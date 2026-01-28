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
    setupFilesAfterEnv: [],
};
