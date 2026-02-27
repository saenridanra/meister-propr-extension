/**
 * Testbed mock for azure-devops-extension-sdk.
 * Replaces the real SDK so the extension hubs can run in a plain browser.
 *
 * Settings are persisted in localStorage so they survive page refreshes.
 * ADO token: set  localStorage['testbed:adoToken'] = 'your-real-token'  in the
 * browser console if you want to make real backend calls.
 */

// ---------------------------------------------------------------------------
// Mock IExtensionDataService backed by localStorage
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SDK stubs
// ---------------------------------------------------------------------------

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

export async function getAccessToken(): Promise<string> {
    const token = localStorage.getItem('testbed:adoToken') ?? '';
    if (!token) {
        console.warn(
            '[testbed] No ADO token found. Set one via:\n' +
            "  localStorage.setItem('testbed:adoToken', 'your-real-token')\n" +
            'Real backend calls will fail without a valid token.'
        );
    }
    return token;
}

export function getExtensionContext() {
    return { id: 'meister-propr', publisherId: 'meister-propr-test-extension', version: '0.0.1' };
}

export async function getService<T>(_serviceId: string): Promise<T> {
    return mockExtensionDataService as unknown as T;
}
