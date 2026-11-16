// spitz.dev: shows phone notifications and opens the dashboard when one is tapped. No caching.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))
self.addEventListener('push', e => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch { d = { title: 'spitz.dev', body: e.data ? e.data.text() : '' } }
  e.waitUntil(self.registration.showNotification(d.title || 'spitz.dev', {
    body: d.body || '', icon: 'burger_line_192.png', badge: 'burger_line_64.png', tag: d.tag, renotify: !!d.tag, data: { url: d.url || '/' }
  }))
})
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate ? c.navigate(url) : 0; return c.focus() }
    return self.clients.openWindow(url)
  }))
})
