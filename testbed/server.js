/**
 * Meister ProPR local testbed server.
 *
 * Serves the extension hub pages with mock-replaced ADO SDK bundles so
 * you can develop and inspect the UI without an Azure DevOps host.
 *
 * Usage (from this directory):
 *   npm start
 *
 * Then open http://localhost:3000
 */

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = 3000;

// Root of the extension (one level up from testbed/)
const extensionRoot = path.resolve(__dirname, '..');

// Serve mock-built JS bundles at /dist/ (HTML files reference <script src="dist/...">)
app.use('/dist', express.static(path.join(__dirname, 'dist')));

// --- Hub pages ---

app.get('/settings', (_req, res) => {
    res.sendFile(path.join(extensionRoot, 'settings.html'));
});

app.get('/review', (_req, res) => {
    res.sendFile(path.join(extensionRoot, 'review.html'));
});

// --- Landing page ---

app.get('/', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Meister ProPR — Testbed</title>
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 60px auto; color: #1f2328; }
    h1   { font-size: 1.4rem; }
    ul   { line-height: 2; }
    a    { color: #0969da; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .hint { font-size: 0.85rem; color: #57606a; margin-top: 2rem; }
    code  { background: #f6f8fa; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Meister ProPR — Local Testbed</h1>
  <p>Extension hub pages served with mocked Azure DevOps SDK.</p>
  <ul>
    <li><a href="/settings">Settings hub</a> — configure backend URL and client key</li>
    <li><a href="/review">Review hub</a> — submit a PR for AI code review</li>
  </ul>
  <div class="hint">
    <strong>Tips:</strong>
    <ul>
      <li>Settings are persisted in <code>localStorage</code> — changes survive page refreshes.</li>
      <li>
        To make real backend calls from the Review hub, paste a valid ADO personal access token
        in the browser console before visiting the page:
        <br>
        <code>localStorage.setItem('testbed:adoToken', 'your-ado-pat-here')</code>
      </li>
      <li>
        Edit <code>testbed/mocks/azure-devops-extension-api.ts</code> to change the mock
        repositories shown in the dropdown, then rebuild (<code>npm run testbed:build</code>).
      </li>
    </ul>
  </div>
</body>
</html>`);
});

app.listen(PORT, () => {
    console.log(`Testbed running at http://localhost:${PORT}`);
    console.log('  /settings  →  Settings hub');
    console.log('  /review    →  Review hub');
});
