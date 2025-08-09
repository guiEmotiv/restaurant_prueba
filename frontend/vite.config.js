import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    open: true
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
