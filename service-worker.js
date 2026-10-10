const CACHE='marker-studio-v312';
// (v308) the app is one page, stored once as ./index.html: every load of it (./, ./index.html, any query) is answered
// from that copy, so an update downloads it once (it had been fetched and kept twice, as ./ and ./index.html)
const CORE=['./index.html'];
const OPTIONAL=['./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./src/assets/fonts/fraunces-latin-opsz-normal.woff2','./src/assets/fonts/hanken-grotesk-latin-wght-normal.woff2'];
// (the folder the app is served from, /marker-studio/ on GitHub Pages)
const APP=(function(){try{return new URL('./',self.location.href).pathname;}catch(e){return '';}})();
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE.map(function(u){return new Request(u,{cache:'reload'});})).then(function(){return Promise.allSettled(OPTIONAL.map(function(u){return c.add(u);}));});}).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// (v307) a page load is the app whatever its query (?back=1 …): a page with a query is never stored
// (v308) the app's own page (this folder, or its index.html) comes from the one copy; another page here (a doc) from the
// network as before, or the app when offline
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const nav=r.mode==='navigate',u=new URL(r.url),q=nav&&u.search,
 app=nav&&(APP?u.pathname===APP||u.pathname===APP+'index.html':/\/(index\.html)?$/.test(u.pathname));
 e.respondWith((app?caches.match('./index.html'):caches.match(r,nav?{ignoreSearch:true}:undefined)).then(hit=>hit||fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque')&&!q){const cp=res.clone();caches.open(CACHE).then(c=>c.put(app?'./index.html':r,cp)).catch(()=>{});}return res;}).catch(()=>caches.match('./index.html'))));});
