const mysql = require('mysql2');
require('dotenv').config();

// createPool keeps multiple DB connections ready.
// If two users register at the same time, they don't
// queue up waiting for one connection to free — pool handles it.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// .promise() lets us use async/await instead of callbacks.
// So everywhere we do: const [rows] = await db.query(...)
module.exports = pool.promise();