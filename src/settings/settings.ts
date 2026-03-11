import * as SDK from 'azure-devops-extension-sdk';
import { loadSettings, saveSettings, ExtensionSettings } from '../common/extensionSettings';
import { listCrawlConfigs, createCrawlConfig, deleteCrawlConfig, DEFAULT_CRAWL_INTERVAL_SECONDS } from '../api/crawlConfigClient';
import './settings.css';

function el<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Element with id '${id}' not found`);
    return element as T;
}

async function main(): Promise<void> {
    await SDK.init({ loaded: false });

    const backendUrlInput  = el<HTMLInputElement>('backend-url');
    const clientKeyInput   = el<HTMLInputElement>('client-key');
    const clientIdInput    = el<HTMLInputElement>('client-id');
    const crawlEnabledInput = el<HTMLInputElement>('crawl-enabled');
    const crawlHint        = el<HTMLDivElement>('crawl-hint');
    const saveBtn          = el<HTMLButtonElement>('save-btn');
    const statusMsg        = el<HTMLDivElement>('status-message');

    const context  = SDK.getPageContext();
    const orgName  = SDK.getHost().name;
    const orgUrl   = `https://dev.azure.com/${orgName}/`;
    const projectName = context.webContext.project.name;

    const settings = await loadSettings();
    backendUrlInput.value = settings.backendUrl ?? '';
    clientKeyInput.value  = settings.clientKey  ?? '';
    clientIdInput.value   = settings.clientId   ?? '';

    const checkPrerequisites = () => {
        const hasPrereqs = backendUrlInput.value.trim() !== '' &&
                           clientKeyInput.value.trim() !== '' &&
                           clientIdInput.value.trim() !== '';

        crawlEnabledInput.disabled = !hasPrereqs;
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
