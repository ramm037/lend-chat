const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/reads/unread
// Returns unread message count per channel for current user
router.get('/unread', async (req, res) => {
    const userId = req.user.id;

    try {
        //for each channel the user is in count messages
        //created AFTER their last_read_at timestamp
        // if no last_read entry exists, all messages are unread
        const [unreadCounts] = await db.query(
            `SELECT
              cm.channel_id,
              COUNT(m.id) as unread_count
              FROM channel_members cm
              LEFT JOIN messages m ON m.channel_iid = cm.channel_id
              LEFT JOIN channel_last_read clr
                ON clr.channel_id = cm.channel_id
                AND clr.used_id = cm.user_id
              WHERE cm.user_id = ?
                AND (clr.last_read_at IS NULL OR m.created_at > clr.last_read_at)
                AND m.sender_id != ?
              GROUP BY cm.channel_id`,
            [userId, userId]
        );

        //convert array into object
        const unreadMap = {};
        unreadCounts.forEach(row => {
            unreadMap[row.channel_id] = row.unread_count;
        });

        res.json({ unread: unreadMap })
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

//POST /api/reads/mark
//called  when a user opens a channel - marks everything as read
router.post('/mark', async (req, res) => {
    const { channelId } = req.body;
    const userId = req.user.id

    if (!channelId) {
        return res.status(400).json({ error: 'channelId required' });
    }

    try {
        //upsert - insert if not exists, update if exists
        // ON DUPLICATE KEY UPDATE handles the composite primary key
        await db.query(
            `INSERT INTO channel_last_read (user_id, channel_id, last_read_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
            [iserId, channelId]
        );

        res.json({ message: 'Marked as read', channelId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
