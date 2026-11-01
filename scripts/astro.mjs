import { spawn } from 'node:child_process';
const command = process.argv[2] || 'build';
const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', command, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env, EMDASH_PREVIEW_PATH_PATTERN: process.env.EMDASH_PREVIEW_PATH_PATTERN || '/preview/{collection}/{id}/' },
});
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
