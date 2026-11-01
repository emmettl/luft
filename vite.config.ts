import { execFileSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({define:{__EDITION_BUILD__:JSON.stringify(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()+(execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()?'-dirty':''))},base:'/luft/',plugins:[react()],optimizeDeps:{include:['three','@motionstudies/three/render-performance']}})
