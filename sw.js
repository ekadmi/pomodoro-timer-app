self.addEventListener('install',e=>{e.waitUntil(caches.open('pomodoro-v1').then(c=>c.addAll(['/pomodoro.html','/pomodoro.css','/pomodoro.js','/manifest.json'])))});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
