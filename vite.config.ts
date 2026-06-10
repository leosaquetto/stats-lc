import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const apiProxyTarget =
    env.STATS_API_PROXY_TARGET ||
    env.VITE_API_BASE_URL ||
    'https://statslc.leosaquetto.com';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react-native': 'react-native-web',
        'react-native-mmkv': path.resolve(__dirname, 'src/lib/mmkv.ts'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'chart-vendor': ['recharts'],
            'ui-vendor': ['framer-motion', 'lucide-react'],
            'virtual-vendor': ['react-window', 'react-virtualized-auto-sizer'],
          },
        },
      },
      chunkSizeWarningLimit: 600,
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        usePolling: true,
        interval: 120,
      },
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: true,
        },
      },
      middlewareMode: false,
      cors: true,
      headers: {
        // Simula cache de produção no localhost
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  };
});
