import { mkdir, readFile, writeFile, readdir, rename, copyFile, stat, symlink, unlink, rmdir, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}
function inside(root, path) {
  const child = relative(resolve(root), resolve(path));
  if (child.startsWith('..') || child.startsWith(sep)) throw new Error('Path escapes publication directory');
}
export async function validateStatic(client) {
  const files = await filesUnder(client);
  const paths = new Set(files.map(path => relative(client, path).split(sep).join('/')));
  if (!paths.has('index.html') || !paths.has('presentation/index.html')) throw new Error('Public pages missing from static build');
  let htmlPages = 0, stylesheets = 0;
  for (const path of files.filter(path => path.endsWith('.html'))) {
    const html = await readFile(path, 'utf8');
    htmlPages++;
    if (html.includes('admin.vieille-europe.ch')) throw new Error(`Directus dependency: ${path}`);
    for (const [, url] of html.matchAll(/(?:href|src)="(\/_astro\/[^"?#]+)(?:[^"\s]*)?"/g)) {
      if (!paths.has(decodeURIComponent(url.slice(1)))) throw new Error(`Missing built asset ${url}`);
      if (url.endsWith('.css')) stylesheets++;
    }
    for (const [, set] of html.matchAll(/(?:srcset|data-lightbox-srcset)="([^"]+)"/g)) {
      for (const candidate of set.split(',')) {
        const source = candidate.trim().split(/\s+/)[0];
        if (source.startsWith('/_image?')) throw new Error(`Unbuilt responsive image in ${path}`);
        if (source.startsWith('/_astro/') && !paths.has(decodeURIComponent(source.slice(1)))) throw new Error(`Missing built image ${source}`);
      }
    }
  }
  if (!stylesheets) throw new Error('No stylesheet linked from static HTML');
  return { htmlPages, stylesheets };
}
export async function mergeImmutableAssets(client, directory) {
  const root = join(client, '_astro');
  for (const source of await filesUnder(root)) {
    const target = join(directory, '_astro', relative(root, source));
    inside(directory, target);
    await mkdir(resolve(target, '..'), { recursive: true });
    try {
      const [existing, incoming] = await Promise.all([readFile(target), readFile(source)]);
      if (!existing.equals(incoming)) throw new Error(`Immutable asset collision: ${target}`);
      continue;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const temporary = `${target}.${randomUUID()}.tmp`;
    await copyFile(source, temporary);
    await rename(temporary, target);
  }
}
export async function activateRelease(directory, client, name = 'current') {
  inside(directory, client);
  const temporary = join(directory, `.${name}-${randomUUID()}`);
  await symlink(client, temporary, process.platform === 'win32' ? 'junction' : 'dir');
  // POSIX rename replaces the old symlink atomically. Never rebuild in the live tree.
  await rename(temporary, join(directory, name));
}
async function pruneReleases(directory) {
  const root = join(directory, 'releases');
  const protectedPaths = await Promise.all(['runtime', 'current'].map(async name => realpath(join(directory, name)).catch(() => '')));
  const versions = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && /^\d+-[a-f\d-]+$/.test(entry.name)).sort((a,b) => b.name.localeCompare(a.name));
  for (const entry of versions.slice(3)) {
    const path = resolve(root, entry.name);
    inside(root, path);
    if (protectedPaths.some(active => active === path || active.startsWith(path + sep))) continue;
    await rm(path, { recursive: true });
  }
}
async function runBuild(project, outDir) {
  await new Promise((accept, reject) => {
    const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], { cwd: project, stdio: 'inherit', env: { ...process.env, EMDASH_PREVIEW_PATH_PATTERN: process.env.EMDASH_PREVIEW_PATH_PATTERN || '/preview/{collection}/{id}/', VE_ASTRO_OUT_DIR: outDir, VE_AUTO_PUBLISH: '0' } });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? accept() : reject(new Error(`Astro build exited ${code}`)));
  });
}
async function pending(directory) {
  try { return (await readdir(join(directory, 'queue'))).filter(name => name.endsWith('.json')).sort(); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function acquire(directory) {
  const lock = join(directory, 'lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner;
    try { owner = JSON.parse(await readFile(join(lock, 'owner.json'), 'utf8')); }
    catch (failure) {
      if (failure.code !== 'ENOENT' && !(failure instanceof SyntaxError)) throw failure;
      if (Date.now() - (await stat(lock)).mtimeMs < 30000) return undefined;
    }
    if (owner) {
      try { process.kill(owner.pid, 0); return undefined; }
      catch (probe) { if (probe.code !== 'ESRCH') return undefined; }
    }
    await unlink(join(lock, 'owner.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await rmdir(lock);
    await mkdir(lock);
  }
  await writeFile(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
  return async () => { await unlink(join(lock, 'owner.json')); await rmdir(lock); };
}
export async function publishStatic(options = {}) {
  const project = resolve(options.project || '.');
  const directory = resolve(options.directory || process.env.VE_PUBLISH_DIR || '.site');
  await mkdir(directory, { recursive: true });
  const queued = await pending(directory);
  if (!options.force && !queued.length) return { status: 'idle' };
  const release = await acquire(directory);
  if (!release) return { status: 'busy' };
  try {
    if (!options.force) {
      try {
        const failure = JSON.parse(await readFile(join(directory, 'failure.json'), 'utf8'));
        if (Date.now() < failure.retryAfter) return { status: 'retry-later' };
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await new Promise(accept => setTimeout(accept, 2000));
    }
    for (let pass = 0; pass < 2; pass++) {
      const batch = await pending(directory);
      const id = `${Date.now()}-${randomUUID()}`;
      const output = join(directory, 'releases', id);
      await (options.build || runBuild)(project, output);
      const client = join(output, 'client');
      const audit = await validateStatic(client);
      const latest = await pending(directory);
      if (latest.some(name => !batch.includes(name))) continue;
      await mergeImmutableAssets(client, join(directory, 'assets'));
      await activateRelease(directory, client);
      if (options.runtime) await activateRelease(directory, output, 'runtime');
      await writeFile(join(directory, 'last-success.json'), JSON.stringify({ release: id, publishedAt: new Date().toISOString(), ...audit }, null, 2));
      for (const name of batch) await unlink(join(directory, 'queue', name));
      await unlink(join(directory, 'failure.json')).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await pruneReleases(directory);
      return { status: 'published', release: id, ...audit };
    }
    return { status: 'changed-during-build' };
  } catch (error) {
    await writeFile(join(directory, 'failure.json'), JSON.stringify({ failedAt: new Date().toISOString(), retryAfter: Date.now() + 120000, error: error.message }));
    throw error;
  } finally { await release(); }
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const result = await publishStatic({ force: process.argv.includes('--force'), runtime: process.argv.includes('--runtime') });
  if (result.status !== 'idle' && result.status !== 'retry-later') console.log(JSON.stringify(result));
  if (process.argv.includes('--force') && result.status !== 'published') process.exitCode = 1;
}
