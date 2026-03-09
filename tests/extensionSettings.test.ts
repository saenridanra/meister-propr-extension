import * as SDK from 'azure-devops-extension-sdk';
import { loadSettings, saveSettings, loadProjectCrawlReviewerName, saveProjectCrawlReviewerName } from '../src/common/extensionSettings';

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

    test('loadProjectCrawlReviewerName returns stored name', async () => {
        mockDataManager.getValue.mockResolvedValue('John Doe');
        const name = await loadProjectCrawlReviewerName('proj-123');
        expect(mockDataManager.getValue).toHaveBeenCalledWith('crawlReviewerDisplayName_proj-123', expect.anything());
        expect(name).toBe('John Doe');
    });

    test('loadProjectCrawlReviewerName returns empty string when missing', async () => {
        mockDataManager.getValue.mockResolvedValue('');
        const name = await loadProjectCrawlReviewerName('proj-456');
        expect(name).toBe('');
    });

    test('saveProjectCrawlReviewerName persists name', async () => {
        await saveProjectCrawlReviewerName('proj-123', 'Jane Smith');
        expect(mockDataManager.setValue).toHaveBeenCalledWith('crawlReviewerDisplayName_proj-123', 'Jane Smith', expect.anything());
    });

    test('saveProjectCrawlReviewerName with empty string clears value', async () => {
        await saveProjectCrawlReviewerName('proj-123', '');
        expect(mockDataManager.setValue).toHaveBeenCalledWith('crawlReviewerDisplayName_proj-123', '', expect.anything());
    });
});
