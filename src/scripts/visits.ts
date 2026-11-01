// Count a visible page once, independently of the lazy footer island.
function recordVisit() {
  if (location.pathname.startsWith('/preview/') || new URL(location.href).searchParams.has('_preview')) return;
  if (navigator.webdriver || navigator.doNotTrack === '1' || (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return;
  try {
    let visitor = localStorage.getItem('ve-visitor-v1');
    if (!visitor || !/^[a-f0-9-]{36}$/i.test(visitor)) {
      visitor = crypto.randomUUID(); localStorage.setItem('ve-visitor-v1', visitor);
    }
    fetch('/api/statistiques/visit/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitor, event: crypto.randomUUID() }), keepalive: true }).catch(() => {});
  } catch { /* Storage disabled: skip instead of inventing a new visitor each page. */ }
}
function schedule() {
  if ('requestIdleCallback' in window) window.requestIdleCallback(recordVisit, { timeout: 2500 });
  else setTimeout(recordVisit, 500);
}
if (document.visibilityState === 'visible') schedule();
else document.addEventListener('visibilitychange', function visible() {
  if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', visible); schedule(); }
});
