// sw.js - 通用 Service Worker (适配 GitHub Pages 多项目)
// 动态确定当前应用的子目录，隔离缓存，确保离线访问正常

// ---------- 1. 动态路径与缓存名称 ----------
// 获取当前 sw.js 所在的目录路径（例如 '/fundnote/'）
const BASE_PATH = self.location.pathname.replace(/[^/]+$/, '');
// 项目标识：'/fundnote/' -> 'fundnote'，用于隔离不同项目的缓存
const PROJECT_KEY = BASE_PATH.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'root';
const CACHE_NAME = `pwa-cache-${PROJECT_KEY}-v3.5`;
// 本项目的缓存前缀（用于清理旧缓存，且不影响同源其它项目）
const PROJECT_PREFIX = `pwa-cache-${PROJECT_KEY}-`;

// 预缓存资源列表（全部使用相对于当前 sw.js 的路径 + 核心 CDN 资源）
const PRECACHE_URLS = [
  BASE_PATH,                 // 例如 '/fundnote/'
  `${BASE_PATH}index.html`,
  `${BASE_PATH}clear.html`,
  `${BASE_PATH}manifest.json`,
  // 核心 CDN 资源：离线时图表/图标/字体也能正常工作
  'https://cdn.jsdelivr.net/npm/echarts@5.4.0/dist/echarts.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap',
];

// 允许离线缓存的 CDN 域名白名单（跨域静态资源）
const CDN_DOMAINS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// 静态资源扩展名（用于判断是否缓存优先）
const STATIC_EXTENSIONS = ['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'woff', 'woff2', 'ttf', 'eot', 'ico'];

// 导航请求超时（毫秒）：弱网下快速回退缓存，避免长时间白屏
const NAV_TIMEOUT = 5000;

// ---------- 2. 工具函数 ----------
function isStaticResource(url) {
  const ext = url.pathname.split('.').pop().toLowerCase();
  return STATIC_EXTENSIONS.includes(ext);
}

function isNavigateRequest(request) {
  return request.mode === 'navigate' || (request.method === 'GET' && request.destination === 'document');
}

function isCdnResource(url) {
  return CDN_DOMAINS.includes(url.hostname);
}

// 跨域不透明响应（opaque）也可缓存（如字体），读取时直接返回即可
function shouldCacheResponse(response) {
  return response && (response.ok || response.type === 'opaque');
}

// ---------- 3. 安装阶段 ----------
self.addEventListener('install', (event) => {
  console.log('[SW] 安装中，BASE_PATH =', BASE_PATH, 'CACHE =', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 预缓存资源:', PRECACHE_URLS.length, '个');
        // 使用 allSettled 忽略单个资源失败
        return Promise.allSettled(
          PRECACHE_URLS.map(url => cache.add(url).catch(err => console.warn(`预缓存失败 ${url}:`, err)))
        );
      })
      .then(() => self.skipWaiting()) // 立即激活
  );
});

// ---------- 4. 激活阶段（只清理当前项目的旧缓存，不影响同源其它项目） ----------
self.addEventListener('activate', (event) => {
  console.log('[SW] 激活中...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          // 只删除以本项目前缀开头且不属于当前版本的缓存
          if (cache.startsWith(PROJECT_PREFIX) && cache !== CACHE_NAME) {
            console.log('[SW] 删除旧缓存:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // 立即控制所有页面
  );
});

// ---------- 5. 请求拦截 ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 5.1 导航请求（HTML）：网络优先 + 超时，失败回退缓存
  if (isNavigateRequest(request)) {
    event.respondWith(navStrategy(request));
    return;
  }

  // 5.2 静态资源请求：同源或 CDN 白名单 → 缓存优先，未命中则网络并缓存
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = isCdnResource(url);
  if (isStaticResource(url) && (isSameOrigin || isCdn)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5.3 其他请求默认不缓存，直接走网络
});

// 导航策略：网络优先，超时或失败时回退缓存
async function navStrategy(request) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('nav timeout')), NAV_TIMEOUT);
  });

  try {
    const networkResponse = await Promise.race([fetch(request), timeoutPromise]);
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
    }
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] 离线模式，使用缓存页面:', request.url);
      return cachedResponse;
    }
    return new Response(
      '<h1>📴 离线状态</h1><p>请检查网络连接后刷新页面。</p>',
      { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// 静态资源策略：缓存优先，未命中则网络请求并缓存
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  try {
    const networkResponse = await fetch(request);
    if (shouldCacheResponse(networkResponse)) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
    }
    return networkResponse;
  } catch (err) {
    // 完全离线且无缓存，返回空响应
    return new Response('', { status: 408 });
  }
}
