/**
 * Testbed mock for azure-devops-extension-api.
 * Provides CommonServiceIds and a getClient() that returns a mock GitRestClient.
 *
 * Edit MOCK_REPOS below to customise the repositories shown in the Review hub dropdown.
 */

// ---------------------------------------------------------------------------
// Configurable mock data — edit these to suit your local testing needs
// ---------------------------------------------------------------------------

const MOCK_REPOS = [
    { id: 'mock-repo-1', name: 'MyBackendRepo' },
    { id: 'mock-repo-2', name: 'MyFrontendRepo' },
];

const MOCK_ITERATIONS = [{ id: 1 }, { id: 2 }];

// ---------------------------------------------------------------------------
// CommonServiceIds
// ---------------------------------------------------------------------------

export const CommonServiceIds = {
    ExtensionDataService: 'mock-ext-data-svc',
} as const;

// ---------------------------------------------------------------------------
// IExtensionDataService (type only — used as generic parameter)
// ---------------------------------------------------------------------------

export type IExtensionDataService = {
    getExtensionDataManager(id: string, token: string): Promise<{
        getValue<T>(key: string, options?: { scopeType?: string; defaultValue?: T }): Promise<T>;
        setValue<T>(key: string, value: T, options?: unknown): Promise<T>;
    }>;
};

// ---------------------------------------------------------------------------
// Mock Git client returned by getClient()
// ---------------------------------------------------------------------------

const mockGitClient = {
    getRepositories: async (_projectId: string) => MOCK_REPOS,
    getPullRequestIterations: async (_repoId: string, _prId: number, _projectId?: string) => MOCK_ITERATIONS,
};

// ---------------------------------------------------------------------------
// getClient factory
// ---------------------------------------------------------------------------

export function getClient(_clientClass: unknown): typeof mockGitClient {
    return mockGitClient;
}
