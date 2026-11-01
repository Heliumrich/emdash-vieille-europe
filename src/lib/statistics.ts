import { openStatistics } from '../../scripts/statistics-store.mjs';
import { resolve } from 'node:path';
let store: ReturnType<typeof openStatistics>;
let cached: { time: number; data: ReturnType<ReturnType<typeof openStatistics>['snapshot']> } | undefined;
export function database() {
  return store ??= openStatistics(process.env.STATS_DB || resolve('.data/statistics.sqlite'));
}
export function snapshot() {
  if (!cached || Date.now() - cached.time > 15000) cached = { time: Date.now(), data: database().snapshot() };
  return cached.data;
}
export function invalidate() { cached = undefined; }
