/* Install worker only. It does not store responses, so a new deploy is never served from this worker. */
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', () => {
  /* Leave the request to the browser HTTP cache. This worker stores nothing. */
})
