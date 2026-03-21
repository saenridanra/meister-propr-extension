import { ClientProfileResponse, ClientsService, OpenAPI } from '../generated';

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
