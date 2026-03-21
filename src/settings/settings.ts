import * as SDK from 'azure-devops-extension-sdk';
import { IdentityServiceIds, IVssIdentityService } from 'azure-devops-extension-api/Identities';
import { loadSettings, saveSettings, loadReviewerDisplayName, saveReviewerDisplayName, ExtensionSettings } from '../common/extensionSettings';
import { listCrawlConfigs, createCrawlConfig, deleteCrawlConfig, DEFAULT_CRAWL_INTERVAL_SECONDS } from '../api/crawlConfigClient';
import { setReviewerIdentity, resolveIdentity } from '../api/reviewerIdentityClient';
import './settings.css';

// T016: module-level reviewer identity state
let selectedReviewerId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let focusIndex = -1;


function el<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Element with id '${id}' not found`);
    return element as T;
}

async function main(): Promise<void> {
    await SDK.init({ loaded: false });

    const backendUrlInput   = el<HTMLInputElement>('backend-url');
    const clientKeyInput    = el<HTMLInputElement>('client-key');
    const clientIdInput     = el<HTMLInputElement>('client-id');
    const crawlEnabledInput = el<HTMLInputElement>('crawl-enabled');
    const crawlHint         = el<HTMLDivElement>('crawl-hint');
    const reviewerSearchInput = el<HTMLInputElement>('reviewer-search');
    const reviewerDropdown  = el<HTMLUListElement>('reviewer-dropdown');
    const reviewerHint      = el<HTMLDivElement>('reviewer-hint');
    const saveBtn           = el<HTMLButtonElement>('save-btn');
    const statusMsg         = el<HTMLDivElement>('status-message');

    const context  = SDK.getPageContext();
    const orgName  = SDK.getHost().name;
    const orgUrl   = `https://dev.azure.com/${orgName}/`;
    const projectName = context.webContext.project.name;

    const settings = await loadSettings();
    backendUrlInput.value = settings.backendUrl ?? '';
    clientKeyInput.value  = settings.clientKey  ?? '';
    clientIdInput.value   = settings.clientId   ?? '';

    // Helper: resolve display name to VSS GUID via backend, store in selectedReviewerId
    async function resolveAndSetId(displayName: string): Promise<void> {
        selectedReviewerId = null;
        reviewerHint.textContent = 'Resolving identity…';
        reviewerHint.className = 'input-hint';
        try {
            const id = await resolveIdentity(
                backendUrlInput.value.trim(), clientKeyInput.value.trim(), orgUrl, displayName);
            if (id) {
                selectedReviewerId = id;
                reviewerHint.textContent = '';
                reviewerHint.className = 'input-hint';
            } else {
                reviewerHint.textContent = 'Identity not found.';
                reviewerHint.className = 'input-hint status-error';
            }
        } catch {
            reviewerHint.textContent = 'Could not resolve identity.';
            reviewerHint.className = 'input-hint status-error';
        }
    }

    // T017: dropdown open/close helpers
    function openDropdown(): void {
        focusIndex = -1;
        reviewerDropdown.hidden = false;
        reviewerSearchInput.setAttribute('aria-expanded', 'true');
    }

    function closeDropdown(): void {
        reviewerDropdown.hidden = true;
        reviewerSearchInput.setAttribute('aria-expanded', 'false');
    }

    // T017: prevent blur racing click-inside-dropdown
    reviewerSearchInput.addEventListener('blur', () => setTimeout(closeDropdown, 150));
    reviewerDropdown.addEventListener('mousedown', (e) => e.preventDefault());

    const checkPrerequisites = () => {
        const hasPrereqs = backendUrlInput.value.trim() !== '' &&
                           clientKeyInput.value.trim() !== '' &&
                           clientIdInput.value.trim() !== '';

        crawlEnabledInput.disabled = !hasPrereqs;
        reviewerSearchInput.disabled = !hasPrereqs;  // T021: guard reviewer field
        if (!hasPrereqs) {
            crawlHint.textContent = 'Configure Backend URL, Client Key, and Client ID first.';
            crawlHint.className = 'input-hint status-error';
        } else {
            crawlHint.textContent = '';
            crawlHint.className = 'input-hint';
        }
    };

    backendUrlInput.addEventListener('input', checkPrerequisites);
    clientKeyInput.addEventListener('input', checkPrerequisites);
    clientIdInput.addEventListener('input', checkPrerequisites);
    checkPrerequisites();

    // T018: reviewer identity search with debounce
    reviewerSearchInput.addEventListener('input', () => {
        selectedReviewerId = null;
        clearTimeout(debounceTimer);
        const query = reviewerSearchInput.value.trim();
        if (query.length < 2) {
            closeDropdown();
            return;
        }
        debounceTimer = setTimeout(async () => {
            try {
                const identityService = await SDK.getService<IVssIdentityService>(IdentityServiceIds.IdentityService);
                const results = await identityService.searchIdentitiesAsync(
                    query, ['user', 'group', 'servicePrincipal'], ['ims', 'source', 'aad']);
                reviewerHint.textContent = '';
                reviewerHint.className = 'input-hint';
                reviewerDropdown.innerHTML = '';
                if (results.length === 0) {
                    const noResults = document.createElement('li');
                    noResults.className = 'autocomplete-item autocomplete-item--no-results';
                    noResults.textContent = 'No results found';
                    reviewerDropdown.appendChild(noResults);
                } else {
                    for (const identity of results) {
                        const li = document.createElement('li');
                        li.className = 'autocomplete-item';
                        li.setAttribute('role', 'option');
                        li.dataset['id'] = 'selectable';
                        li.textContent = (identity as any).displayName ?? identity.entityId;
                        reviewerDropdown.appendChild(li);
                    }
                }
                openDropdown();
            } catch {
                reviewerHint.textContent = 'Could not search identities.';
                reviewerHint.className = 'input-hint status-error';
                closeDropdown();
            }
        }, 300);
    });

    // T025: keyboard navigation
    function getSelectableItems(): HTMLLIElement[] {
        return Array.from(reviewerDropdown.querySelectorAll<HTMLLIElement>('li[data-id]'));
    }

    function setFocused(index: number, items: HTMLLIElement[]): void {
        items.forEach((li, i) => {
            if (i === index) {
                li.classList.add('autocomplete-item--focused');
                li.scrollIntoView({ block: 'nearest' });
            } else {
                li.classList.remove('autocomplete-item--focused');
            }
        });
        focusIndex = index;
    }

    reviewerSearchInput.addEventListener('keydown', (e) => {
        if (reviewerDropdown.hidden) return;
        const items = getSelectableItems();
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocused(Math.min(focusIndex + 1, items.length - 1), items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocused(Math.max(focusIndex - 1, 0), items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const focused = items[focusIndex];
            if (focused) {
                const displayName = focused.textContent ?? '';
                reviewerSearchInput.value = displayName;
                closeDropdown();
                void resolveAndSetId(displayName);
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    // T019: click delegation on dropdown
    reviewerDropdown.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const item = target.closest('li[data-id]') as HTMLLIElement | null;
        if (!item) return;
        const displayName = item.textContent ?? '';
        reviewerSearchInput.value = displayName;
        closeDropdown();
        void resolveAndSetId(displayName);
    });

    // T020: pre-populate reviewer display name
    const storedDisplayName = await loadReviewerDisplayName();
    if (storedDisplayName) {
        reviewerSearchInput.value = storedDisplayName;
    }

    // Pre-populate crawl enabled state from backend
    if (settings.backendUrl && settings.clientKey && settings.clientId) {
        try {
            const configs = await listCrawlConfigs(settings.backendUrl, settings.clientKey, settings.clientId);
            const existing = configs.find(c =>
                c.organizationUrl?.replace(/\/$/, '') === orgUrl.replace(/\/$/, '') &&
                c.projectId === projectName
            );
            crawlEnabledInput.checked = !!existing;
        } catch {
            // Leave unchecked if we can't reach the backend
        }
    }

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        statusMsg.textContent = 'Saving...';
        statusMsg.className = '';

        const backendUrl  = backendUrlInput.value.trim();
        const clientKey   = clientKeyInput.value.trim();
        const clientId    = clientIdInput.value.trim();
        const crawlEnabled = crawlEnabledInput.checked;

        try {
            await saveSettings({ backendUrl, clientKey, clientId } as ExtensionSettings);

            if (backendUrl && clientKey && clientId) {
                const configs = await listCrawlConfigs(backendUrl, clientKey, clientId);
                const existing = configs.find(c =>
                    c.organizationUrl?.replace(/\/$/, '') === orgUrl.replace(/\/$/, '') &&
                    c.projectId === projectName
                );

                if (crawlEnabled && !existing) {
                    await createCrawlConfig(backendUrl, clientKey, clientId, {
                        organizationUrl: orgUrl,
                        projectId: projectName,
                        crawlIntervalSeconds: DEFAULT_CRAWL_INTERVAL_SECONDS
                    });
                } else if (!crawlEnabled && existing) {
                    await deleteCrawlConfig(backendUrl, clientKey, clientId, existing.id!);
                }
            }

            // T021: reviewer identity save
            if (selectedReviewerId !== null) {
                await setReviewerIdentity(backendUrl, clientKey, clientId, selectedReviewerId);
                await saveReviewerDisplayName(reviewerSearchInput.value.trim());
            }

            statusMsg.textContent = 'Settings saved.';
            statusMsg.className = 'status-success';
        } catch (err: any) {
            console.error('Save failed', err);
            const detail = err?.body?.detail || err?.message || 'Unknown error';
            statusMsg.textContent = `Failed to save: ${detail}`;
            statusMsg.className = 'status-error';
        } finally {
            saveBtn.disabled = false;
        }
    });

    SDK.notifyLoadSucceeded();
}

main().catch(err => {
    console.error('Extension initialization failed', err);
    SDK.notifyLoadSucceeded();
});
