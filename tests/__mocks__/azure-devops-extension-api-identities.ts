export const IdentityServiceIds = {
    IdentityService: 'ms.vss-features.identity-service',
} as const;

export type IVssIdentityService = {
    searchIdentitiesAsync(query: string): Promise<{ entityId: string; [key: string]: any }[]>;
};
