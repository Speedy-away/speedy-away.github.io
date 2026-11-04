// Service Worker for whatwhatboy.com
const CACHE_VERSION = 'v3.3.9';
const CACHE_NAME = `whatwhatboy-${CACHE_VERSION}`;

function offlinePage() {
    // An uncached route must not become the homepage at a different base URL.
    // Keep this response self-contained so its appearance needs no network.
    return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Page unavailable offline | whatwhatboy</title><style>html{color-scheme:dark;background:#101013;color:#f4f4f5;font:16px/1.65 system-ui,sans-serif}body{margin:0;padding:24px}main{max-width:38rem;margin:12vh auto}h1{font-size:clamp(1.7rem,6vw,2.4rem);line-height:1.2;text-wrap:balance}p{color:#b9b9c3}a{display:inline-flex;align-items:center;min-height:48px;padding:0 18px;margin-top:12px;border:1px solid #facc15;border-radius:10px;color:#facc15;text-decoration:none}a:focus-visible{outline:3px solid #a7f3d0;outline-offset:4px}</style></head><body><main><p>whatwhatboy</p><h1>This page is unavailable offline</h1><p>Reconnect and reload to open this page. Pages you have already visited may still be available.</p><p>Completed downloads stay in your Files app or browser’s Downloads folder.</p><a href="/">Open home</a></main></body></html>`, {status:503, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/style.css?v=3.3.2',
    '/assets/mobile.css?v=3.3.8',
    '/assets/mobile-downloads.css?v=3.3.8',
    '/assets/mobile-downloads.js?v=3.3.8',
    '/assets/home.css?v=5',
    '/assets/site-background.css?v=2',
    '/assets/site-background.js?v=2',
    '/assets/images/game-logos/grand-theft-auto.svg',
    '/assets/images/game-logos/counter-strike-2.svg',
    '/assets/images/game-logos/call-of-duty.svg',
    '/assets/images/game-logos/garrys-mod.svg',
    '/assets/images/game-logos/red-dead-redemption-2.png',
    '/script.js',
    '/manifest.json',
    '/assets/images/logo.png',
    '/assets/images/platform-logos/ps5.svg',
    '/assets/images/platform-logos/ps4.svg',
    '/assets/images/platform-logos/ps3.svg',
    '/assets/images/platform-logos/psvita.svg',
    '/assets/images/platform-logos/xbox360.svg',
    '/assets/images/platform-logos/nintendo-switch.svg',
    '/assets/images/platform-logos/steamdeck.svg'
];

// Install - precache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('whatwhatboy-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch - network first, cache fallback
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    // Self-contained console runtimes own their appcache and failure handling.
    // Never mix their modules or replace an unavailable run page with site HTML.
    if (url.pathname.startsWith('/hosts/runtime/')) return;
    // Local QA pages must show their real network result, never a cached site.
    if (url.pathname.startsWith('/.playwright-cli/') || url.pathname.startsWith('/.playwright/')) return;

    // Downloads must use the browser's normal streaming path. Never retain
    // large binaries in the UI cache or substitute HTML for a failed file.
    const libraryPage = url.pathname === '/downloads/' || url.pathname === '/downloads/index.html';
    const hostedFile = url.pathname.startsWith('/downloads/') && !libraryPage;
    const fileExtension = /\.(?:zip|7z|rar|bin|elf|pkg|p3t|ptf|ctf|nxtheme|wuhb|xbe|pbp|pup|upd|fself|rpl|prx|sprx|rpf|asi|dll|exe|msi|apk|ipa|iso|img|vpk|cia|nro|nsp|xex|gsc|lua|xml|json|csv|txt|md|pdf|gz|bz2|xz|tar|bat|cmd|ps1|sh|py|c|cpp|h|hpp)$/i.test(url.pathname);
    if (hostedFile || fileExtension || !event.request.destination) return;

    const pageRequest = event.request.destination === 'document' &&
        (/\/$/.test(url.pathname) || /\.html?$/i.test(url.pathname) || !/\.[^/]+$/.test(url.pathname));

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.status === 200) {
                    const clone = response.clone();
                    event.waitUntil(caches.open(CACHE_NAME)
                        .then((cache) => cache.put(event.request, clone))
                        .catch(() => { /* A full cache must not interrupt the response. */ }));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((cached) => {
                    if (cached) return cached;
                    if (pageRequest) return offlinePage();
                    return new Response('This resource is unavailable offline.', {status: 503});
                });
            })
    );
});
