import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Plugin to inject build time
const injectBuildTime = () => {
  return {
    name: 'inject-build-time',
    transformIndexHtml(html) {
      return html.replace('BUILDTIME_PLACEHOLDER', new Date().toISOString());
    }
  };
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Cargar variables desde la raíz del proyecto
  const env = loadEnv(mode, resolve(__dirname, '..'), '');

  // Determinar la IP del backend dinámicamente
  const backendHost = env.LOCAL_IP || 'localhost';
  const backendTarget = `http://${backendHost}:8000`;

  console.log(`🌐 Vite Proxy Configuration:`);
  console.log(`   Backend Target: ${backendTarget}`);
  console.log(`   Frontend Host: :: (all interfaces)`);

  return {
  plugins: [react(), injectBuildTime()],
  envDir: resolve(__dirname, '..'), // Buscar .env en la raíz
  envPrefix: ['VITE_'], // Solo cargar variables que empiecen con VITE_
  server: {
    port: 5173,
    strictPort: true,
    host: '::', // Listen on all interfaces (IPv6 + IPv4)
    open: false, // Don't auto-open browser
    cors: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  preview: {
    port: 5173,
    strictPort: true
  },
  build: {
    minify: 'esbuild', // Enable minification for smaller bundle
    sourcemap: false, // Disable sourcemaps in production to save memory
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Force new filenames to break cache
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`,
        manualChunks: {
          // Split vendor chunks to reduce memory usage during build
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-aws': ['aws-amplify', '@aws-amplify/ui-react']
        }
      }
    }
  }
  } // Cerrar return
}) // Cerrar defineConfig
