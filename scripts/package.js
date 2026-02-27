const { spawnSync } = require('child_process');
const { version } = require('../package.json');

const result = spawnSync(
    'tfx',
    ['extension', 'create', '--manifest-globs', 'vss-extension.json', '--override', JSON.stringify({ version })],
    { stdio: 'inherit', shell: true },
);
process.exit(result.status ?? 1);
