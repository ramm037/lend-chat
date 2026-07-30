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






const app = express();
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
})); // Vite default port
app.use(express.json());

//cookie parser must come before routes so req.cookies is available 
app.use(cookieParser());

// Wrap Express in a raw HTTP server — Socket.IO needs this,
// it can't attach directly to the Express app object.
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true
  }
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

app.usw('/api/routes', readsRoutes);

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

    //REDIS PRESENCE - SET ONLINE -----------------------------
    //STORE USER AS ONLINE IN REDIS
    //EX 3600 = KEY EXPIRES AFTER 1 HOUR AUTOMATICALLY  
    //THIS MEANS EVEN IF DISCONNECT EVENT SOMEHOW MISSES
    //USER WON'T APPEAR ONLINE FOREVER
    await redis.set(`online:${userId}`, 'true', 'EX', 3600);

    //notify everyone in users's channels that user is now online
    channels.forEach(row => {
      socket.to(`channel_${row.channel_id}`).emit('user_online', {
        userId,
        username
      });
    });

  } catch (err) {
    console.error('Connection error:', err);
  }

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

      io.to(`channel_${channelId}`).emit('new_message', newMessage);
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
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to send DM' });
    }
  });

  //TYPING INDICATOR ---------------------------------------------------
  //CLIENT emits this when user starts typing
  //server broadcasts to the room - everyone sees the indicator
  //Nothing is aved to db typing state is purely real time

  socket.on('typing_start', ({ channelId, isDM }) => {
    const room = isDM ? `dm_${channelId}` : `channel_${channelId}`;

    //socket.to() excludes sender - you don't need to see
    //your own typing indictaor

    socket.to(room).emit('user_typing', {
      userId,
      username,
      channelId,
      isDM
    });
  });

  //clients emits this when user stops typing
  socket.on('typing_stop', ({ channelId, isDM }) => {
    const room = isDM ? `dm_${channelId}` : `channel_${channelId}`;

    socket.to(room).emit('user_stopped_typing', {
      userId,
      username,
      channelId,
      isDM
    });
  });

  //---DISCONNECT - SET OFFLINE----------------------------
  socket.on('disconnect', async () => {
    console.log(`${username} disconnected`);

    try {
      //remove from redis user is now offline
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
        socket.to(`channel_${row.channel_id}`).emit('user_offline', {
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
        VALUES (?, ?. NOW())
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
    } catch (err) {
      console.error('mark_read error:', err)
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));




