/**
 * Meister ProPR — dummy backend server for local testbed.
 *
 * Implements the full /reviews API contract (openapi.json) without any AI or
 * ADO calls. Jobs progress through pending → processing → completed (or failed)
 * on a timer so the full polling flow in the extension can be exercised.
 *
 * Configuration (environment variables):
 *
 *   PORT            Port to listen on.                  Default: 31001
 *   CLIENT_KEY      Accepted X-Client-Key value.        Default: test-client-key
 *   SIMULATE        Review outcome: "success" | "fail"  Default: success
 *   DELAY_MS        Total ms before job completes.      Default: 6000
 *
 * Usage (from the testbed/ directory):
 *   npm run backend
 *
 * Then configure the extension Settings hub:
 *   Backend URL:  http://localhost:3001
 *   Client key:   test-client-key   (or whatever CLIENT_KEY is set to)
 */

const http    = require('http');
const crypto  = require('crypto');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT       = parseInt(process.env.PORT ?? '31001', 10);
const CLIENT_KEY = process.env.CLIENT_KEY ?? 'test-client-key';
const SIMULATE   = process.env.SIMULATE ?? 'success';   // 'success' | 'fail'
const DELAY_MS   = parseInt(process.env.DELAY_MS ?? '6000', 10);

// ---------------------------------------------------------------------------
// In-memory job store
// ---------------------------------------------------------------------------

/** @type {Map<string, import('./types').Job>} */
const jobs = new Map();

// ---------------------------------------------------------------------------
// Mock review results
// ---------------------------------------------------------------------------

const MOCK_SUCCESS_RESULT = {
    summary:
        'Overall this PR is well-structured and the intent is clear. There are a few issues ' +
        'worth addressing before merging — one potential runtime error, a security concern, ' +
        'and a couple of suggestions to improve maintainability.',
    comments: [
        {
            filePath:   'src/auth/login.ts',
            lineNumber: 42,
            severity:   'error',
            message:    'Unhandled promise rejection: the async call on this line lacks a try/catch. ' +
                        'If the network request fails, the error will be swallowed silently.',
        },
        {
            filePath:   'src/auth/login.ts',
            lineNumber: 67,
            severity:   'warning',
            message:    'Sensitive data (access token) is written to the console on this line. ' +
                        'Remove or guard behind a debug flag before deploying to production.',
        },
        {
            filePath:   'src/components/UserProfile.tsx',
            lineNumber: 15,
            severity:   'suggestion',
            message:    'This component re-renders on every parent update. ' +
                        'Wrapping it with React.memo() would avoid unnecessary renders when props have not changed.',
        },
        {
            filePath:   'src/utils/formatDate.ts',
            lineNumber: null,
            severity:   'suggestion',
            message:    'Consider using Intl.DateTimeFormat instead of a hand-rolled date formatter — ' +
                        'it handles locale and timezone differences automatically.',
        },
        {
            filePath:   null,
            lineNumber: null,
            severity:   'info',
            message:    'Test coverage for the authentication module looks thorough. ' +
                        'The new login flow is well-structured and the happy path is fully exercised.',
        },
    ],
};

const MOCK_FAIL_ERROR =
    'The AI agent could not complete the review: unable to retrieve the diff for pull request ' +
    '(simulated failure — set SIMULATE=success to test the success path).';

// ---------------------------------------------------------------------------
// Job lifecycle helpers
// ---------------------------------------------------------------------------

function scheduleJob(jobId, request) {
    const processingDelay = Math.min(2000, DELAY_MS * 0.33);

    // pending → processing
    setTimeout(() => {
        const job = jobs.get(jobId);
        if (job) job.status = 'processing';
    }, processingDelay);

    // processing → completed | failed
    setTimeout(() => {
        const job = jobs.get(jobId);
        if (!job) return;
        if (SIMULATE === 'fail') {
            job.status      = 'failed';
            job.error       = MOCK_FAIL_ERROR;
            job.completedAt = new Date().toISOString();
        } else {
            job.status      = 'completed';
            job.result      = MOCK_SUCCESS_RESULT;
            job.completedAt = new Date().toISOString();
        }
    }, DELAY_MS);
}

function makeJob(request) {
    const jobId = crypto.randomUUID();
    const job = {
        jobId,
        status:          'pending',
        organizationUrl: request.organizationUrl,
        projectId:       request.projectId,
        repositoryId:    request.repositoryId,
        pullRequestId:   request.pullRequestId,
        iterationId:     request.iterationId,
        submittedAt:     new Date().toISOString(),
        completedAt:     null,
        result:          null,
        error:           null,
    };
    jobs.set(jobId, job);
    scheduleJob(jobId, request);
    return job;
}

function jobToListItem(job) {
    return {
        jobId:           job.jobId,
        status:          job.status,
        organizationUrl: job.organizationUrl,
        projectId:       job.projectId,
        repositoryId:    job.repositoryId,
        pullRequestId:   job.pullRequestId,
        iterationId:     job.iterationId,
        submittedAt:     job.submittedAt,
        completedAt:     job.completedAt,
    };
}

function jobToStatusResponse(job) {
    return {
        ...jobToListItem(job),
        result: job.result,
        error:  job.error,
    };
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function setCorsHeaders(res, origin) {
    // Allow the testbed origin; also allow arbitrary localhost for flexibility
    const allowed = origin && /^http:\/\/localhost(:\d+)?$/.test(origin)
        ? origin
        : 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin',  allowed);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Client-Key, X-Ado-Token');
    res.setHeader('Vary', 'Origin');
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', c => chunks.push(c));
        req.on('end',   () => {
            try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

function send(res, status, body) {
    const json = JSON.stringify(body, null, 2);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(json);
}

function checkAuth(req, res) {
    const key = req.headers['x-client-key'];
    if (key !== CLIENT_KEY) {
        send(res, 401, { error: `Invalid or missing X-Client-Key. Expected: "${CLIENT_KEY}"` });
        return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
    const origin = req.headers['origin'] ?? '';
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    // POST /reviews — submit a new review job
    if (req.method === 'POST' && url.pathname === '/reviews') {
        if (!checkAuth(req, res)) return;
        const body = await readBody(req);

        // Basic request validation
        const required = ['organizationUrl', 'projectId', 'repositoryId', 'pullRequestId', 'iterationId'];
        const missing  = required.filter(k => body[k] == null);
        if (missing.length) {
            send(res, 422, { error: `Missing required fields: ${missing.join(', ')}` });
            return;
        }

        const job = makeJob(body);
        console.log(`[backend] Job created: ${job.jobId}  (PR #${body.pullRequestId}, simulate=${SIMULATE})`);
        send(res, 202, { jobId: job.jobId });
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
        const jobId = pollMatch[1];
        const job   = jobs.get(jobId);
        if (!job) {
            send(res, 404, { error: `Job not found: ${jobId}` });
            return;
        }
        console.log(`[backend] Poll: ${jobId} → ${job.status}`);
        send(res, 200, jobToStatusResponse(job));
        return;
    }

    send(res, 404, { error: 'Not found' });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log('');
    console.log('Meister ProPR — dummy backend');
    console.log(`  Listening on  http://localhost:${PORT}`);
    console.log(`  Client key:   ${CLIENT_KEY}`);
    console.log(`  Simulate:     ${SIMULATE}  (set SIMULATE=fail to test error path)`);
    console.log(`  Job delay:    ${DELAY_MS}ms`);
    console.log('');
    console.log('Configure the extension settings hub with:');
    console.log(`  Backend URL:  http://localhost:${PORT}`);
    console.log(`  Client key:   ${CLIENT_KEY}`);
    console.log('');
});
