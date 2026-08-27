const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const redis = require('../redis');

const router = express.Router();
router.use(authMiddleware);

//get/api/messages/:channelId
//loads existing messages when user opens a channel
//REST is here because we are retrieving data from the server
//full message histrory is required here not just new ones arriving in real time


//supports pagination via ?before=<messageId>&limit=<number>
//before = fetch messages older than this message id
//limit = how many to fetch (Default = 50)

router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;
    //before = the oldest message id the client currently has
    //undefined on first load = get the latest messages


    try {
        //security check :: only members of a channel can see its messages
        const [membership] = await db.query(
            'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this channel' });
        }

        const [memberInfo] = await db.query(
            'SELECT cleared_at FROM channel_members WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );

        const clearedAt = memberInfo[0]?.cleared_at;

        //FETCH MESSAGES WITH SENDER USERNAME JOINED IN-
        //messages table only stores sender_id, noy username, so we join with users table to get the username
        //JOIN gets the username so front end doesn't need a 
        //separate request per message to find out who sent it


        //Day 9
        //Only cache the FIRST page (no before cursor)
        //subsequent pages are always fetched from DB since they're
        //older messages accessed less frequently 
        const cacheKey = `messages:${channelId}:latest`;

        if (!before) {
            //try redis first
            const cached = await redis.get(cacheKey);

            if (cached && !clearedAt) {
                //cache hit - return immediately without DB query
                console.log(`Cache hit for channel ${channelId}`)
                return res.json({
                    messages: JSON.parse(cached),
                    hasMore: JSON.parse(cached).length === limit
                });
            }
        }

        //cache miss or pagination - query db
        let query;
        let params;

        // Build query conditionally instead of using ? IS NULL
        if (before) {
            query = clearedAt
                ? `SELECT m.id, m.content, m.image_url, m.created_at,
              u.id as sender_id, u.username, u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.channel_id = ? AND m.id < ?
         AND m.created_at > ?
       ORDER BY m.id DESC LIMIT ?`
                : `SELECT m.id, m.content, m.image_url, m.created_at,
              u.id as sender_id, u.username, u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.channel_id = ? AND m.id < ?
       ORDER BY m.id DESC LIMIT ?`;

            params = clearedAt
                ? [channelId, before, clearedAt, limit]
                : [channelId, before, limit];

        } else {
            query = clearedAt
                ? `SELECT m.id, m.content, m.image_url, m.created_at,
              u.id as sender_id, u.username, u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.channel_id = ?
         AND m.created_at > ?
       ORDER BY m.id DESC LIMIT ?`
                : `SELECT m.id, m.content, m.image_url, m.created_at,
              u.id as sender_id, u.username, u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.channel_id = ?
       ORDER BY m.id DESC LIMIT ?`;

            params = clearedAt
                ? [channelId, clearedAt, limit]
                : [channelId, limit];
        }

        const [messages] = await db.query(query, params);

        //REVERSE - DB returns oldest first (DESC), UI needs oldest first

        const ordered = messages.reverse();

        //cache only the first page for 60 seconds
        if (!before) {
            await redis.set(cacheKey, JSON.stringify(ordered), 'EX', 60);
            console.log(`Cached messages for channel ${channelId}`);
        }


        res.json({
            messages: ordered,
            //hasmore tells the frontend whether there are older messages to load
            hasMore: messages.length === limit
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;