/**
 * Testbed mock for azure-devops-extension-sdk.
 * Replaces the real SDK so the extension hubs can run in a plain browser.
 *
 * Settings are persisted in localStorage so they survive page refreshes.
 * ADO token: set  localStorage['testbed:adoToken'] = 'your-real-token'  in the
 * browser console if you want to make real backend calls.
 */

const mockDataManager = {
    getValue: async <T>(key: string, options?: { scopeType?: string; defaultValue?: T }): Promise<T> => {
        const raw = localStorage.getItem(`ado-ext:${key}`);
        if (raw !== null) {
            try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
        }
        return (options?.defaultValue ?? '' as unknown) as T;
    },
    setValue: async <T>(key: string, value: T, _options?: unknown): Promise<T> => {
        localStorage.setItem(`ado-ext:${key}`, JSON.stringify(value));
        return value;
    },
};

const mockExtensionDataService = {
    getExtensionDataManager: async (_id: string, _token: string) => mockDataManager,
};

const IDENTITY_POOL = [
    { entityId: 'aaaaaaaa-0001-0001-0001-000000000001', displayName: 'Meister Bot' },
    { entityId: 'aaaaaaaa-0002-0002-0002-000000000002', displayName: 'Review Bot' },
    { entityId: 'aaaaaaaa-0003-0003-0003-000000000003', displayName: 'Bot Service Account' },
    { entityId: 'aaaaaaaa-0004-0004-0004-000000000004', displayName: 'CI Review Agent' },
    { entityId: 'aaaaaaaa-0005-0005-0005-000000000005', displayName: 'Testbed Reviewer' },
];

const mockIdentityService = {
    searchIdentitiesAsync: async (query: string) => {
        const q = query.toLowerCase();
        return IDENTITY_POOL.filter(i => i.displayName.toLowerCase().includes(q));
    },
};

export async function init(_options?: { loaded?: boolean }): Promise<void> {
    // no-op: in ADO this would handshake with the host frame
}

export function notifyLoadSucceeded(): void {
    console.log('[testbed] SDK.notifyLoadSucceeded()');
}

export function getPageContext() {
    return {
        webContext: {
            project: {
                id: 'testbed-project-id',
                name: 'Testbed Project',
            },
        },
    };
}

export function getHost() {
    return {
        id:   'testbed-org-id',
        name: 'testbedorg',
        serviceVersion: '1.0',
        type: 1,
    };
}

const FAKE_ADO_TOKEN = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

console.log(`[testbed] Fake ADO token for this session: ${FAKE_ADO_TOKEN}`);

export async function getAccessToken(): Promise<string> {
    return FAKE_ADO_TOKEN;
}

export function getExtensionContext() {
    return { id: 'meister-propr', publisherId: 'meister-propr-test-extension', version: '0.0.1' };
}

export async function getService<T>(serviceId: string): Promise<T> {
    if (serviceId === 'ms.vss-features.identity-service') {
        return mockIdentityService as unknown as T;
    }
    return mockExtensionDataService as unknown as T;
}
