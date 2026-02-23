import * as SDK from 'azure-devops-extension-sdk';
import { getClient } from 'azure-devops-extension-api';
import { GitRestClient } from 'azure-devops-extension-api/Git';
import { loadSettings } from '../common/extensionSettings';
import { submitReview, getReviewStatus } from '../api/reviewClient';
import type { ReviewComment, ReviewRequest, ReviewResult } from '../api/models';
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

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS  = 5 * 60_000;

async function pollReview(
    backendUrl: string,
    clientKey: string,
    jobId: string,
    statusEl: HTMLElement,
): Promise<ReviewResult> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (true) {
        if (Date.now() > deadline) {
            throw new Error('Review timed out after 5 minutes. Please try again.');
        }
        const { status, result, error } = await getReviewStatus(backendUrl, clientKey, jobId);
        if (status === 'completed' && result) return result;
        if (status === 'failed') throw new Error(error ?? 'Review failed on the server.');
        statusEl.textContent = status === 'processing' ? 'Agent is reviewing your code…' : 'Waiting for agent…';
        await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

async function main(): Promise<void> {
    await SDK.init({ loaded: false });

    const configWarning  = el<HTMLDivElement>('config-warning');
    const inputSection   = el<HTMLDivElement>('input-section');
    const repoSelect     = el<HTMLSelectElement>('repo-select');
    const prIdInput      = el<HTMLInputElement>('pr-id');
    const reviewBtn      = el<HTMLButtonElement>('review-btn');
    const loadingDiv     = el<HTMLDivElement>('loading');
    const resultsSection = el<HTMLDivElement>('results-section');
    const reviewSummary  = el<HTMLDivElement>('review-summary');
    const resultsBody    = el<HTMLTableSectionElement>('results-body');
    const errorDiv       = el<HTMLDivElement>('error-message');

    const settings = await loadSettings();
    const { backendUrl, clientKey } = settings;

    if (!backendUrl || !clientKey) {
        show(configWarning);
        hide(inputSection);
        SDK.notifyLoadSucceeded();
        return;
    }

    const pageContext    = SDK.getPageContext();

    const orgName = SDK.getHost().name;
    // Construction (Works for most cloud scenarios)
    const orgUrl = `https://dev.azure.com/${orgName}/`;
    const projectId       = pageContext.webContext.project.id;
    const gitClient       = getClient(GitRestClient);

    // Populate repository dropdown (best-effort)
    try {
        const repos = await gitClient.getRepositories(projectId);
        for (const repo of repos ?? []) {
            if (!repo.id || !repo.name) continue;
            const opt = document.createElement('option');
            opt.value = repo.id;
            opt.textContent = repo.name;
            repoSelect.appendChild(opt);
        }
        if (repos?.length === 1 && repos[0].id) {
            repoSelect.value = repos[0].id;
        }
    } catch {
        // Repo list is informational; continue without it
    }

    reviewBtn.addEventListener('click', async () => {
        hide(errorDiv);
        hide(resultsSection);
        errorDiv.textContent = '';
        reviewSummary.textContent = '';
        resultsBody.innerHTML = '';

        const prId   = parseInt(prIdInput.value.trim(), 10);
        const repoId = repoSelect.value;

        if (isNaN(prId) || prId <= 0) {
            errorDiv.textContent = 'Please enter a valid Pull Request ID.';
            show(errorDiv);
            return;
        }
        if (!repoId) {
            errorDiv.textContent = 'Please select a repository.';
            show(errorDiv);
            return;
        }

        reviewBtn.disabled = true;
        loadingDiv.textContent = 'Submitting review…';
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
                organizationUrl,
                projectId,
                repositoryId: repoId,
                pullRequestId: prId,
                iterationId: latestIteration.id,
            };

            const job = await submitReview(backendUrl!, clientKey!, adoToken, request);
            const result = await pollReview(backendUrl!, clientKey!, job.jobId, loadingDiv);

            reviewSummary.textContent = result.summary;
            for (const comment of result.comments) {
                resultsBody.appendChild(renderCommentRow(comment));
            }
            show(resultsSection);
        } catch (err) {
            errorDiv.textContent = `Review failed: ${(err as Error).message}`;
            show(errorDiv);
        } finally {
            hide(loadingDiv);
            reviewBtn.disabled = false;
        }
    });

    SDK.notifyLoadSucceeded();
}

main();
