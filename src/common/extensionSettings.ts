import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, IExtensionDataService } from 'azure-devops-extension-api';

export interface ExtensionSettings {
    backendUrl: string;
    clientKey: string;
    clientId: string;
}

const KEYS = {
    backendUrl: 'backendUrl',
    clientKey:  'clientKey',
    clientId:   'clientId',
} as const;

async function getDataManager() {
    const dataService = await SDK.getService<IExtensionDataService>(CommonServiceIds.ExtensionDataService);
    return dataService.getExtensionDataManager(SDK.getExtensionContext().id, await SDK.getAccessToken());
}

export async function loadSettings(): Promise<Partial<ExtensionSettings>> {
    const dm = await getDataManager();
    const [backendUrl, clientKey, clientId] = await Promise.all([
        dm.getValue<string>(KEYS.backendUrl, { scopeType: 'Default', defaultValue: '' }),
        dm.getValue<string>(KEYS.clientKey,  { scopeType: 'Default', defaultValue: '' }),
        dm.getValue<string>(KEYS.clientId,   { scopeType: 'Default', defaultValue: '' }),
    ]);
    return { backendUrl, clientKey, clientId };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
    const dm = await getDataManager();
    await Promise.all([
        dm.setValue(KEYS.backendUrl, settings.backendUrl, { scopeType: 'Default' }),
        dm.setValue(KEYS.clientKey,  settings.clientKey,  { scopeType: 'Default' }),
        dm.setValue(KEYS.clientId,   settings.clientId,   { scopeType: 'Default' }),
    ]);
}

