import * as SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import { GitRestClient, GitPullRequestSearchCriteria, PullRequestStatus } from 'azure-devops-extension-api/Git';
import { loadSettings } from '../common/extensionSettings';
import { submitReview, getReviewStatus, listReviews } from '../api/reviewClient';
import type { ReviewComment, ReviewListItem, ReviewRequest } from '../api/models';
import './review.css';

function el<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}
function show(element: HTMLElement): void { element.style.display = ''; }
function hide(element: HTMLElement): void { element.style.display = 'none'; }

function severityLabel(severity: ReviewComment['severity']): string {
    const map: Record<ReviewComment['severity'], string> = {
        info:       'Info',
        warning:    'Warning',
        error:      'Error',
        suggestion: 'Suggestion',
    };
    return map[severity] ?? severity;
}

function renderCommentRow(comment: ReviewComment): HTMLTableRowElement {
    const tr = document.createElement('tr');
    tr.setAttribute('data-severity', comment.severity);
    const cells = [
        comment.filePath   ?? '(general)',
        comment.lineNumber != null ? String(comment.lineNumber) : '—',
        severityLabel(comment.severity),
        comment.message,
    ];
    for (const text of cells) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
    }
    return tr;
}

function formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString();
}

function renderJobsTable(
    tbody: HTMLTableSectionElement,
    jobs: ReviewListItem[],
    repoNameMap: Map<string, string>,
): void {
    tbody.innerHTML = '';
    if (!jobs.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.textContent = 'No reviews submitted yet.';
        td.style.textAlign = 'center';
        td.style.color = '#666';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    for (const job of jobs) {
        const tr = document.createElement('tr');

        const prTd = document.createElement('td');
        prTd.textContent = `#${job.pullRequestId}`;

        const repoTd = document.createElement('td');
        repoTd.textContent = repoNameMap.get(job.repositoryId) ?? job.repositoryId;

        const statusTd = document.createElement('td');
        statusTd.textContent = job.status;
        statusTd.setAttribute('data-status', job.status);

        const submittedTd = document.createElement('td');
        submittedTd.textContent = formatTime(job.submittedAt);

        const completedTd = document.createElement('td');
        completedTd.textContent = formatTime(job.completedAt);

        const actionsTd = document.createElement('td');
        if (job.status === 'completed' || job.status === 'failed') {
            const btn = document.createElement('button');
            btn.className = 'btn-link';
            btn.setAttribute('data-job-id', job.jobId);
            btn.textContent = job.status === 'completed' ? 'View results' : 'View error';
            actionsTd.appendChild(btn);
        }

        tr.append(prTd, repoTd, statusTd, submittedTd, completedTd, actionsTd);
        tbody.appendChild(tr);
    }
}

const JOBS_REFRESH_MS = 5_000;

interface PrItem {
    pullRequestId: number;
    title: string;
}

async function main(): Promise<void> {
    await SDK.init({ loaded: false });

    const configWarning  = el<HTMLDivElement>('config-warning');
    const inputSection   = el<HTMLDivElement>('input-section');
    const repoSelect     = el<HTMLSelectElement>('repo-select');
    const prSearch       = el<HTMLInputElement>('pr-search');
    const prDropdown     = el<HTMLUListElement>('pr-dropdown');
    const reviewBtn      = el<HTMLButtonElement>('review-btn');
    const loadingDiv     = el<HTMLDivElement>('loading');
    const resultsSection = el<HTMLDivElement>('results-section');
    const resultsContext = el<HTMLParagraphElement>('results-context');
    const reviewSummary  = el<HTMLDivElement>('review-summary');
    const resultsBody    = el<HTMLTableSectionElement>('results-body');
    const errorDiv       = el<HTMLDivElement>('error-message');
    const jobsSection    = el<HTMLDivElement>('jobs-section');
    const jobsBody       = el<HTMLTableSectionElement>('jobs-body');

    const settings = await loadSettings();
    const { backendUrl, clientKey } = settings;

    if (!backendUrl || !clientKey) {
        show(configWarning);
        hide(inputSection);
        SDK.notifyLoadSucceeded();
        return;
    }

    // --- ADO context ---
    const pageContext = SDK.getPageContext();
    const orgName     = SDK.getHost().name;
    const orgUrl      = `https://dev.azure.com/${orgName}/`;
    const projectId   = pageContext.webContext.project.id;
    const gitClient   = getClient(GitRestClient);

    // Repo ID → name map (used by the jobs table)
    const repoNameMap = new Map<string, string>();

    // --- Populate repository dropdown ---
    try {
        const repos = await gitClient.getRepositories(projectId);
        for (const repo of repos ?? []) {
            if (!repo.id || !repo.name) continue;
            repoNameMap.set(repo.id, repo.name);
            const opt = document.createElement('option');
            opt.value    = repo.id;
            opt.textContent = repo.name;
            repoSelect.appendChild(opt);
        }
        if (repos?.length === 1 && repos[0].id) {
            repoSelect.value = repos[0].id;
            prSearch.disabled     = false;
            prSearch.placeholder  = 'Type to search pull requests…';
        }
    } catch {
        // Repo list is informational; continue without it
    }

    let selectedPrId: number | null = null;
    let prCache: PrItem[] | null    = null;
    let prCacheRepoId: string | null = null;
    let dropdownFocusIndex = -1;
    let prSearchDebounce: ReturnType<typeof setTimeout> | undefined;

    function getDropdownItems(): HTMLElement[] {
        return Array.from(prDropdown.querySelectorAll<HTMLElement>('li[data-pr-id]'));
    }

    function openDropdown(): void  { prDropdown.hidden = false; }
    function closeDropdown(): void { prDropdown.hidden = true; dropdownFocusIndex = -1; }

    function updateDropdownFocus(): void {
        const items = getDropdownItems();
        items.forEach((item, i) => item.classList.toggle('autocomplete-focused', i === dropdownFocusIndex));
        if (dropdownFocusIndex >= 0) {
            items[dropdownFocusIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    function selectPr(prId: number, title: string): void {
        selectedPrId    = prId;
        prSearch.value  = `#${prId} — ${title}`;
        closeDropdown();
    }

    function renderDropdownItems(items: PrItem[], isLoading: boolean): void {
        prDropdown.innerHTML = '';
        dropdownFocusIndex   = -1;

        if (isLoading) {
            const li = document.createElement('li');
            li.className   = 'autocomplete-status';
            li.textContent = 'Loading pull requests…';
            prDropdown.appendChild(li);
            openDropdown();
            return;
        }

        if (!items.length) {
            const li = document.createElement('li');
            li.className   = 'autocomplete-status';
            li.textContent = 'No matching pull requests';
            prDropdown.appendChild(li);
            openDropdown();
            return;
        }

        for (const pr of items) {
            const li = document.createElement('li');
            li.setAttribute('data-pr-id',    String(pr.pullRequestId));
            li.setAttribute('data-pr-title', pr.title);
            li.textContent = `#${pr.pullRequestId} — ${pr.title}`;
            li.addEventListener('mousedown', (e) => {
                e.preventDefault(); // keep input focused; prevents blur before click
                selectPr(pr.pullRequestId, pr.title);
            });
            prDropdown.appendChild(li);
        }
        openDropdown();
    }

    async function filterAndRender(query: string): Promise<void> {
        const repoId = repoSelect.value;
        if (!repoId) return;

        // Fetch once per repo selection; cache client-side
        if (prCacheRepoId !== repoId || prCache === null) {
            renderDropdownItems([], true);
            prCache       = [];
            prCacheRepoId = repoId;
            try {
                const sc  = { status: PullRequestStatus.Active } as unknown as GitPullRequestSearchCriteria;
                const raw = await gitClient.getPullRequests(repoId, sc, projectId);
                for (const pr of raw ?? []) {
                    if (pr.pullRequestId != null) {
                        prCache.push({
                            pullRequestId: pr.pullRequestId,
                            title: pr.title ?? `PR #${pr.pullRequestId}`,
                        });
                    }
                }
            } catch {
                // Empty cache; will show "No matching pull requests"
            }
        }

        const q        = query.toLowerCase().trim();
        const filtered = q
            ? prCache.filter(pr =>
                String(pr.pullRequestId).includes(q) ||
                pr.title.toLowerCase().includes(q))
            : prCache;
        renderDropdownItems(filtered, false);
    }

    // Open on focus (lazy-load if needed)
    prSearch.addEventListener('focus', () => filterAndRender(prSearch.value));

    // Debounced filter on typing
    prSearch.addEventListener('input', () => {
        selectedPrId = null; // typed text ≠ confirmed selection
        clearTimeout(prSearchDebounce);
        prSearchDebounce = setTimeout(() => filterAndRender(prSearch.value), 300);
    });

    // Close on blur (delay allows mousedown on items to fire first)
    prSearch.addEventListener('blur', () => setTimeout(closeDropdown, 150));

    // Keyboard navigation
    prSearch.addEventListener('keydown', (e: KeyboardEvent) => {
        const items = getDropdownItems();

        if (prDropdown.hidden) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') filterAndRender(prSearch.value);
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                dropdownFocusIndex = Math.min(dropdownFocusIndex + 1, items.length - 1);
                updateDropdownFocus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                dropdownFocusIndex = Math.max(dropdownFocusIndex - 1, 0);
                updateDropdownFocus();
                break;
            case 'Enter':
                e.preventDefault();
                if (dropdownFocusIndex >= 0) {
                    const item  = items[dropdownFocusIndex];
                    const prId  = parseInt(item.getAttribute('data-pr-id')!,  10);
                    const title = item.getAttribute('data-pr-title') ?? '';
                    selectPr(prId, title);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeDropdown();
                break;
        }
    });

    // Reset PR state when repo changes
    repoSelect.addEventListener('change', () => {
        selectedPrId = null;
        prSearch.value = '';
        closeDropdown();
        prDropdown.innerHTML = '';
        const hasRepo        = !!repoSelect.value;
        prSearch.disabled    = !hasRepo;
        prSearch.placeholder = hasRepo ? 'Type to search pull requests…' : 'Select a repository first';
    });

    async function doRefreshJobs(): Promise<void> {
        try {
            const jobList = await listReviews(backendUrl!, clientKey!);
            renderJobsTable(jobsBody, jobList, repoNameMap);
        } catch {
            // Non-critical — backend may be temporarily unreachable
        }
    }

    // View job details via event delegation (buttons are re-created on each refresh)
    jobsBody.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-job-id]');
        if (btn) onViewJobDetails(btn.getAttribute('data-job-id')!);
    });

    async function onViewJobDetails(jobId: string): Promise<void> {
        try {
            const response = await getReviewStatus(backendUrl!, clientKey!, jobId);
            hide(errorDiv);

            if (response.status === 'completed' && response.result) {
                const repoName = repoNameMap.get(response.repositoryId) ?? response.repositoryId;
                resultsContext.textContent =
                    `PR #${response.pullRequestId} · ${repoName} · viewed at ${formatTime(new Date().toISOString())}`;
                reviewSummary.textContent = response.result.summary;
                resultsBody.innerHTML = '';
                for (const comment of response.result.comments) {
                    resultsBody.appendChild(renderCommentRow(comment));
                }
                show(resultsSection);
                resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else if (response.status === 'failed') {
                errorDiv.textContent = `Review failed: ${response.error ?? 'Unknown error on the server.'}`;
                show(errorDiv);
            }
        } catch (err) {
            errorDiv.textContent = `Could not load job details: ${(err as Error).message}`;
            show(errorDiv);
        }
    }

    // Start continuous background polling immediately
    await doRefreshJobs();
    show(jobsSection);
    setInterval(doRefreshJobs, JOBS_REFRESH_MS);

    reviewBtn.addEventListener('click', async () => {
        hide(errorDiv);

        const repoId = repoSelect.value;
        if (!repoId) {
            errorDiv.textContent = 'Please select a repository.';
            show(errorDiv);
            return;
        }
        if (!selectedPrId) {
            errorDiv.textContent = 'Please select a pull request from the list.';
            show(errorDiv);
            return;
        }
        const prId = selectedPrId;

        reviewBtn.disabled      = true;
        loadingDiv.textContent  = 'Submitting review…';
        show(loadingDiv);

        try {
            const [iterations, adoToken] = await Promise.all([
                gitClient.getPullRequestIterations(repoId, prId, projectId),
                SDK.getAccessToken(),
            ]);

            const latestIteration = iterations?.at(-1);
            if (!latestIteration?.id) {
                throw new Error('Could not determine the latest PR iteration.');
            }

            const request: ReviewRequest = {
                organizationUrl: orgUrl,
                projectId,
                repositoryId:    repoId,
                pullRequestId:   prId,
                iterationId:     latestIteration.id,
            };

            await submitReview(backendUrl!, clientKey!, adoToken, request);
            // Immediate refresh so the new job appears without waiting for the next tick
            await doRefreshJobs();
            jobsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (err) {
            errorDiv.textContent = `Failed to submit review: ${(err as Error).message}`;
            show(errorDiv);
        } finally {
            hide(loadingDiv);
            reviewBtn.disabled = false;
        }
    });

    SDK.notifyLoadSucceeded();
}

main();
