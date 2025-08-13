import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
export default defineConfig({
  plugins: [react(), injectBuildTime()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
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
})
