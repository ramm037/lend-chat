const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/notifications
// Get all notifications for current user
router.get('/', async (req, res) => {
  const userId = req.user.id;

  try {
    const [notifications] = await db.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    res.json({ notifications });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/mark-read
// Mark all notifications as read
router.post('/mark-read', async (req, res) => {
  const userId = req.user.id;

  try {
    await db.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
      [userId]
    );

    res.json({ message: 'Notifications marked as read' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id
// Delete a single notification
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    await db.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    res.json({ message: 'Notification deleted' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;