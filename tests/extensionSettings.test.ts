import * as SDK from 'azure-devops-extension-sdk';
import {
    loadSettings,
    saveSettings,
    loadReviewerDisplayName,
    saveReviewerDisplayName,
} from '../src/common/extensionSettings';

jest.mock('azure-devops-extension-sdk');

describe('extensionSettings', () => {
    const mockDataManager = {
        getValue: jest.fn(),
        setValue: jest.fn()
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (SDK.getService as jest.Mock).mockResolvedValue({
            getExtensionDataManager: jest.fn().mockResolvedValue(mockDataManager)
        });
        (SDK.getExtensionContext as jest.Mock).mockReturnValue({ id: 'mock-ext' });
    });

    test('loadSettings includes clientId', async () => {
        mockDataManager.getValue.mockImplementation((key) => {
            if (key === 'backendUrl') return Promise.resolve('http://api.test');
            if (key === 'clientKey') return Promise.resolve('secret-key');
            if (key === 'clientId') return Promise.resolve('mock-client-id');
            return Promise.resolve('');
        });

        const settings = await loadSettings();
        expect(settings.clientId).toBe('mock-client-id');
    });

    test('saveSettings persists clientId', async () => {
        await saveSettings({
            backendUrl: 'url',
            clientKey: 'key',
            clientId: 'new-client-id'
        } as any);

        expect(mockDataManager.setValue).toHaveBeenCalledWith('clientId', 'new-client-id', expect.anything());
    });

    test('loadReviewerDisplayName returns empty string when key absent', async () => {
        mockDataManager.getValue.mockResolvedValue('');
        const name = await loadReviewerDisplayName();
        expect(name).toBe('');
    });

    test('loadReviewerDisplayName returns stored name', async () => {
        mockDataManager.getValue.mockResolvedValue('Meister Bot');
        const name = await loadReviewerDisplayName();
        expect(name).toBe('Meister Bot');
    });

    test('saveReviewerDisplayName calls setValue with correct key and value', async () => {
        await saveReviewerDisplayName('Meister Bot');
        expect(mockDataManager.setValue).toHaveBeenCalledWith(
            'reviewerDisplayName',
            'Meister Bot',
            { scopeType: 'Default' }
        );
    });
});
