import { ClientsService } from '../src/generated/services/ClientsService';
import { listCrawlConfigs, createCrawlConfig, deleteCrawlConfig } from '../src/api/crawlConfigClient';

jest.mock('../src/generated/services/ClientsService');

describe('crawlConfigClient', () => {
    const backendUrl = 'http://api.test/';
    const clientKey = 'secret';
    const clientId = 'client-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('listCrawlConfigs calls generated service', async () => {
        const mockResponse = [{ id: 'config-1' }];
        (ClientsService.getClientsCrawlConfigurations as jest.Mock).mockResolvedValue(mockResponse);

        const result = await listCrawlConfigs(backendUrl, clientKey, clientId);
        expect(ClientsService.getClientsCrawlConfigurations).toHaveBeenCalledWith(clientId);
        expect(result).toEqual(mockResponse);
    });

    test('createCrawlConfig calls generated service with correct request', async () => {
        const request = { reviewerDisplayName: 'John', crawlIntervalSeconds: 300 };
        const mockResponse = { id: 'config-1' };
        (ClientsService.postClientsCrawlConfigurations as jest.Mock).mockResolvedValue(mockResponse);

        const result = await createCrawlConfig(backendUrl, clientKey, clientId, request as any);
        expect(ClientsService.postClientsCrawlConfigurations).toHaveBeenCalledWith(clientId, request);
        expect(result).toEqual(mockResponse);
    });

    test('deleteCrawlConfig calls generated service', async () => {
        (ClientsService.deleteClientsCrawlConfigurations as jest.Mock).mockResolvedValue(undefined);
        await deleteCrawlConfig(backendUrl, clientKey, clientId, 'config-1');
        expect(ClientsService.deleteClientsCrawlConfigurations).toHaveBeenCalledWith(clientId, 'config-1');
    });

    test('deleteCrawlConfig treats 404 as success', async () => {
        (ClientsService.deleteClientsCrawlConfigurations as jest.Mock).mockRejectedValue({ status: 404 });
        await expect(deleteCrawlConfig(backendUrl, clientKey, clientId, 'config-1')).resolves.not.toThrow();
    });
});
