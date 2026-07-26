const express = require('express');
const redis = require('../redis');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authMiddleware);

// GET /api/presence 
// Returns online status of all users in yours channel
router.get('/', async (req,res) => {
    const usrId = req.user.id;

    try {
        //GET all users who share a achannel with you
        const [users] = await db.query(
            `SELECT DISTINCT u.id, u.username, u.avatar_url
            FROM users u
            JOIN channel_members cm1 ON u.id = cm1.user_id
            JOIN channel_members cm2 ON cm1.channel_id = cm2.channel_id
            WHERE cm2.user_id = ? AND u.id != ?`,
            [userId, userId]
        );

        //check Redis for each user's online status
        //Promise.all runs all Redis checs simultaneously
        const usersWithStatus = await Promise.all(
            users.map(async (users) => {
                const isOnline = await redis.get(`online:${user.id}`);
                return {
                    ...user,
                    isOnline: !!isOnline //convert tp boolean
                };
            })
        );

        res.json({ users: userWithStatus });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'Server error'});
    }
});

module.exports = router;