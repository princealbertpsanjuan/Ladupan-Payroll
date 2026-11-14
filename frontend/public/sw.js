// Minimal service worker so phones can install Ladupan as an app.
// It never caches the app or the API: every screen and every
// Time In / Time Out always comes fresh from the server. When the phone
// is offline, page loads show a short "no connection" page instead.

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ladupan – No connection</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center;color:#111827}
button{margin-top:16px;padding:12px 20px;border-radius:10px;border:0;background:#0a0a0a;color:#fff;font-weight:600;font-size:15px}</style>
</head><body><div><h1>No internet connection</h1>
<p>Connect to the shop Wi-Fi, then try again.</p>
<button onclick="location.reload()">Try again</button></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })
    )
  );
});
