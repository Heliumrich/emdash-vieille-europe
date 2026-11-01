import { definePlugin } from 'emdash';
import { requestPublication } from './queue.js';

// Native plugin: its only host access is writing a small, durable local signal.
// Building and process management happen in a separate systemd service.
export function createPlugin() {
  const queue = reason => ({
    errorPolicy: 'continue',
    timeout: 5000,
    handler: async () => requestPublication(reason),
  });
  return definePlugin({
    id: 'vieille-europe-publisher', version: '1.0.0',
    capabilities: ['content:read', 'media:read', 'bylines:read'],
    hooks: {
      'content:afterPublish': queue('published'),
      'content:afterUnpublish': queue('unpublished'),
      'content:afterDelete': queue('deleted'),
      'content:afterRestore': queue('restored'),
      'media:afterUpload': queue('media-uploaded'),
      'byline:afterSave': queue('byline-updated'),
      'byline:afterDelete': queue('byline-deleted'),
    },
  });
}
export default createPlugin;
