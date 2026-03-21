/**
 * Testbed mock for azure-devops-extension-api/Identities.
 * Provides the IdentityServiceIds constant used by settings.ts.
 * The actual identity search is handled by the SDK mock's getService implementation.
 */

export const IdentityServiceIds = {
    IdentityService: 'ms.vss-features.identity-service',
} as const;

export interface IVssIdentityService {
    searchIdentitiesAsync(query: string, identityTypes?: string[], operationScopes?: string[], queryTypeHint?: string, options?: any, filterIdentity?: (entities: any[]) => any[]): Promise<any[]>;
}
