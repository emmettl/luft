import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({base:'/luft/',plugins:[react()],optimizeDeps:{include:['three','@motionstudies/three/render-performance']}})
