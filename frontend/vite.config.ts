import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

const analyze = process.env['npm_lifecycle_event'] === 'analyze';

export default defineConfig({
    build: {
        outDir: 'build',
        chunkSizeWarningLimit: 1000,
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            name: 'vendor-react',
                            test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
                            priority: 20,
                        },
                        {
                            name: 'vendor-mui',
                            test: /node_modules[\\/](@mui[\\/](material|system|utils|styled-engine|private-theming|core-downloads-tracker)|@emotion|@popperjs|react-transition-group|stylis)[\\/]/,
                            priority: 10,
                        },
                    ],
                },
            },
        },
    },
    resolve: {
        tsconfigPaths: true,
    },
    base: '/spendingtracker/',
    plugins: [
        react(),
        analyze && visualizer({ filename: 'bundle-stats.json', json: true }),
        analyze && visualizer({ open: true }),
    ],
    server: {
        host: '0.0.0.0',
        port: 3000,
        open: false,
        watch: {
            usePolling: Boolean(process.env['VITE_POLL']),
            interval: 1000,
            ignored: ['**/test-results/**', '**/playwright-report/**', '**/blob-report/**', '**/coverage/**'],
        },
        proxy: {
            '/spendingtracker/api/v1': {
                target: process.env['VITE_API_TARGET'] ?? 'http://localhost:8082',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/spendingtracker\/api\/v1/, '/api/v1'),
            },
        },
    },
});
