/**
 * @jest-environment jsdom
 */

import * as SDK from 'azure-devops-extension-sdk';
import * as crawlConfigClientMod from '../src/api/crawlConfigClient';
import * as reviewerIdentityClientMod from '../src/api/reviewerIdentityClient';
import * as extensionSettingsMod from '../src/common/extensionSettings';

jest.mock('../src/api/crawlConfigClient');
jest.mock('../src/api/reviewerIdentityClient');
jest.mock('../src/common/extensionSettings');
jest.mock('azure-devops-extension-sdk');

const { listCrawlConfigs, createCrawlConfig, deleteCrawlConfig } =
    crawlConfigClientMod as jest.Mocked<typeof crawlConfigClientMod>;
const { setReviewerIdentity, resolveIdentity } =
    reviewerIdentityClientMod as jest.Mocked<typeof reviewerIdentityClientMod>;
const { loadSettings, saveSettings, loadReviewerDisplayName, saveReviewerDisplayName } =
    extensionSettingsMod as jest.Mocked<typeof extensionSettingsMod>;

const mockSearchIdentities = jest.fn();

function setupDOM(reviewerDisplayName = '', clientId = 'client-123') {
    document.body.innerHTML = `
        <input id="backend-url" value="http://api.test">
        <input id="client-key" value="test-key">
        <input id="client-id" value="${clientId}">
        <input type="checkbox" id="crawl-enabled">
        <div id="crawl-hint"></div>
        <input id="reviewer-search" value="${reviewerDisplayName}">
        <ul id="reviewer-dropdown" hidden></ul>
        <div id="reviewer-hint"></div>
        <button id="save-btn"></button>
        <div id="status-message"></div>
    `;
}

function setupDefaultMocks(storedDisplayName = '') {
    listCrawlConfigs.mockResolvedValue([]);
    createCrawlConfig.mockResolvedValue({} as any);
    deleteCrawlConfig.mockResolvedValue(undefined);
    mockSearchIdentities.mockResolvedValue([]);
    setReviewerIdentity.mockResolvedValue(undefined);
    (resolveIdentity as jest.Mock).mockResolvedValue('resolved-guid');
    loadSettings.mockResolvedValue({ backendUrl: 'http://api.test', clientKey: 'test-key', clientId: 'client-123' });
    saveSettings.mockResolvedValue(undefined);
    loadReviewerDisplayName.mockResolvedValue(storedDisplayName);
    saveReviewerDisplayName.mockResolvedValue(undefined);
    (SDK.getService as jest.Mock).mockResolvedValue({ searchIdentitiesAsync: mockSearchIdentities });
}

async function initSettings() {
    jest.isolateModules(() => {
        require('../src/settings/settings');
    });
    // Wait for main() async operations to settle
    await new Promise(r => setTimeout(r, 50));
}

describe('settings — reviewer identity section', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchIdentities.mockReset();
    });

    test('(a) searchIdentitiesAsync is called when input length >= 2 chars', async () => {
        setupDOM();
        setupDefaultMocks();
        mockSearchIdentities.mockResolvedValue([{ entityId: 'guid-1', displayName: 'Meister Bot' }]);

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'Me';
        input.dispatchEvent(new Event('input'));

        // Wait past debounce (300ms) + margin
        await new Promise(r => setTimeout(r, 400));

        expect(mockSearchIdentities).toHaveBeenCalledWith(
            'Me', ['user', 'group', 'servicePrincipal'], ['ims', 'source', 'aad']);
    });

    test('(a) searchIdentitiesAsync is NOT called when input length < 2 chars', async () => {
        setupDOM();
        setupDefaultMocks();

        await initSettings();
        mockSearchIdentities.mockClear();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'M';
        input.dispatchEvent(new Event('input'));

        await new Promise(r => setTimeout(r, 400));

        expect(mockSearchIdentities).not.toHaveBeenCalled();
    });

    test('(b) setReviewerIdentity is called with resolved VSS GUID on save', async () => {
        setupDOM();
        setupDefaultMocks();
        mockSearchIdentities.mockResolvedValue([{ entityId: 'guid-abc', displayName: 'Meister Bot' }]);
        (resolveIdentity as jest.Mock).mockResolvedValue('vss-guid-xyz');

        await initSettings();

        // Trigger search
        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'Me';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 400));

        // Select item from dropdown
        const dropdown = document.getElementById('reviewer-dropdown') as HTMLUListElement;
        const item = dropdown.querySelector('li[data-id]') as HTMLLIElement;
        expect(item).not.toBeNull();
        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // Wait for resolveAndSetId to complete
        await new Promise(r => setTimeout(r, 50));

        // Click save
        document.getElementById('save-btn')!.click();
        await new Promise(r => setTimeout(r, 50));

        expect(resolveIdentity).toHaveBeenCalledWith(
            'http://api.test', 'test-key', expect.stringContaining('dev.azure.com'), 'Meister Bot'
        );
        expect(setReviewerIdentity).toHaveBeenCalledWith(
            'http://api.test', 'test-key', 'client-123', 'vss-guid-xyz'
        );
    });

    test('(c) saveReviewerDisplayName is called with selected display name on save', async () => {
        setupDOM();
        setupDefaultMocks();
        mockSearchIdentities.mockResolvedValue([{ entityId: 'guid-abc', displayName: 'Meister Bot' }]);

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'Me';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 400));

        const item = document.querySelector('#reviewer-dropdown li[data-id]') as HTMLLIElement;
        item.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // Wait for resolveAndSetId to complete
        await new Promise(r => setTimeout(r, 50));

        document.getElementById('save-btn')!.click();
        await new Promise(r => setTimeout(r, 50));

        expect(saveReviewerDisplayName).toHaveBeenCalledWith('Meister Bot');
    });

    test('(d) loadReviewerDisplayName result pre-populates the search field on load', async () => {
        setupDOM('', 'client-123');
        setupDefaultMocks('Stored Identity');

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        expect(input.value).toBe('Stored Identity');
    });

    test('(e) reviewer identity search is disabled when clientId is empty', async () => {
        setupDOM('', '');
        setupDefaultMocks();
        loadSettings.mockResolvedValue({ backendUrl: 'http://api.test', clientKey: 'test-key', clientId: '' });

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        expect(input.disabled).toBe(true);
    });

    test('(f) save is a no-op for reviewer identity when no identity is selected', async () => {
        setupDOM();
        setupDefaultMocks();

        await initSettings();

        document.getElementById('save-btn')!.click();
        await new Promise(r => setTimeout(r, 50));

        expect(setReviewerIdentity).not.toHaveBeenCalled();
        expect(saveReviewerDisplayName).not.toHaveBeenCalled();
    });

    // US2: no-results feedback
    test('(US2) dropdown shows no-results item when searchIdentitiesAsync returns empty array', async () => {
        setupDOM();
        setupDefaultMocks();
        mockSearchIdentities.mockResolvedValue([]);

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'zzz';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 400));

        const dropdown = document.getElementById('reviewer-dropdown') as HTMLUListElement;
        expect(dropdown.hidden).toBe(false);
        const noResultsItem = dropdown.querySelector('.autocomplete-item--no-results');
        expect(noResultsItem).not.toBeNull();
        expect(noResultsItem!.textContent).toBe('No results found');
    });

    test('(US2) clicking no-results item does NOT set selectedReviewerId', async () => {
        setupDOM();
        setupDefaultMocks();
        mockSearchIdentities.mockResolvedValue([]);

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'zzz';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 400));

        const noResultsItem = document.querySelector('.autocomplete-item--no-results') as HTMLLIElement;
        noResultsItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        // Save should not call setReviewerIdentity
        document.getElementById('save-btn')!.click();
        await new Promise(r => setTimeout(r, 50));

        expect(setReviewerIdentity).not.toHaveBeenCalled();
    });

    test('(US2) identity service error shows inline hint and does not open dropdown', async () => {
        setupDOM();
        setupDefaultMocks();
        mockSearchIdentities.mockRejectedValue(new Error('Service unavailable'));

        await initSettings();

        const input = document.getElementById('reviewer-search') as HTMLInputElement;
        input.value = 'Me';
        input.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 400));

        const hint = document.getElementById('reviewer-hint') as HTMLDivElement;
        expect(hint.textContent).toContain('Could not search identities');
        expect(hint.className).toContain('status-error');

        const dropdown = document.getElementById('reviewer-dropdown') as HTMLUListElement;
        expect(dropdown.hidden).toBe(true);
    });
});
