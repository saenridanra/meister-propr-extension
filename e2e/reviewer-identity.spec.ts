import { test, expect } from '@playwright/test';

const BACKEND_URL = 'http://localhost:31001';
const CLIENT_KEY  = 'test-client-key';
const CLIENT_ID   = 'e2e-test-client';

test.describe('Reviewer Identity — settings page', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');

        // Fill in core credentials
        await page.fill('#backend-url', BACKEND_URL);
        await page.fill('#client-key',  CLIENT_KEY);
        await page.fill('#client-id',   CLIENT_ID);
    });

    test('reviewer search field is enabled when credentials are filled', async ({ page }) => {
        await expect(page.locator('#reviewer-search')).toBeEnabled();
    });

    test('typing ≥ 2 chars shows dropdown with matching identities', async ({ page }) => {
        await page.fill('#reviewer-search', 'bot');

        // Wait for debounce + network
        await expect(page.locator('#reviewer-dropdown li[data-id]')).toHaveCount(3, { timeout: 5000 });

        const items = page.locator('#reviewer-dropdown li[data-id]');
        await expect(items.nth(0)).toContainText('Bot');
    });

    test('typing 1 char does not open dropdown', async ({ page }) => {
        await page.fill('#reviewer-search', 'b');
        await page.waitForTimeout(400);

        await expect(page.locator('#reviewer-dropdown')).toBeHidden();
    });

    test('typing a non-matching query shows No results found', async ({ page }) => {
        await page.fill('#reviewer-search', 'zzzzzz');
        await expect(page.locator('#reviewer-dropdown .autocomplete-item--no-results')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#reviewer-dropdown .autocomplete-item--no-results')).toHaveText('No results found');
    });

    test('selecting an identity fills the input and saves to backend', async ({ page }) => {
        // Search and select
        await page.fill('#reviewer-search', 'meister');
        await expect(page.locator('#reviewer-dropdown li[data-id]')).toHaveCount(1, { timeout: 5000 });
        await page.locator('#reviewer-dropdown li[data-id]').first().click();

        await expect(page.locator('#reviewer-search')).toHaveValue('Meister Bot');
        await expect(page.locator('#reviewer-dropdown')).toBeHidden();

        // Save
        await page.click('#save-btn');
        await expect(page.locator('#status-message')).toHaveText('Settings saved.', { timeout: 5000 });

        // Verify backend stored the reviewer identity
        const response = await page.request.get(
            `${BACKEND_URL}/clients/${CLIENT_ID}/profile`,
            { headers: { 'X-Client-Key': CLIENT_KEY } }
        );
        expect(response.ok()).toBe(true);
        const profile = await response.json();
        expect(profile.reviewerId).toBe('aaaaaaaa-0001-0001-0001-000000000001');
    });

    test('display name is pre-populated on page reload after save', async ({ page }) => {
        // Search, select, save
        await page.fill('#reviewer-search', 'meister');
        await expect(page.locator('#reviewer-dropdown li[data-id]')).toHaveCount(1, { timeout: 5000 });
        await page.locator('#reviewer-dropdown li[data-id]').first().click();
        await page.click('#save-btn');
        await expect(page.locator('#status-message')).toHaveText('Settings saved.', { timeout: 5000 });

        // Reload and check pre-population
        await page.reload();
        await expect(page.locator('#reviewer-search')).toHaveValue('Meister Bot', { timeout: 5000 });
    });

    test('save without selecting an identity does not call PUT reviewer-identity', async ({ page }) => {
        const putCalled = { value: false };
        page.on('request', req => {
            if (req.method() === 'PUT' && req.url().includes('reviewer-identity')) {
                putCalled.value = true;
            }
        });

        await page.click('#save-btn');
        await expect(page.locator('#status-message')).toHaveText('Settings saved.', { timeout: 5000 });

        expect(putCalled.value).toBe(false);
    });
});
