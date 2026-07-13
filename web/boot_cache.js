// web/boot_cache.js — one fetch per URL, shared by BOTH boot paths.
// This page boots two apps: the frozen plain-<script> renderer (web/poster.js)
// and the Preact panel app (web-src/main.jsx). Each independently fetched
// themes.json, layouts.json and the boot AOI — measured live as 3 assets
// fetched twice (225KB binh-thanh.json among them). Memoize on the PROMISE so
// concurrent callers share one in-flight request.
(function () {
  const cache = new Map();
  window.__bootCache = cache;
  window.bootFetch = function bootFetch(url) {
    if (!cache.has(url)) {
      // Evict on failure. Caching a REJECTED promise would poison this URL for
      // the page's lifetime — one transient blip on themes.json and every later
      // caller re-rejects, with a reload the only way out.
      cache.set(
        url,
        fetch(url).then((r) => r.json()).catch((err) => {
          cache.delete(url);
          throw err;
        })
      );
    }
    return cache.get(url);
  };
})();
