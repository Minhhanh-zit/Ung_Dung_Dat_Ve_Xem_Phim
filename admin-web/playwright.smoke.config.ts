import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e-smoke',
  fullyParallel:false,
  workers:1,
  timeout:30000,
  reporter:[['list'],['html',{outputFolder:'playwright-report-smoke',open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5173',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{
    command:'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url:'http://127.0.0.1:5173/login',
    reuseExistingServer:!process.env.CI,
    timeout:90000,
  },
});
