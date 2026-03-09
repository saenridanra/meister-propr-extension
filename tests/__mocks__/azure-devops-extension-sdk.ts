export const init = jest.fn().mockResolvedValue(undefined);
export const getAccessToken = jest.fn().mockResolvedValue('mock-token');
export const getPageContext = jest.fn().mockReturnValue({
    webContext: {
        project: { id: 'mock-project-id', name: 'mock-project' },
        collection: { uri: 'https://dev.azure.com/mock-org/' }
    }
});
export const getHost = jest.fn().mockReturnValue({ name: 'mock-org' });
export const notifyLoadSucceeded = jest.fn();
export const getExtensionContext = jest.fn().mockReturnValue({
    extensionId: 'mock-extension',
    publisherId: 'mock-publisher'
});
export const getService = jest.fn();
