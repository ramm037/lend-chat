const redis = require('../redis');

// Socket rate limiter — limits messages per user per minute
// Applied inside socket event handlers, not HTTP middleware
const socketRateLimit = async (userId, action, limit = 30, windowSeconds = 60) => {
    const key = `rate:${action}:${userId}`;

    // INCR atomically increments — if key doesn't exist, creates it at 1
    const count = await redis.incr(key);

    if (count === 1) {
        // First request in window — set expiry
        await redis.expire(key, windowSeconds);
    }

    // Returns true if under limit, false if exceeded
    return count <= limit;
};

module.exports = socketRateLimit;