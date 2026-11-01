import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const isBot = ua => !ua || /bot\b|crawler|spider|headless|lighthouse|pagespeed|preview|curl\/|wget\/|python-requests|facebookexternalhit|slurp|bingpreview/i.test(ua);
const dayOf = time => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date(time));
const counts = row => ({ uniqueVisitors: Number(row.uniqueVisitors), visits: Number(row.visits) });
export function openStatistics(filename) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS days (day TEXT, visitor TEXT, views INTEGER NOT NULL, PRIMARY KEY(day,visitor));
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, visitor TEXT NOT NULL, time INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS event_time ON events(time);
    CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY, views INTEGER NOT NULL);
    INSERT OR IGNORE INTO totals VALUES(1,0);`);
  let lastCleanup = 0;
  return {
    record(visitor, event, now = Date.now()) {
      const id = createHash('sha256').update(visitor).digest('hex');
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = db.prepare('INSERT OR IGNORE INTO events VALUES(?,?,?)').run(event, id, now);
        if (result.changes) {
          db.prepare('INSERT INTO visitors VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen').run(id, now, now);
          db.prepare('INSERT INTO days VALUES(?,?,1) ON CONFLICT(day,visitor) DO UPDATE SET views=views+1').run(dayOf(now), id);
          db.prepare('UPDATE totals SET views=views+1 WHERE id=1').run();
        }
        if (now - lastCleanup > 3600000) {
          db.prepare('DELETE FROM events WHERE time < ?').run(now - 31 * 86400000);
          lastCleanup = now;
        }
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    snapshot(now = Date.now()) {
      const periods = [1, 7, 30].map(days => ({ days,
        ...counts(db.prepare('SELECT COUNT(DISTINCT visitor) AS uniqueVisitors, COUNT(*) AS visits FROM events WHERE time >= ?').get(now - days * 86400000)),
      }));
      const daily = [];
      const today = dayOf(now);
      for (let ago = 29; ago >= 0; ago--) {
        const date = new Date(`${today}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - ago);
        const key = date.toISOString().slice(0,10);
        daily.push({ key, ...counts(db.prepare('SELECT COUNT(*) AS uniqueVisitors, COALESCE(SUM(views),0) AS visits FROM days WHERE day=?').get(key)) });
      }
      const monthly = [];
      for (let ago = 11; ago >= 0; ago--) {
        const date = new Date(`${today.slice(0,7)}-01T12:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() - ago);
        const key = date.toISOString().slice(0,7);
        monthly.push({ key, ...counts(db.prepare('SELECT COUNT(DISTINCT visitor) AS uniqueVisitors, COALESCE(SUM(views),0) AS visits FROM days WHERE day >= ? AND day < ?').get(`${key}-01`, `${key}-32`)) });
      }
      return { total: Number(db.prepare('SELECT COUNT(*) AS count FROM visitors').get().count),
        visits: Number(db.prepare('SELECT views FROM totals WHERE id=1').get().views),
        since: Number(db.prepare('SELECT MIN(first_seen) AS time FROM visitors').get().time) || null,
        periods, daily, monthly };
    },
    close: () => db.close(),
    total: () => Number(db.prepare('SELECT COUNT(*) AS count FROM visitors').get().count),
  };
}
