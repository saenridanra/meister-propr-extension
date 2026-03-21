import { OpenAPI } from '../generated/core/OpenAPI';
import { ClientsService } from '../generated/services/ClientsService';
import type { CrawlConfigResponse } from '../generated/models/CrawlConfigResponse';
import type { CreateCrawlConfigRequest } from '../generated/models/CreateCrawlConfigRequest';

export const DEFAULT_CRAWL_INTERVAL_SECONDS = 300;

function setup(backendUrl: string, clientKey: string) {
    OpenAPI.BASE = backendUrl.replace(/\/$/, '');
    OpenAPI.HEADERS = {
        'X-Client-Key': clientKey
    };
}

export async function listCrawlConfigs(
    backendUrl: string, clientKey: string, clientId: string
): Promise<CrawlConfigResponse[]> {
    setup(backendUrl, clientKey);
    return ClientsService.getClientsCrawlConfigurations(clientId);
}

export async function createCrawlConfig(
    backendUrl: string, clientKey: string, clientId: string,
    request: CreateCrawlConfigRequest
): Promise<CrawlConfigResponse> {
    setup(backendUrl, clientKey);
    return ClientsService.postClientsCrawlConfigurations(clientId, request);
}

export async function deleteCrawlConfig(
    backendUrl: string, clientKey: string, clientId: string, configId: string
): Promise<void> {
    setup(backendUrl, clientKey);
    try {
        await ClientsService.deleteClientsCrawlConfigurations(clientId, configId);
    } catch (error: any) {
        if (error.status === 404) return; // Idempotent
        throw error;
    }
}

