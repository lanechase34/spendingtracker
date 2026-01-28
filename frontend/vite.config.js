import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
    build: {
        outDir: 'build',
    },
    base: '/spendingtracker',
    plugins: [react(), tsconfigPaths(), visualizer({ open: true })],
    server: {
        port: 3000,
        open: false,
        proxy: {
            '/spendingtracker/api/v1': {
                target: 'http://localhost:8082',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/spendingtracker\/api\/v1/, '/api/v1'),
            },
        },
    },
});
