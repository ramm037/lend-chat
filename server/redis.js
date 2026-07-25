const Redis = require('ioredis')

//create redis client - connects to local redis instance
const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', ()=> console.log('Redis connected'));
redis.on('error', (err) => console.error('Redis error:', err));

module.exports = redis;