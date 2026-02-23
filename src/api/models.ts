export interface ReviewRequest {
    organizationUrl: string;
    projectId: string;
    repositoryId: string;
    pullRequestId: number;
    iterationId: number;
}

export interface ReviewJob {
    jobId: string;
}

export type ReviewJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ReviewListItem {
    jobId: string;
    status: ReviewJobStatus;
    organizationUrl: string;
    projectId: string;
    repositoryId: string;
    pullRequestId: number;
    iterationId: number;
    submittedAt: string;
    completedAt: string | null;
}

export interface ReviewComment {
    filePath?: string;
    lineNumber?: number;
    severity: 'info' | 'warning' | 'error' | 'suggestion';
    message: string;
}

export interface ReviewResult {
    summary: string;
    comments: ReviewComment[];
}

export interface ReviewStatusResponse extends ReviewListItem {
    result?: ReviewResult;
    error?: string;
}
