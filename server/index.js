require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const channelRoutes = require('./routes/channel')
const authRoutes = require('./routes/auth');
const db = require('./db');
const messageRoutes = require('./routes/messages');
const dmRoutes = require('./routes/dm')
const redis = require('./redis');
const presenceRoutes = require('./routes/presence');
const readsRoutes = require('./routes/reads');
const uploadRoutes = require('./routes/upload');
const searchRoutes = require('./routes/search');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const socketRateLimit = require('./middleware/socketRateLimiter');




const app = express();
const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const corsOptions = {
  origin(origin, callback) {
    // Requests without an Origin header are non-browser clients such as curl.
    if (!origin || clientOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true
};

app.use(cors({
  ...corsOptions
}));
app.use(express.json());

//cookie parser must come before routes so req.cookies is available 
app.use(cookieParser());

// Wrap Express in a raw HTTP server — Socket.IO needs this,
// it can't attach directly to the Express app object.
const server = http.createServer(app);

const io = new Server(server, {
  cors: corsOptions,
  // Defaults are suitable for normal networks; explicit values make the
  // heartbeat behaviour clear and avoid short proxy idle timeouts.
  pingInterval: 25000,
  pingTimeout: 60000
});

// Basic REST route to confirm Express itself is alive
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);

app.use('/api/presence', presenceRoutes);

app.use('/api/channels', channelRoutes);

app.use('/api/messages', messageRoutes);

app.use('/api/dms', dmRoutes);

app.use('/api/reads', readsRoutes);

app.use('/api/upload', uploadRoutes);

app.use('/api/search', searchRoutes);

app.use('/api/notifications', notificationRoutes);

app.use('/api/admin', adminRoutes);

//Apply general rate limter to all routes
app.use('/api/', apiLimiter);

//404 handler - must come after all routes
app.use(notFound);

//Global error handler - must be last after all routes and middleware
app.use(errorHandler)

//This fires every time a browser tab opens a socket connection
//socket auth middle ware
//runs before every socket connection'
//verifies the access token the cleint sends in the socket handshake

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('token received in socket:', token);
  console.log('secret being used',)


  if (!token) {
    return next(new Error('No token'));
  }

  try {
    // use access secret here =- socket sends access token, not refresh token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Invalid Token'));
  }
});

io.on('connection', async (socket) => {
  console.log(`${socket.user.username} connected (${socket.id})`);

  const userId = socket.user.id;
  const username = socket.user.username;

  try {
    //JOIN GROUP CHANNELS------------------------------
    const [channels] = await db.query(
      `SELECT channel_id FROM channel_members cm
       JOIN channels c ON cm.channel_id = c.id
       WHERE cm.user_id = ? AND c.is_dm = FALSE`,
      [userId]
    );

    channels.forEach(row => socket.join(`channel_${row.channel_id}`));

    //JOIN DM ROOMS ------------------------------------
    const [dms] = await db.query(
      `SELECT channel_id FROM channel_members cm
       JOIN channels c ON cm.channel_id = c.id
       WHERE cm.user_id = ? AND c.is_dm = TRUE`,
      [userId]
    );
    console.log('DM rooms joining:', dms.length);
    dms.forEach(row => socket.join(`dm_${row.channel_id}`));

    console.log(`${username} joined ${channels.length} channels, ${dms.length} DMs`);


    // Each user joins their own personal room for targeted notifications
    socket.join(`user_${userId}`);
    console.log(`${username} joined personal room user_${userId}`);

    //REDIS PRESENCE - SET ONLINE -----------------------------
    //STORE USER AS ONLINE IN REDIS
    //EX 86400 = KEY EXPIRES AFTER one day automatically.
    //THIS MEANS EVEN IF DISCONNECT EVENT SOMEHOW MISSES
    //USER WON'T APPEAR ONLINE FOREVER
    const presenceKey = `online:${userId}`;
    const wasOffline = !(await redis.get(presenceKey));
    await redis.set(presenceKey, 'true', 'EX', 86400);

    // Only announce once. A user may connect from several tabs/devices.
    if (wasOffline) {
      channels.forEach(row => {
        socket.to(`channel_${row.channel_id}`).emit('user_online', {
          userId,
          username
        });
      });
    }

  } catch (err) {
    console.error('Connection error:', err);
  }

  //members join update
  socket.on('member_joined', async ({ channelId }) => {
    try {
      const [members] = await db.query(
        `SELECT u.id, u.username, u.avatar_url, cm.role
             FROM users u
             JOIN channel_members cm ON u.id = cm.user_id
             WHERE cm.channel_id = ?`,
        [channelId]
      );

      io.to(`channel_${channelId}`).emit('members_updated', {
        channelId,
        members
      });
    } catch (err) {
      console.error('members_upadated error:', err);
    }
  })

  // Broadcast image message to channel room
  socket.on('send_channel_image', ({ channelId, newMessage }) => {

    //invalidate cache when image sent 
    redis.del(`messages:${channelId}:latest`);


    console.log('send_channel_image received:', channelId);

    const messageWithChannelId = {
      ...newMessage,
      channel_id: channelId
    };

    io.to(`channel_${channelId}`).emit('new_message', messageWithChannelId);
  });

  // Broadcast image message to DM room
  socket.on('send_dm_image', ({ dmId, newMessage }) => {
    console.log('send_dm_image received:', dmId);

    // Add dm_id to newMessage so DMView filter works
    const messageWithDmId = {
      ...newMessage,
      dm_id: dmId
    };

    io.to(`dm_${dmId}`).emit('new_dm', messageWithDmId);
  });

  //JOIN CHANNEL MID SESSION-------------------------------------
  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
  });

  //JOIN DM MID-SESSION--------------------------------
  socket.on('join_dm', (dmId) => {
    socket.join(`dm_${dmId}`);
  });

  //SEND GRP MESSAGE
  socket.on('send_message', async ({ channelId, content }) => {
    if (!content?.trim() || !channelId) return;

    try {
      //check rate limit - 30 messages per minute per user
      const allowed = await socketRateLimit(userId, 'send_message', 30, 60);
      if (!allowed) {
        socket.emit('error', { message: 'Youu are sending messages too fast. Slow down!' });
        return;
      }
      const [membership] = await db.query(
        'SELECT * FROM channel_members WHERE channel_id=? AND user_id = ?',
        [channelId, userId]
      );

      if (membership.length === 0) {
        socket.emit('error', { message: 'Not a members' });
        return;
      }

      const [result] = await db.query(
        'INSERT INTO messages (channel_id, sender_id, content) VALUES (?, ?, ?)',
        [channelId, userId, content.trim()]
      );

      const newMessage = {
        id: result.insertId,
        channel_id: channelId,
        content: content.trim(),
        sender_id: userId,
        username,
        created_at: new Date().toISOString()
      };

      //inavlidate redis cache for this channel-
      //next fetch will get fresh data from db includig this message
      await redis.del(`messages:${channelId}:latest`);

      io.to(`channel_${channelId}`).emit('new_message', newMessage);

      //create notifications for all OTHER members in the channel
      const [members] = await db.query(
        'SELECT user_id FROM channel_members WHERE channel_id = ? AND user_id != ?',
        [channelId, userId]
      );

      // Emit real time notification for each member
      for (const member of members) {
        await db.query(
          `INSERT INTO notifications (user_id, type, content, channel_id) 
         VALUES (?, 'message', ?, ?)`,
          [member.user_id, `${username}: ${content.trim().substring(0, 50)}`, channelId]
        );

        //emit real-time notification to that user if online
        io.to(`user_${member.user_id}`).emit('new_notification', {
          type: 'message',
          content: `${username}: ${content.trim().substring(0, 50)}`,
          channelId
        });
      }
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });


  //SEND DM---------------------------------------------------


  socket.on('send_dm', async ({ dmId, content }) => {
    if (!content?.trim() || !dmId) return;

    try {
      const [membership] = await db.query(
        `SELECT cm.* FROM channel_members cm
      JOIN channels c ON cm.channel_id = c.id
      WHERE cm.channel_id = ? AND cm.user_id = ? AND c.is_dm = TRUE`,
        [dmId, userId]
      );

      if (membership.length === 0) {
        socket.emit('error', { message: 'Not a member of this DM' });
        return;
      }

      const [result] = await db.query(
        'INSERT INTO messages (channel_id, sender_id, content) VALUES (?, ?, ?)',
        [dmId, userId, content.trim()]
      );

      const newDM = {
        id: result.insertId,
        dm_id: dmId,
        content: content.trim(),
        sender_id: userId,
        username,
        created_at: new Date().toISOString()
      };

      io.to(`dm_${dmId}`).emit('new_dm', newDM);

      //Get the other user in thid DM
      const [otherMembers] = await db.query(
        `SELECT user_id FROM channel_members
         WHERE channel_id = ? AND user_id != ?`,
        [dmId, userId]
      );

      // emit to the other user to join the new DM room
      socket.on('new_dm_created', ({ dmId, targetUserId }) => {
        // Add sender to room
        socket.join(`dm_${dmId}`);
        // Tell receiver to join too
        io.to(`user_${targetUserId}`).emit('join_new_dm', { dmId });
      });

      //send notification to other user
      for (const member of otherMembers) {
        await db.query(
          `INSERT INTO notifications (user_id, type, content, channel_id)
         VALUES (?, 'dm', ?, ?)`,
          [member.user_id, `${username}: ${content.trim().substring(0, 50)}`, dmId]
        );

        io.to(`user_${member.user_id}`).emit('new_notification', {
          type: 'dm',
          content: `${username}: ${content.trim().substring(0, 50)}`,
          channelId: dmId,
          created_at: new Date().toISOString()
        })
      }
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to send DM' });
    }
  });

  //TYPING INDICATOR ---------------------------------------------------
  //CLIENT emits this when user starts typing
  //server broadcasts to the room - everyone sees the indicator
  //Nothing is aved to db typing state is purely real time

  socket.on('typing_start', async ({ channelId, isDM }) => {
    try {
      const userId = socket.user?.id;

      // For DMs, keep your existing DM logic
      if (isDM) {
        // existing DM logic
        return;
      }

      // Check whether user is still a member of the channel
      const [membership] = await db.query(
        `SELECT 1
             FROM channel_members
             WHERE channel_id = ? AND user_id = ?`,
        [channelId, userId]
      );

      // User was kicked / is no longer a member
      if (membership.length === 0) {
        return;
      }

      // User is still a valid member → broadcast typing
      socket.to(`channel_${channelId}`).emit('user_typing', {
        userId,
        username: socket.user.username,
        channelId,
        isDM: false
      });

    } catch (err) {
      console.error('typing_start error:', err);
    }
  });

  socket.on('typing_stop', async ({ channelId, isDM }) => {
    try {
      const userId = socket.user?.id;

      if (isDM) {
        // existing DM logic
        return;
      }

      const [membership] = await db.query(
        `SELECT 1
             FROM channel_members
             WHERE channel_id = ? AND user_id = ?`,
        [channelId, userId]
      );

      if (membership.length === 0) {
        return;
      }

      socket.to(`channel_${channelId}`).emit('user_stopped_typing', {
        userId,
        username: socket.user.username,
        channelId,
        isDM: false
      });

    } catch (err) {
      console.error('typing_stop error:', err);
    }
  });

  // DM message deleted — notify both users in DM
  socket.on('delete_dm_message', ({ dmId, messageId }) => {
    io.to(`dm_${dmId}`).emit('dm_message_deleted', { messageId, dmId });
  });

  socket.on('admin_delete_message', ({ channelId, messageId }) => {
    // Tell all the clients in this channel to remove the message from UI
    io.to(`channel_${channelId}`).emit('message_deleted', { messageId });
  });

  socket.on('admin_kick_user', ({ channelId, targetUserId }) => {
    //Tell the kicked user to leave the channel UI
    io.to(`user_${targetUserId}`).emit('kicked_from_channel', { channelId, targetUserId });

    //Notify eceryone else in the channel
    io.to(`channel_${channelId}`).emit('member_kicked', {
      channelId,
      targetUserId
    });
  });

  socket.on('admin_delete_channel', ({ channelId }) => {
    //notify everyone in the channel
    io.to(`channel_${channelId}`).emit('channel_deleted', { channelId })
  });

  //---DISCONNECT - SET OFFLINE----------------------------
  socket.on('disconnect', async (reason) => {
    console.log(`${username} disconnected (${reason})`);

    try {
      // A single user can have more than one socket. Do not mark them offline
      // until the final tab/device disconnects.
      const remainingSockets = await io.in(`user_${userId}`).fetchSockets();
      if (remainingSockets.length > 0) return;

      await redis.del(`online:${userId}`);

      //get user's channel to notify them
      const [channels] = await db.query(
        `SELECT channel_id FROM channel_members cm
         JOIN channels c ON cm.channel_id = c.id
         WHERE cm.user_id = ? AND c.is_dm = FALSE`,
        [userId]
      );

      // Notify everyone in user's channels that they went offline
      channels.forEach(row => {
        io.to(`channel_${row.channel_id}`).emit('user_offline', {
          userId,
          username
        });
      });
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  });

  // user opened a channel - mark as read and notify sender
  socket.on('mark_read', async ({ channelId }) => {
    if (!channelId) return;

    try {
      //update last_read timestamp
      await db.query(
        `INSERT INTO channel_last_read (user_id, channel_id, last_read_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE last_read_at = NOW()`,
        [userId, channelId]
      );

      //Notify everyone in the channel that this user read the messages
      //sender sees their message was read
      socket.to(`channel_${channelId}`).emit('messages_read', {
        channelId,
        readBy: userId,
        readByUsername: username,
        readAt: new Date().toISOString()
      });

      // Broadcast to everyone that a new user is online
      // so other users' people lists update
      socket.broadcast.emit('user_joined', {
        id: userId,
        username
      });
    } catch (err) {
      console.error('mark_read error:', err)
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));




