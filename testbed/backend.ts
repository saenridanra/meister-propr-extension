/**
 * Meister ProPR — dummy backend server for local testbed.
 *
 * Implements the full /reviews API contract (openapi.json) without any AI or
 * ADO calls. Jobs progress through pending → processing → completed (or failed)
 * on a timer so the full polling flow in the extension can be exercised.
 *
 * Serves HTTPS by default. A self-signed certificate is generated on first run
 * and persisted to localhost-cert.pem / localhost-key.pem in this directory.
 * The certificate is reused until fewer than 30 days remain, then regenerated.
 *
 * Configuration (environment variables):
 *
 *   PORT            Port to listen on.                  Default: 31001
 *   CLIENT_KEY      Accepted X-Client-Key value.        Default: test-client-key
 *   SIMULATE        Review outcome: "success" | "fail"  Default: success
 *   DELAY_MS        Total ms before job completes.      Default: 6000
 *   HTTP_ONLY       Disable HTTPS (plain HTTP).         Default: false
 *
 * Usage (from the testbed/ directory):
 *   npm run backend
 *
 * Then configure the extension Settings hub with:
 *   Backend URL:  https://localhost:31001   (or http:// when HTTP_ONLY=true)
 *   Client key:   test-client-key
 *
 * One-time browser step for HTTPS (self-signed cert is not CA-trusted):
 *   1. Open https://localhost:31001 directly in the same browser tab.
 *   2. Click Advanced → Proceed to localhost (unsafe).
 *   3. Return to the extension page and retry.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import {randomUUID, X509Certificate} from 'crypto';
import selfsigned from 'selfsigned';
import type {IncomingMessage, ServerResponse} from 'http';

const PORT = parseInt(process.env['PORT'] ?? '31001', 10);
const CLIENT_KEY = process.env['CLIENT_KEY'] ?? 'test-client-key';
const SIMULATE = process.env['SIMULATE'] ?? 'success';   // 'success' | 'fail'
const DELAY_MS = parseInt(process.env['DELAY_MS'] ?? '6000', 10);
const HTTP_ONLY = process.env['HTTP_ONLY'] === 'true';

const CERT_FILE = path.join(__dirname, 'localhost-cert.pem');
const KEY_FILE = path.join(__dirname, 'localhost-key.pem');
const RENEW_BEFORE_DAYS = 30;

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ReviewComment {
    filePath: string | null;
    lineNumber: number | null;
    severity: 'error' | 'warning' | 'suggestion' | 'info';
    message: string;
}

interface ReviewResult {
    summary: string;
    comments: ReviewComment[];
}

interface Job {
    jobId: string;
    status: JobStatus;
    organizationUrl: string;
    projectId: string;
    repositoryId: string;
    pullRequestId: number;
    iterationId: number;
    submittedAt: string;
    completedAt: string | null;
    result: ReviewResult | null;
    error: string | null;
}

interface ReviewRequest {
    organizationUrl: string;
    projectId: string;
    repositoryId: string;
    pullRequestId: number;
    iterationId: number;
}

const jobs = new Map<string, Job>();

const MOCK_SUCCESS_RESULT: ReviewResult = {
    summary:
        'Overall this PR is well-structured and the intent is clear. There are a few issues ' +
        'worth addressing before merging — one potential runtime error, a security concern, ' +
        'and a couple of suggestions to improve maintainability.',
    comments: [
        {
            filePath: 'src/auth/login.ts',
            lineNumber: 42,
            severity: 'error',
            message: 'Unhandled promise rejection: the async call on this line lacks a try/catch. ' +
                'If the network request fails, the error will be swallowed silently.',
        },
        {
            filePath: 'src/auth/login.ts',
            lineNumber: 67,
            severity: 'warning',
            message: 'Sensitive data (access token) is written to the console on this line. ' +
                'Remove or guard behind a debug flag before deploying to production.',
        },
        {
            filePath: 'src/components/UserProfile.tsx',
            lineNumber: 15,
            severity: 'suggestion',
            message: 'This component re-renders on every parent update. ' +
                'Wrapping it with React.memo() would avoid unnecessary renders when props have not changed.',
        },
        {
            filePath: 'src/utils/formatDate.ts',
            lineNumber: null,
            severity: 'suggestion',
            message: 'Consider using Intl.DateTimeFormat instead of a hand-rolled date formatter — ' +
                'it handles locale and timezone differences automatically.',
        },
        {
            filePath: null,
            lineNumber: null,
            severity: 'info',
            message: 'Test coverage for the authentication module looks thorough. ' +
                'The new login flow is well-structured and the happy path is fully exercised.',
        },
    ],
};

const MOCK_FAIL_ERROR =
    'The AI agent could not complete the review: unable to retrieve the diff for pull request ' +
    '(simulated failure — set SIMULATE=success to test the success path).';

function scheduleJob(jobId: string): void {
    const processingDelay = Math.min(2000, DELAY_MS * 0.33);

    setTimeout(() => {
        const job = jobs.get(jobId);
        if (job) job.status = 'processing';
    }, processingDelay);

    setTimeout(() => {
        const job = jobs.get(jobId);
        if (!job) return;
        if (SIMULATE === 'fail') {
            job.status = 'failed';
            job.error = MOCK_FAIL_ERROR;
            job.completedAt = new Date().toISOString();
        } else {
            job.status = 'completed';
            job.result = MOCK_SUCCESS_RESULT;
            job.completedAt = new Date().toISOString();
        }
    }, DELAY_MS);
}

function makeJob(request: ReviewRequest): Job {
    const jobId = randomUUID();
    const job: Job = {
        jobId,
        status: 'pending',
        organizationUrl: request.organizationUrl,
        projectId: request.projectId,
        repositoryId: request.repositoryId,
        pullRequestId: request.pullRequestId,
        iterationId: request.iterationId,
        submittedAt: new Date().toISOString(),
        completedAt: null,
        result: null,
        error: null,
    };
    jobs.set(jobId, job);
    scheduleJob(jobId);
    return job;
}

function jobToListItem(job: Job): Omit<Job, 'result' | 'error'> {
    return {
        jobId: job.jobId,
        status: job.status,
        organizationUrl: job.organizationUrl,
        projectId: job.projectId,
        repositoryId: job.repositoryId,
        pullRequestId: job.pullRequestId,
        iterationId: job.iterationId,
        submittedAt: job.submittedAt,
        completedAt: job.completedAt,
    };
}

function jobToStatusResponse(job: Job) {
    return {...jobToListItem(job), result: job.result, error: job.error};
}

const ALLOWED_ORIGINS = [
    // Local testbed
    /^https?:\/\/localhost(:\d+)?$/,
    // Azure DevOps cloud (extension loaded inside dev.azure.com)
    /^https:\/\/([a-z0-9-]+\.)?dev\.azure\.com$/,
    // Visual Studio Online / legacy ADO domain
    /^https:\/\/([a-z0-9-]+\.)?visualstudio\.com$/,
    // Azure DevOps Gallery CDN — where published extension pages are served from
    /^https:\/\/[a-z0-9-]+\.gallerycdn\.vsassets\.io$/,
];

function isOriginAllowed(origin: string): boolean {
    return !!origin && ALLOWED_ORIGINS.some(re => re.test(origin));
}

function setCorsHeaders(res: ServerResponse, origin: string, isPreflight: boolean): void {
    const allowed = isOriginAllowed(origin) ? origin : 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Key, X-Ado-Token');
    res.setHeader('Vary', 'Origin');
    if (isPreflight) {
        res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}

function send(res: ServerResponse, status: number, body: unknown): void {
    const json = JSON.stringify(body, null, 2);
    res.writeHead(status, {'Content-Type': 'application/json'});
    res.end(json);
}

function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
    const key = req.headers['x-client-key'];
    if (key !== CLIENT_KEY) {
        send(res, 401, {error: `Invalid or missing X-Client-Key. Expected: "${CLIENT_KEY}"`});
        return false;
    }
    return true;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const origin = req.headers['origin'] ?? '';
    const isPreflight = req.method === 'OPTIONS';
    setCorsHeaders(res, origin, isPreflight);

    if (isPreflight) {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url!, `http://localhost:${PORT}`);

    // POST /reviews — submit a new review job
    if (req.method === 'POST' && url.pathname === '/reviews') {
        if (!checkAuth(req, res)) return;
        const body = await readBody(req);
        const required: (keyof ReviewRequest)[] = ['organizationUrl', 'projectId', 'repositoryId', 'pullRequestId', 'iterationId'];
        const missing = required.filter(k => body[k] == null);
        if (missing.length) {
            send(res, 422, {error: `Missing required fields: ${missing.join(', ')}`});
            return;
        }

        const job = makeJob(body as unknown as ReviewRequest);
        console.log(`[backend] Job created: ${job.jobId}  (PR #${job.pullRequestId}, simulate=${SIMULATE})`);
        send(res, 202, {jobId: job.jobId});
        return;
    }

    // GET /reviews — list all jobs
    if (req.method === 'GET' && url.pathname === '/reviews') {
        if (!checkAuth(req, res)) return;
        const list = [...jobs.values()]
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
            .map(jobToListItem);
        send(res, 200, list);
        return;
    }

    // GET /reviews/:jobId — poll a specific job
    const pollMatch = url.pathname.match(/^\/reviews\/([^/]+)$/);
    if (req.method === 'GET' && pollMatch) {
        if (!checkAuth(req, res)) return;
        const jobId = pollMatch[1]!;
        const job = jobs.get(jobId);
        if (!job) {
            send(res, 404, {error: `Job not found: ${jobId}`});
            return;
        }
        console.log(`[backend] Poll: ${jobId} → ${job.status}`);
        send(res, 200, jobToStatusResponse(job));
        return;
    }

    send(res, 404, {error: 'Not found'});
}

function loadOrGenerateCert(): { cert: string; key: string } {
    if (fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE)) {
        try {
            const certPem = fs.readFileSync(CERT_FILE, 'utf8');
            const cert = new X509Certificate(certPem);
            const validTo = new Date(cert.validTo);
            const renewAfter = new Date(Date.now() + RENEW_BEFORE_DAYS * 24 * 60 * 60 * 1000);

            if (validTo > renewAfter) {
                console.log(`  Certificate valid until ${validTo.toLocaleDateString()} — reusing.`);
                return {cert: certPem, key: fs.readFileSync(KEY_FILE, 'utf8')};
            }

            console.log(`  Certificate expires ${validTo.toLocaleDateString()} — regenerating.`);
        } catch {
            console.log('  Certificate unreadable — regenerating.');
        }
    }

    const pems = selfsigned.generate(
        [{name: 'commonName', value: 'localhost'}],
        {
            keySize: 2048,
            days: 365,
            algorithm: 'sha256',
            extensions: [
                {
                    name: 'subjectAltName',
                    altNames: [
                        {type: 2, value: 'localhost'},
                        {type: 7, ip: '127.0.0.1'},
                    ],
                },
            ],
        },
    );

    fs.writeFileSync(CERT_FILE, pems.cert, {mode: 0o600});
    fs.writeFileSync(KEY_FILE, pems.private, {mode: 0o600});
    console.log(`  Generated new certificate (valid 365 days) → ${CERT_FILE}`);
    return {cert: pems.cert, key: pems.private};
}

const proto = HTTP_ONLY ? 'http' : 'https';
const server = HTTP_ONLY
    ? http.createServer(handleRequest)
    : (() => {
        const {cert, key} = loadOrGenerateCert();
        return https.createServer({cert, key}, handleRequest);
    })();

server.listen(PORT, () => {
    console.log('');
    console.log('Meister ProPR — dummy backend');
    console.log(`  Listening on  ${proto}://localhost:${PORT}`);
    console.log(`  Client key:   ${CLIENT_KEY}`);
    console.log(`  Simulate:     ${SIMULATE}  (set SIMULATE=fail to test error path)`);
    console.log(`  Job delay:    ${DELAY_MS}ms`);
    console.log('');
    if (!HTTP_ONLY) {
        console.log('  Self-signed cert — if the browser blocks the request:');
        console.log(`  1. Open https://localhost:${PORT} directly in the same tab.`);
        console.log('  2. Click Advanced → Proceed to localhost (unsafe).');
        console.log('  3. Return to the extension page and retry.');
        console.log('');
    }
});
