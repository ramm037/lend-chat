const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redis = require('../redis');

// General API rate limiter — 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,
  // RedisStore persists counts in Redis —
  // without this, counts reset on server restart
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  message: {
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,  // Return rate limit info in headers
  legacyHeaders: false
});

// Strict limiter for auth routes — 10 attempts per 15 minutes
// Prevents brute force attacks on login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  message: {
    error: 'Too many login attempts, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Message rate limiter — 30 messages per minute per user
// Applied at socket level not HTTP
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  message: {
    error: 'You are sending messages too fast'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { apiLimiter, authLimiter, messageLimiter };