import axios from 'axios';
import type { ReviewJob, ReviewListItem, ReviewRequest, ReviewStatusResponse } from './models';

export async function submitReview(
    backendUrl: string,
    clientKey: string,
    adoToken: string,
    request: ReviewRequest,
): Promise<ReviewJob> {
    const base = backendUrl.replace(/\/$/, '');
    const response = await axios.post<ReviewJob>(`${base}/reviews`, request, {
        headers: {
            'X-Client-Key': clientKey,
            'X-Ado-Token':  adoToken,
            'Content-Type': 'application/json',
        },
    });
    return response.data;
}

export async function getReviewStatus(
    backendUrl: string,
    clientKey: string,
    jobId: string,
): Promise<ReviewStatusResponse> {
    const base = backendUrl.replace(/\/$/, '');
    const response = await axios.get<ReviewStatusResponse>(`${base}/reviews/${jobId}`, {
        headers: { 'X-Client-Key': clientKey },
    });
    return response.data;
}

export async function listReviews(
    backendUrl: string,
    clientKey: string,
): Promise<ReviewListItem[]> {
    const base = backendUrl.replace(/\/$/, '');
    const response = await axios.get<ReviewListItem[]>(`${base}/reviews`, {
        headers: { 'X-Client-Key': clientKey },
    });
    return response.data;
}
