import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
    },
    webServer: [
        {
            command: 'npm run testbed:backend',
            url: 'http://localhost:31001/identities/resolve?displayName=x',
            reuseExistingServer: false,
            timeout: 15_000,
            env: { HTTP_ONLY: 'true', PORT: '31001' },
        },
        {
            command: 'npm run testbed:serve',
            url: 'http://localhost:3000',
            reuseExistingServer: false,
            timeout: 15_000,
        },
    ],
});
