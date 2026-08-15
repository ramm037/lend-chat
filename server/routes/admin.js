const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

//Middleware - check if requesting user is admin of the channel
const isAdmin = async (req, res, next) => {
    const userId = req.user.id;
    const channelId = req.params.channelId || req.body.channelId;

    try {
        const [membership] = await db.query(
            'SELECT role from channel_members WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );

        if (membership.length === 0 || membership[0].role !== 'admin') {
            return res.status(400).json({ error: 'Admin Access Required' });
        }

        next();
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
};

//DELETE /api/admin/channels/:channelId/messages/:messaeId
//Admin deletes a specific message
router.delete('/channels/:channelId/messages/:messageId', isAdmin, async (req, res) => {
    const { messageId, channelId } = req.params;

    try {
        //verify message belongs to this channel
        const [message] = await db.query(
            'SELECT * FROM messages WHERE id = ? AND channel_id = ?',
            [messageId, channelId]
        );

        if (message.length === 0) {
            return res.status(404).json({ error: 'Messages npt found' });
        }

        await db.query('DELETE FROM messages WHERE id = ?', [messageId]);

        res.json({ message: 'Message Deleted', messageId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// DELETE/api/admin/channels/:channelId/members/:userId
// Admin kicks user from channel
router.delete('/channels/:channelId/members/:userId', isAdmin, async (req, res) => {
    const { channelId, userId: targetUserId } = req.params;
    const adminId = req.user.id;

    //admin cannot kick himself
    if (parseInt(targetUserId) === adminId) {
        return res.status(400).json({ error: 'Cannot kick yourself' });
    }

    try {
        const [membership] = await db.query(
            'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
            [channelId, targetUserId]
        );

        if (membership.length === 0) {
            return res.status(404).json({ error: 'User not in channel' });
        }

        //remove from channnel
        await db.query(
            'DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?',
            [channelId, targetUserId]
        );

        //create notification for kicked user
        await db.query(
            `INSERT INTO notifications (user_id, type, content, channel_id)
            VALUES (?, 'kicked', ?, ?)`,
            [targetUserId, 'You were removes from the channel by Admin', channelId]
        );

        res.json({ message: 'User kicked', targetUserId, channelId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

//DELETE /api/admin/channels/:channelId
//Admin deleted entire channel
router.delete('/channels/:channelId', isAdmin, async (req, res) => {
    const { channelId } = req.params;

    try {
        //MySQL CASCADE handles deleting channel_members and messages
        //because of ON DELETE CASCADE on foreign keys
        await db.query('DELETE FROM channels WHERE id = ?', channelId);

        res.json({ message: 'Channel Deleted', channelId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' })
    }
});

module.exports = router;