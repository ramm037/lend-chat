const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

//----GET all users (to start a DM with someone) -------
//GET /api/dms/users
router.get('/users', async (req, res) => {
    const userId = req.user.id;

    try {
        //get all users except yourself
        const [users] = await db.query(
            `SELECT id, username, avatar_url
            FROM users
            WHERE id != ?
            ORDER BY username ASC`,
            [userId]
        );

        res.json({ users });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// CREATE or GET Existing DM----------
//POST /api/dms
//if DM already exists between two users, return it
//if not create it. This prevents duplicate DM conversations
router.post('/', async (req, res) => {
    const { targetUserId } = req.body;
    const userId = req.user.id;

    if (!targetUserId) {
        return res.status(400).json({ error: "targetUserId required" });
    }

    if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot DM yourself' });
    }

    try {
        //check if dm exists between these two users
        //logic: find a channel that is a dm, where both users are members
        //we use COUNT and HAVING to ensure both users are in the same channel
        const [existing] = await db.query(
            `SELECT c.id FROM channels c
            JOIN channel_members cm1 ON c.id = cm1.channel_id AND cm1.user_id = ?
            JOIN channel_members cm2 ON c.id = cm2.channel_id AND cm2.user_id = ?
            WHERE c.is_dm = TRUE
            LIMIT 1`,
            [userId, targetUserId]
        );

        //Dm already exists return it
        if (existing.length > 0) {
            return res.json({ dmId: existing[0].id, alreadyExisted: true });
        }

        //get target user's username for the channel name
        const [targetUser] = await db.query(
            `SELECT username FROM users WHERE id = ?`,
            [targetUserId]
        );

        if (targetUser.length === 0) {
            return res.status(404).json({ error: 'User not Found' });
        }

        //create a new dm
        //Name format: 'dm_userId1_userId2' - internal, not shown in UI
        const [result] = await db.query(
            `INSERT INTO channels (name, is_group, is_dm, created_by) VALUES (?, FALSE, TRUE, ?)`,
            [`dm_${userId}_${targetUserId}`, userId]
        );

        const dmId = result.insertId;

        //add both users as members
        await db.query(
            `INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, 'member'), (?, ?, 'member')`,
            [dmId, userId, dmId, targetUserId]
        );

        res.status(201).json({ dmId, alreadyExisted: false });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

//GET ALL MY DMs----------------------
//GET /api/dms
router.get('/', async (req, res) => {
    const userId = req.user.id;

    try {
        //fetch all dm conversations for current year
        //join to get the OTHER user's name (not yours)
        const [dms] = await db.query(
            `SELECT c.id, u.id as other_user_id, u.username as other_username,
                    u.avatar_url as other_avatar
             FROM channels c
             JOIN channel_members cm ON c.id = cm.channel_id AND cm.user_id = ?
             JOIN channel_members cm2 ON c.id = cm2.channel_id AND cm2.user_id != ?
             JOIN users u ON cm2.user_id = u.id
             WHERE c.is_dm = TRUE
             ORDER BY c.created_at DESC`,
            [userId, userId]
        );

        res.json({ dms });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;