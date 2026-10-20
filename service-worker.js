const CACHE='marker-studio-v318.26';
// (v313) PDF.js, for opening a PDF (vendor/pdfjs/<version>/): a cache of its own, named after its version, which a new
// release leaves alone, so its 2 MB are downloaded once, not with every update. Stored when the app is installed, as
// far as it can be (not waiting for it: the app works without it), and kept as it's used.
const PDFJS='6.3.289',PDFC='marker-studio-pdfjs-'+PDFJS,PDFDIR='./vendor/pdfjs/'+PDFJS+'/';
const PDFFILES=['pdf.min.mjs','pdf.worker.min.mjs','wasm/jbig2.wasm','wasm/openjpeg.wasm','wasm/qcms_bg.wasm','wasm/openjpeg_nowasm_fallback.js','wasm/jbig2_nowasm_fallback.js'].map(function(f){return PDFDIR+f;});
// (v318) the photo reader (vendor/ocr/<version>/, about 22 MB): downloaded and kept by the page itself, only after its
// consent card, in a cache of its own (photo-read.js). Here: never stored in the app's cache, and its cache kept
const OCRC='marker-studio-ocr-1';
// (v308) the app is one page, stored once as ./index.html: every load of it (./, ./index.html, any query) is answered
// from that copy, so an update downloads it once (it had been fetched and kept twice, as ./ and ./index.html)
const CORE=['./index.html'];
const OPTIONAL=['./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./src/assets/fonts/fraunces-latin-opsz-normal.woff2','./src/assets/fonts/hanken-grotesk-latin-wght-normal.woff2'];
// (the folder the app is served from, /marker-studio/ on GitHub Pages)
const APP=(function(){try{return new URL('./',self.location.href).pathname;}catch(e){return '';}})();
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(CORE.map(function(u){return new Request(u,{cache:'reload'});})).then(function(){return Promise.allSettled(OPTIONAL.map(function(u){return c.add(u);}));});}).then(()=>self.skipWaiting()));
 // (PDF.js: only what isn't stored yet, after the app itself)
 caches.open(PDFC).then(function(c){return Promise.allSettled(PDFFILES.map(function(u){return c.match(u).then(function(h){return h||c.add(u);});}));}).catch(function(){});});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE&&x!==PDFC&&x!==OCRC).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
// (v307) a page load is the app whatever its query (?back=1 …): a page with a query is never stored
// (v308) the app's own page (this folder, or its index.html) comes from the one copy; another page here (a doc) from the
// network as before, or the app when offline
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;
 // (the photo reader's files: straight from the network, as the page asks; it keeps them)
 if(r.url.indexOf('/vendor/ocr/')>=0)return;
 // (PDF.js's files from their own cache, stored there as they're fetched)
 if(r.url.indexOf('/vendor/pdfjs/'+PDFJS+'/')>=0){e.respondWith(caches.open(PDFC).then(function(c){return c.match(r).then(function(h){return h||fetch(r).then(function(res){if(res&&res.ok)c.put(r,res.clone()).catch(function(){});return res;});});}));return;}
 const nav=r.mode==='navigate',u=new URL(r.url),q=nav&&u.search,
 app=nav&&(APP?u.pathname===APP||u.pathname===APP+'index.html':/\/(index\.html)?$/.test(u.pathname));
 e.respondWith((app?caches.match('./index.html'):caches.match(r,nav?{ignoreSearch:true}:undefined)).then(hit=>hit||fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque')&&!q){const cp=res.clone();caches.open(CACHE).then(c=>c.put(app?'./index.html':r,cp)).catch(()=>{});}return res;}).catch(()=>caches.match('./index.html'))));});
