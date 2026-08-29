const Redis = require('ioredis');
require('dotenv').config();

//create redis client - connects to local redis instance
const redis = new Redis(process.env.REDIS_URL, {
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
});

redis.on('connect', ()=> console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

module.exports = redis;