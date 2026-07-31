// ==================== SERVICE WORKER ====================
const CACHE_NAME = 'cabine-v1';
const urlsToCache = [
    '/',
    '/login.html',
    '/register.html',
    '/dashboard.html',
    '/admin.html',
    '/home.html',
    '/style.css',
    '/dashboard.css',
    '/admin.css',
    '/dashboard.js',
    '/admin.js',
    '/script.js',
    '/scripts.js',
    '/manifest.json'
];

// Installation
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('✅ Cache ouvert');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.error('❌ Erreur cache:', err))
    );
});

// Activation (supprime les anciens caches)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('🗑️ Ancien cache supprimé:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Interception des requêtes (offline)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit → retourne la réponse
                if (response) {
                    return response;
                }
                // Sinon, va chercher sur le réseau
                return fetch(event.request).then(
                    response => {
                        // Vérifier si la réponse est valide
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // Cloner la réponse
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    }
                );
            })
    );
});
