import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // 큰 라이브러리를 따로 묶어 캐시 효율 ↑ — ?niro=1 화면은 three.js 를 내려받지 않음
        manualChunks(id) {
          // Vite/Rollup 공용 도우미는 core 로 (3D 묶음에 섞이면 ?niro=1 화면도 three.js 를 받게 됨)
          if (id.includes('preload-helper') || id.includes('commonjsHelpers') || id.includes('modulepreload-polyfill')) return 'core'
          if (!id.includes('node_modules')) return
          if (/[\\/](react|react-dom|scheduler|use-sync-external-store|zustand)[\\/]/.test(id)) return 'core'
          if (id.includes('firebase')) return 'firebase'
          if (/[\\/]three[\\/]/.test(id) || id.includes('three-stdlib') || id.includes('troika')) return 'three'
          return 'r3f' // @react-three/* 와 그 의존성
        },
      },
    },
  },
})
