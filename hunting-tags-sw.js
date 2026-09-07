/*
  Service worker for the MT Hunting Tag Tracker.

  Goal: once a hunter opens this page with a signal, it keeps working
  with NO connectivity at all afterward - reload, phone restart, tab
  closed and reopened, whatever. Only the app-shell files below are
  precached; this Worker serves nothing else, so there's no sibling
  page to worry about affecting.

  Bump CACHE_NAME (e.g. v2) whenever the page's data changes so
  returning visitors with a signal pick up the update instead of
  being stuck on a stale cached copy.

  IMPORTANT - the /index.html <-> / alias below:
  Cloudflare's static-asset hosting 307-redirects a request for
  /index.html to the clean canonical URL / (this is general Cloudflare
  "clean URL" behavior, confirmed against a sibling project that hit
  this exact bug in production). Chrome refuses to let a service
  worker satisfy a top-level navigation with a response that was
  reached by following a redirect - net::ERR_FAILED for anyone who
  types/bookmarks/links the /index.html form once this service worker
  is installed. Fixed the same way here from day one: precache under
  the canonical path only, and canonicalPath() rewrites any request
  for the /index.html alias to that same canonical path before it's
  looked up in the cache OR re-fetched from the network - so the
  handler's own fetch() call never actually hits the redirect.
*/
const CACHE_NAME = "mt-hunting-tag-tracker-v1";

const HTML_ALIAS = "/index.html";
const HTML_CANONICAL = "/";
function canonicalPath(pathname){
  return pathname === HTML_ALIAS ? HTML_CANONICAL : pathname;
}

const PRECACHE_PATHS = [
  HTML_CANONICAL,
  "/hunting-tags.webmanifest",
  "/assets/fonts/Rye-Regular.ttf",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/favicon-32.png",
  "/assets/hunting/district-map-region2-3.png",
  "/assets/hunting/icons/wtdBuck.png",
  "/assets/hunting/icons/wtdEither.png",
  "/assets/hunting/icons/wtdDoe.png",
  "/assets/hunting/icons/mdBuck.png",
  "/assets/hunting/icons/mdEither.png",
  "/assets/hunting/icons/mdDoe.png",
  "/assets/hunting/icons/elkBull.png",
  "/assets/hunting/icons/elkEither.png",
  "/assets/hunting/icons/elkCow.png",
  "/assets/hunting/icons/elkSpike.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_PATHS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if(req.method !== "GET") return;

  const url = new URL(req.url);
  const path = canonicalPath(url.pathname);
  if(!PRECACHE_PATHS.includes(path)) return; // not ours - let it pass through normally

  // Always cache-key and (re)fetch the canonical URL, even when the
  // browser actually asked for the /index.html alias - see the note
  // up top. caches.match()/cache.put()/fetch() all accept a plain
  // string URL just as well as a Request, so a string is enough here
  // - and it deliberately does NOT reuse `req` when aliased, since
  // fetching the exact requested /index.html URL is the one thing
  // that must never happen.
  const cacheKey = path === url.pathname ? req : new URL(path, url).toString();

  event.respondWith(
    caches.match(cacheKey).then((cached) => {
      const network = fetch(cacheKey).then((resp) => {
        if(resp && resp.ok){
          caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, resp.clone()));
        }
        return resp;
      }).catch(() => cached);
      // Offline: serve the cached copy immediately. Online: keep the
      // cache fresh in the background for next time, but don't make
      // the hunter wait on a network round trip for a page they
      // already have.
      return cached || network;
    })
  );
});
