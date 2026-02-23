import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, IExtensionDataService } from 'azure-devops-extension-api';

export interface ExtensionSettings {
    backendUrl: string;
    clientKey: string;
}

const KEYS = {
    backendUrl: 'backendUrl',
    clientKey:  'clientKey',
} as const;

async function getDataManager() {
    const dataService = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
    return dataService.getExtensionDataManager(SDK.getExtensionContext().id, await SDK.getAccessToken());
}

export async function loadSettings(): Promise<Partial<ExtensionSettings>> {
    const dm = await getDataManager();
    const [backendUrl, clientKey] = await Promise.all([
        dm.getValue<string>(KEYS.backendUrl, { scopeType: 'Default', defaultValue: '' }),
        dm.getValue<string>(KEYS.clientKey,  { scopeType: 'Default', defaultValue: '' }),
    ]);
    return { backendUrl, clientKey };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
    const dm = await getDataManager();
    await Promise.all([
        dm.setValue(KEYS.backendUrl, settings.backendUrl, { scopeType: 'Default' }),
        dm.setValue(KEYS.clientKey,  settings.clientKey,  { scopeType: 'Default' }),
    ]);
}
