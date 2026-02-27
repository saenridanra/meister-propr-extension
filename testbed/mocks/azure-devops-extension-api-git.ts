/**
 * Testbed mock for azure-devops-extension-api/Git.
 * Exports the minimum surface used by review.ts.
 */

export class GitRestClient {}

// Mirrors the real PullRequestStatus enum values
export enum PullRequestStatus {
    NotSet    = 0,
    Active    = 1,
    Abandoned = 2,
    Completed = 3,
    All       = 4,
}
