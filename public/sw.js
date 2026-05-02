// Название и версия нашего кэша. 
// Если в будущем ты сильно изменишь код, поменяй 'v1' на 'v2', чтобы телефоны скачали обнову.
const CACHE_NAME = 'movie-app-v9.2.0';

// Список всех файлов, которые нужно сохранить в память телефона
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/config.js',
    '/api.js',
    '/math.js',
    '/render.js',
    '/roulette.js',
    '/ui.js',
    '/script.js',
    '/manifest.json'
];

// ФАЗА 1: Установка (Скачиваем всё в кэш при первом заходе)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Заставляем скрипт начать работу немедленно
});

// ФАЗА 2: Активация (Убираем мусор от старых версий)
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName); // Удаляем старые кэши
                    }
                })
            );
        })
    );
    self.clients.claim(); // Сразу берем контроль над страницей
});

// ФАЗА 3: Перехват запросов (Наш "умный таможенник")
self.addEventListener('fetch', (event) => {
    // 1. Если запрос идет к нашей базе Supabase или к картинкам TMDB — всегда идем в интернет!
    // Мы же не хотим смотреть на старые оценки, если друг поставил новые.
    if (event.request.url.includes('supabase.co') || event.request.url.includes('tmdb.org')) {
        event.respondWith(fetch(event.request));
        return;
    }

    // 2. Для интерфейса (HTML, CSS, JS) — сначала ищем в памяти телефона.
    // Если находим — отдаем моментально. Если нет (например, картинка из интернета) — скачиваем.
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || fetch(event.request);
        }).catch(() => {
            // Если интернета совсем нет и файла нет в кэше — просто ничего не делаем
            return new Response('Нет интернета');
        })
    );
});