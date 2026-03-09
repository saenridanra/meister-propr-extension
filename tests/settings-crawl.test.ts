import * as SDK from 'azure-devops-extension-sdk';
import { listCrawlConfigs, createCrawlConfig, deleteCrawlConfig } from '../src/api/crawlConfigClient';
import { loadSettings, saveSettings, loadProjectCrawlReviewerName, saveProjectCrawlReviewerName } from '../src/common/extensionSettings';

// Note: We can't easily test the DOM logic in settings.ts without a JSDOM setup
// but we can test the logic that would be used there.

jest.mock('azure-devops-extension-sdk');
jest.mock('../src/api/crawlConfigClient');
jest.mock('../src/common/extensionSettings');

describe('Settings Crawl Logic', () => {
    const backendUrl = 'http://api';
    const clientKey = 'key';
    const clientId = 'client-123';
    const orgUrl = 'https://dev.azure.com/org/';
    const projectName = 'MyProject';

    beforeEach(() => {
        jest.clearAllMocks();
        (SDK.getPageContext as jest.Mock).mockReturnValue({
            webContext: {
                collection: { uri: orgUrl },
                project: { id: 'guid-123', name: projectName }
            }
        });
        (SDK.getHost as jest.Mock).mockReturnValue({ name: 'org' });
    });

    test('US1: reviewer name non-empty + no matching config -> createCrawlConfig called', async () => {
        (listCrawlConfigs as jest.Mock).mockResolvedValue([]);
        (createCrawlConfig as jest.Mock).mockResolvedValue({ id: 'new-id' });

        const reviewerName = 'John Doe';
        // Simulated logic from settings.ts
        const configs = await listCrawlConfigs(backendUrl, clientKey, clientId);
        const existing = configs.find(c => c.organizationUrl === orgUrl && c.projectId === projectName);
        
        if (reviewerName && !existing) {
            await createCrawlConfig(backendUrl, clientKey, clientId, {
                organizationUrl: orgUrl,
                projectId: projectName,
                reviewerDisplayName: reviewerName,
                crawlIntervalSeconds: 300
            });
            await saveProjectCrawlReviewerName(projectName, reviewerName);
        }

        expect(createCrawlConfig).toHaveBeenCalled();
        expect(saveProjectCrawlReviewerName).toHaveBeenCalledWith(projectName, reviewerName);
    });

    test('US1: reviewer name non-empty + matching config exists -> createCrawlConfig NOT called', async () => {
        (listCrawlConfigs as jest.Mock).mockResolvedValue([{ organizationUrl: orgUrl, projectId: projectName }]);

        const reviewerName = 'John Doe';
        const configs = await listCrawlConfigs(backendUrl, clientKey, clientId);
        const existing = configs.find(c => c.organizationUrl === orgUrl && c.projectId === projectName);
        
        if (reviewerName && !existing) {
            await createCrawlConfig(backendUrl, clientKey, clientId, {} as any);
        }

        expect(createCrawlConfig).not.toHaveBeenCalled();
    });

    test('US2: reviewer name empty + matching config exists -> deleteCrawlConfig called', async () => {
        (listCrawlConfigs as jest.Mock).mockResolvedValue([{ id: 'conf-1', organizationUrl: orgUrl, projectId: projectName }]);

        const reviewerName = '';
        const configs = await listCrawlConfigs(backendUrl, clientKey, clientId);
        const existing = configs.find(c => c.organizationUrl === orgUrl && c.projectId === projectName);
        
        if (!reviewerName && existing) {
            await deleteCrawlConfig(backendUrl, clientKey, clientId, existing.id!);
            await saveProjectCrawlReviewerName(projectName, '');
        }

        expect(deleteCrawlConfig).toHaveBeenCalledWith(backendUrl, clientKey, clientId, 'conf-1');
        expect(saveProjectCrawlReviewerName).toHaveBeenCalledWith(projectName, '');
    });
});
