import type { ReviewListItem } from '../api/models';

export interface PrGroup {
    /** Stable group identity: `${orgUrl}|${projectId}|${repoId}|${prId}` */
    key: string;
    pullRequestId: number;
    repoName: string;
    prUrl: string | null;
    entries: ReviewListItem[];
    latestActivity: string | null;
}

export function buildPrGroups(
    jobs: ReviewListItem[],
    repoNameMap: Map<string, string>,
): PrGroup[] {
    const groupMap = new Map<string, PrGroup>();

    for (const job of jobs) {
        const key = `${job.organizationUrl}|${job.projectId}|${job.repositoryId}|${job.pullRequestId}`;

        if (!groupMap.has(key)) {
            const orgUrl = job.organizationUrl?.replace(/\/$/, '') ?? '';
            const prUrl = orgUrl && job.projectId
                ? `${orgUrl}/${job.projectId}/_git/${job.repositoryId}/pullrequest/${job.pullRequestId}`
                : null;

            groupMap.set(key, {
                key,
                pullRequestId: job.pullRequestId,
                repoName: repoNameMap.get(job.repositoryId) ?? job.repositoryId,
                prUrl,
                entries: [],
                latestActivity: null,
            });
        }

        const group = groupMap.get(key)!;
        group.entries.push(job);

        if (job.completedAt) {
            if (!group.latestActivity || job.completedAt > group.latestActivity) {
                group.latestActivity = job.completedAt;
            }
        }
    }

    // Sort entries within each group: null completedAt first, then newest completedAt first
    for (const group of groupMap.values()) {
        group.entries.sort((a, b) => {
            if (a.completedAt === null && b.completedAt === null) return 0;
            if (a.completedAt === null) return -1;
            if (b.completedAt === null) return 1;
            return b.completedAt < a.completedAt ? -1 : b.completedAt > a.completedAt ? 1 : 0;
        });
    }

    // Sort groups by latestActivity descending (null last)
    return Array.from(groupMap.values()).sort((a, b) => {
        if (a.latestActivity === null && b.latestActivity === null) return 0;
        if (a.latestActivity === null) return 1;
        if (b.latestActivity === null) return -1;
        return b.latestActivity < a.latestActivity ? -1 : b.latestActivity > a.latestActivity ? 1 : 0;
    });
}

export function formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString();
}

export function renderJobsGroups(
    container: HTMLElement,
    jobs: ReviewListItem[],
    repoNameMap: Map<string, string>,
    expandedGroups: Set<string> = new Set(),
    filterText = '',
): void {
    const savedScroll = container.scrollTop;
    container.innerHTML = '';

    const allGroups = buildPrGroups(jobs, repoNameMap);
    const filter = filterText.trim();
    const groups = filter
        ? allGroups.filter(g => String(g.pullRequestId).includes(filter))
        : allGroups;

    if (!groups.length) {
        const p = document.createElement('p');
        p.className = 'jobs-empty';
        p.textContent = allGroups.length
            ? 'No PRs match the filter.'
            : 'No reviews submitted yet.';
        container.appendChild(p);
        container.scrollTop = savedScroll;
        return;
    }

    for (const group of groups) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'pr-group';

        // Header
        const header = document.createElement('div');
        header.className = 'pr-group-header';

        if (group.prUrl) {
            const link = document.createElement('a');
            link.className = 'pr-group-link';
            link.href = group.prUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `#${group.pullRequestId}`;
            header.appendChild(link);
        } else {
            const prSpan = document.createElement('span');
            prSpan.textContent = `#${group.pullRequestId}`;
            header.appendChild(prSpan);
        }

        const repoSpan = document.createElement('span');
        repoSpan.className = 'pr-group-repo';
        repoSpan.textContent = group.repoName;
        header.appendChild(repoSpan);
        groupDiv.appendChild(header);

        // Entry table
        const table = document.createElement('table');
        table.className = 'pr-group-table';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        for (const col of ['Iteration', 'Status', 'Submitted', 'Completed', 'Actions']) {
            const th = document.createElement('th');
            th.textContent = col;
            headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const extraRows: HTMLTableRowElement[] = [];
        const isExpanded = expandedGroups.has(group.key);

        for (let i = 0; i < group.entries.length; i++) {
            const job = group.entries[i];
            const tr = document.createElement('tr');

            const iterTd = document.createElement('td');
            iterTd.textContent = String(job.iterationId);

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

            tr.append(iterTd, statusTd, submittedTd, completedTd, actionsTd);
            tbody.appendChild(tr);

            if (i > 0) {
                if (!isExpanded) tr.style.display = 'none';
                extraRows.push(tr);
            }
        }

        table.appendChild(tbody);
        groupDiv.appendChild(table);

        // Expand/collapse toggle for groups with more than one entry
        if (extraRows.length > 0) {
            const toggle = document.createElement('button');
            toggle.className = 'btn-link pr-group-toggle';
            const count = extraRows.length;
            const label = (expanded: boolean) =>
                expanded ? '▲ Show less' : `▼ ${count} more iteration${count > 1 ? 's' : ''}`;
            toggle.textContent = label(isExpanded);
            toggle.addEventListener('click', () => {
                const nowExpanded = !expandedGroups.has(group.key);
                if (nowExpanded) {
                    expandedGroups.add(group.key);
                } else {
                    expandedGroups.delete(group.key);
                }
                extraRows.forEach(r => { r.style.display = nowExpanded ? '' : 'none'; });
                toggle.textContent = label(nowExpanded);
            });
            groupDiv.appendChild(toggle);
        }

        container.appendChild(groupDiv);
    }

    container.scrollTop = savedScroll;
}
