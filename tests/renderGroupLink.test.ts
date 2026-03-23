/**
 * @jest-environment jsdom
 */
import { renderJobsGroups } from '../src/review/reviewGroups';
import type { ReviewListItem } from '../src/api/models';

function makeJob(overrides: Partial<ReviewListItem> = {}): ReviewListItem {
    return {
        jobId: 'job-1',
        status: 'completed',
        organizationUrl: 'https://dev.azure.com/myorg',
        projectId: 'proj-1',
        repositoryId: 'repo-1',
        pullRequestId: 42,
        iterationId: 3,
        submittedAt: '2026-03-23T10:00:00Z',
        completedAt: '2026-03-23T10:01:00Z',
        ...overrides,
    };
}

const repoMap = new Map([['repo-1', 'my-repo']]);

// ── US2: PR number link rendering ──────────────────────────────────────────

describe('renderJobsGroups — PR link rendering (US2)', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
    });

    test('renders a .pr-group-link <a> with correct href when organizationUrl is non-empty', () => {
        renderJobsGroups(container, [makeJob()], repoMap);
        const link = container.querySelector<HTMLAnchorElement>('a.pr-group-link');
        expect(link).not.toBeNull();
        expect(link!.href).toContain('pullrequest/42');
        expect(link!.href).toContain('proj-1');
        expect(link!.target).toBe('_blank');
    });

    test('renders NO .pr-group-link <a> when organizationUrl is empty string', () => {
        renderJobsGroups(container, [makeJob({ organizationUrl: '' })], repoMap);
        const link = container.querySelector('a.pr-group-link');
        expect(link).toBeNull();
    });

    test('renders pr number as plain text span when organizationUrl is empty', () => {
        renderJobsGroups(container, [makeJob({ organizationUrl: '' })], repoMap);
        const header = container.querySelector('.pr-group-header');
        expect(header?.textContent).toContain('#42');
    });
});

// ── US3: Empty state rendering ─────────────────────────────────────────────

describe('renderJobsGroups — empty state (US3)', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
    });

    test('renders .jobs-empty with correct message when jobs is empty', () => {
        renderJobsGroups(container, [], new Map());
        const empty = container.querySelector('.jobs-empty');
        expect(empty).not.toBeNull();
        expect(empty!.textContent).toBe('No reviews submitted yet.');
    });

    test('renders no .pr-group elements when jobs is empty', () => {
        renderJobsGroups(container, [], new Map());
        expect(container.querySelectorAll('.pr-group')).toHaveLength(0);
    });
});
