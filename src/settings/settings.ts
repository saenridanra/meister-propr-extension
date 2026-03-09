import * as SDK from 'azure-devops-extension-sdk';
import { loadSettings, saveSettings, ExtensionSettings, loadProjectCrawlReviewerName, saveProjectCrawlReviewerName } from '../common/extensionSettings';
import { listCrawlConfigs, createCrawlConfig, deleteCrawlConfig, DEFAULT_CRAWL_INTERVAL_SECONDS } from '../api/crawlConfigClient';
import './settings.css';

function el<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Element with id '${id}' not found`);
    return element as T;
}

async function main(): Promise<void> {
    await SDK.init({ loaded: false });

    const backendUrlInput = el<HTMLInputElement>('backend-url');
    const clientKeyInput  = el<HTMLInputElement>('client-key');
    const clientIdInput   = el<HTMLInputElement>('client-id');
    const reviewerNameInput = el<HTMLInputElement>('reviewer-display-name');
    const reviewerHint    = el<HTMLDivElement>('reviewer-hint');
    const saveBtn         = el<HTMLButtonElement>('save-btn');
    const statusMsg       = el<HTMLDivElement>('status-message');

    const context = SDK.getPageContext();
    const orgName = SDK.getHost().name;
    const orgUrl = `https://dev.azure.com/${orgName}/`;
    const projectName = context.webContext.project.name;

    const settings = await loadSettings();
    backendUrlInput.value = settings.backendUrl ?? '';
    clientKeyInput.value  = settings.clientKey  ?? '';
    clientIdInput.value   = settings.clientId   ?? '';

    // US3: Pre-populate reviewer display name
    const currentReviewerName = await loadProjectCrawlReviewerName(projectName);
    reviewerNameInput.value = currentReviewerName;

    // US3 Prerequisite guard
    const checkPrerequisites = () => {
        const hasPrereqs = backendUrlInput.value.trim() !== '' && 
                         clientKeyInput.value.trim() !== '' && 
                         clientIdInput.value.trim() !== '';
        
        reviewerNameInput.disabled = !hasPrereqs;
        if (!hasPrereqs) {
            reviewerHint.textContent = 'Configure Backend URL, Client Key, and Client ID first.';
            reviewerHint.className = 'input-hint status-error';
        } else {
            reviewerHint.textContent = '';
            reviewerHint.className = 'input-hint';
        }
    };

    backendUrlInput.addEventListener('input', checkPrerequisites);
    clientKeyInput.addEventListener('input', checkPrerequisites);
    clientIdInput.addEventListener('input', checkPrerequisites);
    checkPrerequisites();

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        statusMsg.textContent = 'Saving...';
        statusMsg.className = '';

        const backendUrl = backendUrlInput.value.trim();
        const clientKey = clientKeyInput.value.trim();
        const clientId = clientIdInput.value.trim();
        const reviewerName = reviewerNameInput.value.trim();

        try {
            // 1. Save core extension settings
            const updated: ExtensionSettings = { backendUrl, clientKey, clientId };
            await saveSettings(updated);

            // 2. Handle Crawl Configuration (if prerequisites met)
            if (backendUrl && clientKey && clientId) {
                const configs = await listCrawlConfigs(backendUrl, clientKey, clientId);
                const existing = configs.find(c => 
                    c.organizationUrl?.replace(/\/$/, '') === orgUrl.replace(/\/$/, '') && 
                    c.projectId === projectName
                );

                if (reviewerName) {
                    // US1: Enable/Update
                    if (!existing) {
                        await createCrawlConfig(backendUrl, clientKey, clientId, {
                            organizationUrl: orgUrl,
                            projectId: projectName,
                            reviewerDisplayName: reviewerName,
                            crawlIntervalSeconds: DEFAULT_CRAWL_INTERVAL_SECONDS
                        });
                    }
                    await saveProjectCrawlReviewerName(projectName, reviewerName);
                } else if (existing) {
                    // US2: Disable (Clear)
                    await deleteCrawlConfig(backendUrl, clientKey, clientId, existing.id!);
                    await saveProjectCrawlReviewerName(projectName, '');
                } else {
                    // US2: No-op
                    await saveProjectCrawlReviewerName(projectName, '');
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
