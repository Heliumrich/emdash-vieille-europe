import test from 'node:test';
import assert from 'node:assert/strict';
import { openStatistics, isBot } from './statistics-store.mjs';
test('unique visitors are deduplicated across pages, days and months; retries are idempotent', () => {
 const store=openStatistics(':memory:');
 try {
  const now=Date.parse('2026-11-01T12:00:00Z');
  store.record('one','a',now-2*86400000);store.record('one','b',now-3600000);
  store.record('two','c',now-1000);store.record('two','c',now);
  const data=store.snapshot(now);
  assert.equal(data.total,2);assert.equal(data.visits,3);
  assert.deepEqual(data.periods.map(p=>[p.uniqueVisitors,p.visits]),[[2,2],[2,3],[2,3]]);
  assert.equal(data.monthly.at(-1).uniqueVisitors,2);
  assert.equal(new Set(data.daily.map(r=>r.key)).size,30);
 } finally {store.close();}
});
test('calendar buckets use Zurich midnight and monthly uniques are not sums of daily uniques',()=>{
 const store=openStatistics(':memory:');
 try {
  const now=Date.parse('2026-10-26T00:30:00Z');
  store.record('one','a',Date.parse('2026-10-24T22:30:00Z'));
  store.record('one','b',Date.parse('2026-10-25T23:30:00Z'));
  const data=store.snapshot(now);
  assert.equal(data.daily.at(-2).key,'2026-10-25');
  assert.equal(data.daily.at(-2).visits,1);assert.equal(data.daily.at(-1).visits,1);
  assert.equal(data.monthly.at(-1).uniqueVisitors,1);assert.equal(data.monthly.at(-1).visits,2);
 }finally{store.close();}
});
test('known robots are ignored without classifying humans by browsing speed',()=>{
 for(const ua of ['Googlebot/2.1','bingbot/2','curl/8','HeadlessChrome/120',''])assert.equal(isBot(ua),true);
 assert.equal(isBot('Mozilla/5.0 Chrome/140 Safari/537.36'),false);
});
