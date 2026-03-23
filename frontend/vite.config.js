import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => ({
    build: {
        outDir: 'build',
        chunkSizeWarningLimit: 1000,
    },
    base: '/spendingtracker',
    plugins: [
        react(),
        tsconfigPaths(),
        visualizer({ open: true }),
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
