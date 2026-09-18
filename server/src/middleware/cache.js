/**
 * In-Memory Response Caching Middleware
 * Designed for computationally intensive read endpoints such as Analytics.
 * Provides tenant-isolated caching, TTL expiration, X-Cache headers, and user cache invalidation.
 */

const cacheStore = new Map();

/**
 * Creates response caching middleware with specified TTL in seconds.
 * @param {number} [ttlSeconds=60] Time-to-live in seconds
 * @returns {Function} Express middleware
 */
function responseCache(ttlSeconds = 60) {
  return (req, res, next) => {
    // Only cache safe GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip cache in tests unless explicitly requested via header, or if client requested no-cache
    const isTest = process.env.NODE_ENV === 'test';
    const forceTestCache = req.headers['x-test-cache'] === 'true';
    const noCacheHeader =
      req.headers['cache-control'] === 'no-cache' || req.headers['pragma'] === 'no-cache';

    if ((isTest && !forceTestCache) || noCacheHeader) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const userId = req.user ? (req.user.id || req.user._id || 'anonymous').toString() : 'anonymous';
    const cacheKey = `${userId}:${req.originalUrl || req.url}`;
    const now = Date.now();

    const cached = cacheStore.get(cacheKey);

    if (cached && cached.expiry > now) {
      const remainingTtl = Math.max(0, Math.round((cached.expiry - now) / 1000));
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', `${remainingTtl}s`);
      return res.status(cached.statusCode).json(cached.body);
    }

    // Capture original res.json to cache response body
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Only cache successful 2xx responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheStore.set(cacheKey, {
          statusCode: res.statusCode,
          body,
          expiry: now + ttlSeconds * 1000,
        });
      }

      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/**
 * Invalidates all cached analytics responses for a specific user.
 * Call this when an application is created, updated, or deleted.
 * @param {string} userId
 */
function invalidateUserAnalyticsCache(userId) {
  if (!userId) return;
  const userPrefix = `${userId.toString()}:`;
  for (const key of cacheStore.keys()) {
    if (key.startsWith(userPrefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Clears the entire cache store (useful for tests or server resets)
 */
function clearCache() {
  cacheStore.clear();
}

module.exports = {
  responseCache,
  invalidateUserAnalyticsCache,
  clearCache,
};
