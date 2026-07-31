import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Mismo valor por defecto que wrangler.toml [vars] GOOGLE_CLIENT_ID (público). */
const DEFAULT_GOOGLE_CLIENT_ID =
  '365692313483-g4tv5i5agl4egs67h980vn6ce977p7df.apps.googleusercontent.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const googleClientId = env.VITE_GOOGLE_CLIENT_ID || DEFAULT_GOOGLE_CLIENT_ID;
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react')) {
              return 'vendor-react';
            }
          },
        },
      },
    },
  };
});
