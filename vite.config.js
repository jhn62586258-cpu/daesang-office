import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // 큰 라이브러리를 따로 묶어 캐시 효율 ↑
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          firebase: ['firebase/app', 'firebase/database', 'firebase/auth'],
        },
      },
    },
  },
})
