// Service Worker Registration for Chalo Kisaan PWA

export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Never register a SW on localhost — prevents stale cache loops in dev
      if (isLocalhost()) return;

      registerValidSW(`${process.env.PUBLIC_URL}/service-worker.js`);
    });
  }
}

// Unregister all service workers and wipe all caches (dev only — kept for reference)
// eslint-disable-next-line no-unused-vars
function unregisterAndCleanCaches() {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.unregister());
  });
  caches.keys().then((keys) => {
    keys.forEach((key) => caches.delete(key));
  });
}

function registerValidSW(swUrl) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('[PWA] Service Worker registered:', registration.scope);

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('[PWA] New content available; refresh to update.');
            } else {
              console.log('[PWA] Content cached for offline use.');
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('[PWA] Service Worker registration failed:', error);
    });
}

// eslint-disable-next-line no-unused-vars
function checkValidServiceWorker(swUrl) {
  fetch(swUrl, { headers: { 'Service-Worker': 'script' } })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (response.status === 404 || (contentType && !contentType.includes('javascript'))) {
        // No service worker found — unregister silently, no reload
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister();
        });
      } else {
        registerValidSW(swUrl);
      }
    })
    .catch(() => {
      console.log('[PWA] No internet connection. App is running in offline mode.');
    });
}

function isLocalhost() {
  return Boolean(
    window.location.hostname === 'localhost' ||
      window.location.hostname === '[::1]' ||
      window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
  );
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error.message));
  }
}
