const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/search/users?q=ram
// search users by username
router.get('/users', async (req, res) => {
    const { q } = req.query;
    const userId = req.user.id;

    if (!q || q.trim().length < 1) {
        return res.status(400).json({ error: 'Search query required' });
    }

    try {
        const [users] = await db.query(
            `SELECT id, username, avatar_url
             FROM users
             WHERE username LIKE ?
             AND id != ?
             LIMIT 20`,
            [`%${q.trim()}%`, userId]
        );
        // % on both sides = contains search
        // id != ? = excludes ypurself from results
        //LIMIT 20 = never return too many results

        res.json({ users });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// GET /api/search/messages?q=hello
// Search messages across all channels user is in
router.get('/messages', async (req, res) => {
    const { q, channelId } = req.query;
    const userId = req.user.id;

    if (!q || q.trim().length < 1) {
        return res.status(400).json({ error: 'Search query required' });
    }

    try {
        let query;
        let params;

        if (channelId) {
            // Search within a specific channel
            // First verify membership
            const [membership] = await db.query(
                'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
                [channelId, userId]
            );

            if (membership.length === 0) {
                return res.status(403).json({ error: 'Not a member' });
            }

            query = `
        SELECT m.id, m.content, m.image_url, m.created_at,
               u.id as sender_id, u.username,
               c.id as channel_id, c.name as channel_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN channels c ON m.channel_id = c.id
        WHERE m.channel_id = ?
          AND m.content LIKE ?
        ORDER BY m.created_at DESC
        LIMIT 50
      `;
            params = [channelId, `%${q.trim()}%`];

        } else {
            // Search across ALL channels user is in
            // JOIN channel_members ensures user can only see
            // messages from channels they belong to
            query = `
        SELECT m.id, m.content, m.image_url, m.created_at,
               u.id as sender_id, u.username,
               c.id as channel_id, c.name as channel_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN channels c ON m.channel_id = c.id
        JOIN channel_members cm ON m.channel_id = cm.channel_id
        WHERE cm.user_id = ?
          AND m.content LIKE ?
          AND m.content IS NOT NULL
        ORDER BY m.created_at DESC
        LIMIT 50
      `;
            params = [userId, `%${q.trim()}%`];
        }

        const [messages] = await db.query(query, params);

        res.json({ messages });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;