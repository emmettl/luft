import {defineConfig} from 'vitest/config'
export default defineConfig({test:{include:['src/**/*.test.ts'],setupFiles:['./scripts/test-env.ts']}})
