import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
    build: {
        outDir: 'build',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes('node_modules')) {
                        if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom'))
                            return 'vendor-react';
                        if (id.includes('@mui/material') || id.includes('@mui/icons-material')) return 'vendor-mui';
                        if (id.includes('@mui/x-data-grid')) return 'vendor-mui-x';
                        if (id.includes('@mui/x-date-pickers') || id.includes('dayjs')) return 'vendor-date-pickers';
                        if (id.includes('@tanstack/react-query')) return 'vendor-query';
                    }
                },
            },
        },
    },
    resolve: {
        tsconfigPaths: true,
    },
    base: '/spendingtracker',
    plugins: [
        react(),
        tsconfigPaths(),
        visualizer({
            filename: 'bundle-stats.json',
            json: true,
        }),
        visualizer({
            open: true,
        }),
        {
            name: 'html-inject-env',
            transformIndexHtml(html) {
                const base = 'SpendingTracker';
                const title = mode === 'production' ? base : `[DEV] ${base}`;
                return html.replace('%APP_TITLE%', title);
            },
        },
    ],
    server: {
        host: '0.0.0.0',
        port: 3000,
        open: false,
        watch: {
            usePolling: true,
            interval: 1000,
        },
        proxy: {
            '/spendingtracker/api/v1': {
                target: process.env.VITE_API_TARGET || 'http://localhost:8082',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/spendingtracker\/api\/v1/, '/api/v1'),
            },
        },
    },
}));
