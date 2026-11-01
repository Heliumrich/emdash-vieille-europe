import { readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('.migration/media-manifest.json', 'utf8'));
const file = manifest[Number(process.argv[2])];
if (!file) throw new Error('Invalid media index');
const bytes = await readFile(file.path);
const base64 = bytes.toString('base64');
if (process.argv[3]) process.stdout.write(base64.slice(Number(process.argv[3]), Number(process.argv[3]) + Number(process.argv[4])));
else process.stdout.write(JSON.stringify({ filename: `directus-${file.id}-${file.filename_download || 'image'}`, contentType: file.type, base64 }));
