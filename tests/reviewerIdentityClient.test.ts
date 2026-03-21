import { ClientsService } from '../src/generated';
import { getClientProfile, setReviewerIdentity } from '../src/api/reviewerIdentityClient';

jest.mock('../src/generated/services/ClientsService');

describe('reviewerIdentityClient', () => {
    const backendUrl = 'http://api.test/';
    const clientKey = 'secret';
    const clientId = 'client-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('getClientProfile calls generated getClientsProfile and returns the result', async () => {
        const mockProfile = {
            id: clientId,
            displayName: 'Test Client',
            isActive: true,
            createdAt: '2026-01-01T00:00:00Z',
            reviewerId: 'guid-456',
        };
        (ClientsService.getClientsProfile as jest.Mock).mockResolvedValue(mockProfile);

        const result = await getClientProfile(backendUrl, clientKey, clientId);

        expect(ClientsService.getClientsProfile).toHaveBeenCalledWith(clientId);
        expect(result).toEqual(mockProfile);
    });

    test('setReviewerIdentity calls putClientsReviewerIdentity with correct arguments', async () => {
        (ClientsService.putClientsReviewerIdentity as jest.Mock).mockResolvedValue(undefined);

        await setReviewerIdentity(backendUrl, clientKey, clientId, 'guid-123');

        expect(ClientsService.putClientsReviewerIdentity).toHaveBeenCalledWith(clientId, { reviewerId: 'guid-123' });
    });
});
