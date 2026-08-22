const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

//all channel routes are protected
//apply authMiddleware to every route in this file at once
router.use(authMiddleware)
//applies middleware to all routes defines after it in this file 
//cleaner than adding it to every route individually


//POST /api/channels
router.post('/', async (req, res) => {
  const { name, is_group = true } = req.body;
  //req.user comes from authMiddleware - it decoded the JWT
  const userId = req.user.id;

  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Channel name required' });
  }

  try {
    //create channel row
    const [result] = await db.query(
      'INSERT INTO channels (name, is_group, created_by) VALUES (?,?,?)',
      [name.trim(), is_group, userId]
    );

    const channelId = result.insertId;

    //creator automatically becomes a memeber with the admin role
    // you can't create a channel and not be in it
    await db.query(
      'INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)',
      [channelId, userId, 'admin']
    );

    res.status(201).json({
      message: 'Channel Created',
      channel: { id: channelId, name, is_group, created_by: userId }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
});
// two queries in one rout - fist create the channel, then add creator
// as admin member. both must succeed

//JOIN CHANNEL

// router.post('/:id/join', async (req, res) => {
//   const channelId = req.params.id;
//   const userId = req.user.id;

//   try {
//     //check the channel if its exists or not
//     const [channel] = await db.query(
//       'SELECT * FROM channels WHERE id = ?',
//       [channelId]
//     );

//     if (channel.length === 0) {
//       return res.status(404).json({ error: 'Channel not found' });
//     }

//     //check if already a member - prevent duplicate rows
//     //channel_members has a composite primary key (channel_id,user_id)
//     //so inserting a duplicate would throw a DB error anyway
//     //but checking first gives a cleaner error message
//     const [existing] = await db.query(
//       'SELECT * FROM channel_members WHERE channel_id = ? AND user_id=?',
//       [channelId, userId]
//     );

//     if (existing.length > 0) {
//       return res.status(200).json({ error: "Already a member" });
//     }

//     await db.query(
//       'INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)',
//       [channelId, userId, 'member']
//     );

//     res.json({ message: 'Joined Channel' });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// GET /api/channels/all
router.get('/all', async (req, res) => {
  try {
    // Get all group channels so users can browse and join
    const [channels] = await db.query(
      `SELECT c.id, c.name, c.created_at,
              COUNT(cm.user_id) as member_count
       FROM channels c
       LEFT JOIN channel_members cm ON c.id = cm.channel_id
       WHERE c.is_group = true
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      []
    );

    res.json({ channels });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

//GET /api/channels/:id

router.get('/:id', async (req, res) => {
  const channelId = req.params.id;
  const userId = req.user.id;

  try {
    //verify requesting user is actually a member
    const [membership] = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );

    if (membership.length === 0) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    //get channel info
    const [channel] = await db.query(
      'SELECT * FROM channels WHERE id = ?',
      [channelId]
    );

    //get all members of this channel with their username
    const [members] = await db.query(
      'SELECT u.id, u.username, u.avatar_url, cm.role FROM users u JOIN channel_members cm ON u.id = cm.user_id WHERE cm.channel_id = ?',
      [channelId]
    );

    res.json({
      channel: channel[0],
      members
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/channels
router.get('/', async (req, res) => {
  const userId = req.user.id;

  try {
    // JOIN query — fetch all channels this user is a member of
    // channel_members links users to channels
    const [channels] = await db.query(
      `SELECT c.id, c.name, c.is_group, c.created_by, c.created_at, cm.role
       FROM channels c
       JOIN channel_members cm ON c.id = cm.channel_id
       WHERE cm.user_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    res.json({ channels });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/channels/:id/join
router.post('/:id/join', async (req, res) => {
  const channelId = req.params.id;
  const userId = req.user.id;

  try {
    // Check channel exists
    const [channel] = await db.query(
      'SELECT * FROM channels WHERE id = ?',
      [channelId]
    );

    if (channel.length === 0) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Check if already a member — prevent duplicate rows
    // channel_members has a composite primary key (channel_id, user_id)
    // so inserting a duplicate would throw a DB error anyway,
    // but checking first gives a cleaner error message
    const [existing] = await db.query(
      'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already a member' });
    }

    await db.query(
      'INSERT INTO channel_members (channel_id, user_id, role) VALUES (?, ?, ?)',
      [channelId, userId, 'member']
    );

    res.json({ message: 'Joined channel', channelId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



module.exports = router;