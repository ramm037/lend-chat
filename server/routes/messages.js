const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

//get/api/messages/:channelId'
// loads existing messages when user opens a channel
//REST is here because we are retrieving data from the server
//full message histrory is required here not just new ones arriving in real time

router.get('/:channelId', async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.id;

    try {
        //security check :: only members of a channel can see its messages
        const [membership] = await db.query(
            'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );

        if (membership.length === 0) {
            return res.status(403).json({ error: 'Not a member of this channel' });
        }

        //FETCH MESSAGES WITH SENDER USERNAME JOINED IN-
        //messages table only stores sender_id, noy username, so we join with users table to get the username
        //JOIN gets the username so front end doesn't need a 
        //separate request per message to find out who sent it
        const [messages] = await db.query(
            `SELECT m.id, m.content, m.image_url, m.created_at,
                    u.id as sender_id, u.username, u.avatar_url
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.channel_id = ?
            ORDER BY m.created_at ASC`,
            [channelId]
        );

        res.json({ messages });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;