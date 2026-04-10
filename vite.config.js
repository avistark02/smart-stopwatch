import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/process-frame': 'http://localhost:5000',
            '/enroll-photo': 'http://localhost:5000',
            '/status': 'http://localhost:5000',
            '/session-log': 'http://localhost:5000',
            '/authorized-users': 'http://localhost:5000',
            '/select-user': 'http://localhost:5000',
            '/selected-user': 'http://localhost:5000',
            '/remove-user': 'http://localhost:5000',
        },
    },
});
