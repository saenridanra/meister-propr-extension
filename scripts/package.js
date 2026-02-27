const { spawnSync }  = require('child_process');
const { writeFileSync, unlinkSync } = require('fs');
const { join }       = require('path');
const { tmpdir }     = require('os');
const { version }    = require('../package.json');

// Write the version override to a temp file so that shell quote-escaping of
// JSON on Windows (CMD) cannot mangle the value.
const overridesFile = join(tmpdir(), 'meister-propr-overrides.json');
writeFileSync(overridesFile, JSON.stringify({ version }));

const result = spawnSync(
    'tfx',
    ['extension', 'create', '--manifest-globs', 'vss-extension.json', '--overrides-file', overridesFile],
    { stdio: 'inherit', shell: true },
);

try { unlinkSync(overridesFile); } catch {}
process.exit(result.status ?? 1);
