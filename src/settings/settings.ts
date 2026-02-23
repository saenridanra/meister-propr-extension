import * as SDK from 'azure-devops-extension-sdk';
import { loadSettings, saveSettings, ExtensionSettings } from '../common/extensionSettings';
import './settings.css';

function el<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

async function main(): Promise<void> {
    await SDK.init({ loaded: false });

    const backendUrlInput = el<HTMLInputElement>('backend-url');
    const clientKeyInput  = el<HTMLInputElement>('client-key');
    const saveBtn         = el<HTMLButtonElement>('save-btn');
    const statusMsg       = el<HTMLDivElement>('status-message');

    const settings = await loadSettings();
    backendUrlInput.value = settings.backendUrl ?? '';
    clientKeyInput.value  = settings.clientKey  ?? '';

    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        statusMsg.textContent = '';
        statusMsg.className = '';

        try {
            const updated: ExtensionSettings = {
                backendUrl: backendUrlInput.value.trim(),
                clientKey:  clientKeyInput.value.trim(),
            };
            await saveSettings(updated);
            statusMsg.textContent = 'Settings saved.';
            statusMsg.className = 'status-success';
        } catch (err) {
            statusMsg.textContent = `Failed to save: ${(err as Error).message}`;
            statusMsg.className = 'status-error';
        } finally {
            saveBtn.disabled = false;
        }
    });

    SDK.notifyLoadSucceeded();
}

main();
