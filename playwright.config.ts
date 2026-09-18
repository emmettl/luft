import {defineConfig,devices} from '@playwright/test'
const port=process.env.LUFT_TEST_PORT??'4188'
export default defineConfig({testDir:'./tests',timeout:60000,expect:{timeout:15000},workers:2,use:{baseURL:`http://127.0.0.1:${port}/luft/`},webServer:{command:`npm run dev -- --port ${port}`,url:`http://127.0.0.1:${port}/luft/`,reuseExistingServer:!process.env.CI,timeout:180000},projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}},{name:'webkit-phone',use:{...devices['iPhone 13']}}]})
