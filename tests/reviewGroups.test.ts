import { buildPrGroups } from '../src/review/reviewGroups';
import type { ReviewListItem } from '../src/api/models';

function makeJob(overrides: Partial<ReviewListItem>): ReviewListItem {
    return {
        jobId: 'job-1',
        status: 'completed',
        organizationUrl: 'https://dev.azure.com/myorg',
        projectId: 'proj-1',
        repositoryId: 'repo-1',
        pullRequestId: 42,
        iterationId: 1,
        submittedAt: '2026-03-23T10:00:00Z',
        completedAt: '2026-03-23T10:01:00Z',
        ...overrides,
    };
}

const repoMap = new Map([['repo-1', 'my-repo'], ['repo-2', 'other-repo']]);

describe('buildPrGroups — US1 render preconditions', () => {
    // T004: verify PrGroup shape that renderJobsGroups() will consume
    test('3 jobs across 2 PRs produces 2 groups with correct shape', () => {
        const jobs = [
            makeJob({ jobId: 'a', pullRequestId: 1, repositoryId: 'repo-1', completedAt: '2026-03-23T10:02:00Z' }),
            makeJob({ jobId: 'b', pullRequestId: 1, repositoryId: 'repo-1', completedAt: '2026-03-23T10:01:00Z' }),
            makeJob({ jobId: 'c', pullRequestId: 2, repositoryId: 'repo-2', completedAt: '2026-03-23T09:00:00Z' }),
        ];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups).toHaveLength(2);

        const pr1 = groups.find(g => g.pullRequestId === 1)!;
        expect(pr1.repoName).toBe('my-repo');
        expect(pr1.entries).toHaveLength(2);
        // newest first
        expect(pr1.entries[0].jobId).toBe('a');
        expect(pr1.entries[1].jobId).toBe('b');

        const pr2 = groups.find(g => g.pullRequestId === 2)!;
        expect(pr2.repoName).toBe('other-repo');
        expect(pr2.entries).toHaveLength(1);
    });
});

describe('buildPrGroups', () => {
    // (a) empty input
    test('returns [] for empty jobs array', () => {
        expect(buildPrGroups([], repoMap)).toEqual([]);
    });

    // (b) single PR, single entry
    test('produces one group for a single entry', () => {
        const jobs = [makeJob({})];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups).toHaveLength(1);
        expect(groups[0].pullRequestId).toBe(42);
        expect(groups[0].entries).toHaveLength(1);
    });

    // (c) two entries for same PR → one group, newest first
    test('groups two entries for the same PR into one group with entries newest first', () => {
        const jobs = [
            makeJob({ jobId: 'job-1', completedAt: '2026-03-23T10:02:00Z', iterationId: 2 }),
            makeJob({ jobId: 'job-2', completedAt: '2026-03-23T10:01:00Z', iterationId: 1 }),
        ];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups).toHaveLength(1);
        expect(groups[0].entries).toHaveLength(2);
        // newest first: job-1 before job-2
        expect(groups[0].entries[0].jobId).toBe('job-1');
        expect(groups[0].entries[1].jobId).toBe('job-2');
    });

    // (d) three different PRs → three groups, ordered by most-recent activity
    test('produces three groups ordered by most recent activity descending', () => {
        const jobs = [
            makeJob({ jobId: 'pr10-j1', pullRequestId: 10, completedAt: '2026-03-23T09:00:00Z' }),
            makeJob({ jobId: 'pr20-j1', pullRequestId: 20, completedAt: '2026-03-23T11:00:00Z' }),
            makeJob({ jobId: 'pr30-j1', pullRequestId: 30, completedAt: '2026-03-23T10:00:00Z' }),
        ];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups).toHaveLength(3);
        expect(groups[0].pullRequestId).toBe(20); // most recent
        expect(groups[1].pullRequestId).toBe(30);
        expect(groups[2].pullRequestId).toBe(10); // oldest
    });

    // (e) prUrl is constructed correctly
    test('constructs prUrl with correct ADO PR path', () => {
        const jobs = [makeJob({ organizationUrl: 'https://dev.azure.com/myorg', projectId: 'proj-1', repositoryId: 'repo-1', pullRequestId: 42 })];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].prUrl).toBe('https://dev.azure.com/myorg/proj-1/_git/repo-1/pullrequest/42');
    });

    // (e) trailing slash in orgUrl is normalised
    test('normalises trailing slash in organizationUrl when constructing prUrl', () => {
        const jobs = [makeJob({ organizationUrl: 'https://dev.azure.com/myorg/', projectId: 'proj-1', repositoryId: 'repo-1', pullRequestId: 7 })];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].prUrl).toBe('https://dev.azure.com/myorg/proj-1/_git/repo-1/pullrequest/7');
    });

    // (f) prUrl is null when organizationUrl is empty
    test('sets prUrl to null when organizationUrl is empty string', () => {
        const jobs = [makeJob({ organizationUrl: '' })];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].prUrl).toBeNull();
    });

    // (f) prUrl is null when projectId is empty
    test('sets prUrl to null when projectId is empty string', () => {
        const jobs = [makeJob({ projectId: '' })];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].prUrl).toBeNull();
    });

    // (g) repoName falls back to repositoryId
    test('falls back to repositoryId when repositoryId is not in repoNameMap', () => {
        const jobs = [makeJob({ repositoryId: 'unknown-repo-id' })];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].repoName).toBe('unknown-repo-id');
    });

    // (g) repoName resolved from repoNameMap
    test('resolves repoName from repoNameMap', () => {
        const jobs = [makeJob({ repositoryId: 'repo-2' })];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].repoName).toBe('other-repo');
    });

    // (h) null completedAt entries sort before non-null (most recent activity)
    test('places entries with null completedAt before completed entries within the same group', () => {
        const jobs = [
            makeJob({ jobId: 'pending', status: 'pending', completedAt: null }),
            makeJob({ jobId: 'done', status: 'completed', completedAt: '2026-03-23T10:01:00Z' }),
        ];
        const groups = buildPrGroups(jobs, repoMap);
        expect(groups[0].entries[0].jobId).toBe('pending');
        expect(groups[0].entries[1].jobId).toBe('done');
    });
});
