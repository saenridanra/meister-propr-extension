import { ClientProfileResponse, ClientsService, IdentitiesService, OpenAPI } from '../generated';

function setup(backendUrl: string, clientKey: string) {
    OpenAPI.BASE = backendUrl.replace(/\/$/, '');
    OpenAPI.HEADERS = {
        'X-Client-Key': clientKey
    };
}

export async function getClientProfile(
    backendUrl: string, clientKey: string, clientId: string
): Promise<ClientProfileResponse> {
    setup(backendUrl, clientKey);
    return ClientsService.getClientsProfile(clientId);
}

export async function setReviewerIdentity(
    backendUrl: string, clientKey: string, clientId: string, reviewerId: string
): Promise<void> {
    setup(backendUrl, clientKey);
    await ClientsService.putClientsReviewerIdentity(clientId, { reviewerId });
}

export async function resolveIdentity(
    backendUrl: string, clientKey: string, orgUrl: string, displayName: string
): Promise<string | null> {
    setup(backendUrl, clientKey);
    const results = await IdentitiesService.getIdentitiesResolve(orgUrl, displayName);
    return results[0]?.id ?? null;
}
