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

app.use('/api/channels', channelRoutes);

app.use('/api/messages', messageRoutes);

app.use('/api/dms', dmRoutes);

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

// This fires every time a browser tab opens a socket connection
io.on('connection', async (socket) => {
  console.log(`${socket.user.username} connected ${socket.id}`);

  try {
    //when user connects, fetch all their channels from db
    //and join the corresponding socket.io rooms automatically
    //this means they start instantly start receiving messages from
    //all their channels without any extra client side action

    const [channels] = await db.query(
      `SELECT channel_id FROM channel_members cm
       JOIN channels c ON cm.channel_id = c.id
       WHERE cm.user_id = ? AND c.is_dm = FALSE`,
      [socket.user.id]
    );

    channels.forEach((row) => {
      //Socket.IO room name = 'channel_<id>
      //eg channel_1, channel_2 etc
      socket.join(`channel_${row.channel_id}`);
    });

    //Join DM rooms too
    const [dms] = await db.query(
      `SELECT channel_id FROM channel_members cm
      JOIN channels c ON cm.channel_id = c.id
      WHERE cm.user_id = ? AND c.is_dm = TRUE`,
      [socket.user.id]
    );

    dms.forEach(row => socket.join(`channel_${row.channel_id}`));

    console.log(`${socket.user.username} joined ${channels.length} channels, ${dms.length} DMs`);


  } catch (err) {
    console.error('Error joining rooms:', err);
  }

  // When user joins a new channel mid-session,
  // add them to the socket room immediately
  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
    console.log(`${socket.user.username} joined room channel_${channelId}`);
  });

  //join dms mid session
  socket.on('join_dm', (dmId) => {
    socket.join(`dm_${dmId}`);
    console.log(`${socket.user.username} joined room dm_${dmId}`);
  })

  //SEND MESSAGE 
  //cleint emits this when user hits send
  //{ channelId, content} comes from the react input.
  socket.on('send_message', async ({ channelId, content }) => {

    console.log('send_message hit:', channelId, content);
    //Never trust the client - validate on server too
    if (!content || !content.trim()) return;
    if (!channelId) return;



    try {
      //verify sender is actually a memeber of this channel
      //without this anyone can emit send_message
      //with any channelId and post into channels they never joined
      const [membership] = await db.query(
        'SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
        [channelId, socket.user.id]
      );

      if (membership.length === 0) {
        socket.emit('error', { message: "Not a member of this channel" });
        return;
      }

      //save messages to DB first - then broadcast
      //if you broadcast first and then DB insert fails
      //everyone sees a message that doesn't actaully exist
      const [result] = await db.query(
        'INSERT INTO messages (channel_id, sender_id, content) VALUES (?,?,?)',
        [channelId, socket.user.id, content.trim()]
      );

      //build the message object to send to clients-
      //same shape as what the REST endpoint returns
      // so frontend can handle both identically
      const newMessage = {
        id: result.insertId,
        channel_id: channelId,
        content: content.trim(),
        sender_id: socket.user.id,
        username: socket.user.username,
        created_at: new Date().toISOString()
      };

      //io.on() broadcasts to everyone in the  room including sender.
      //THis is intentional - sender needs to see their own message
      //appear with the proper DB id and timestamp
      console.log('emitting to room:', `channel_${channelId}`);
      io.to(`channel_${channelId}`).emit('new_message', newMessage);
      console.log('newMessage object:', newMessage);

    } catch (err) {
      console.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to load message' })

    }
  });

  //-----DM messages----------------------
  socket.on('send_dm', async ({ dmId, content }) => {
    if (!content?.trim() || !dmId) return;

    try {
      //verify sender is a member of this DM
      const [membership] = await db.query(
        `SELECT cm.* FROM channel_members cm
        JOIN channels c ON cm.channel_id = c.id
        WHERE cm.channel_id = ? AND cm.user_id = ? AND c.is_dm = TRUE`,
        [dmId, socket.user.id]
      );

      if (membership.length === 0) {
        socket.emit('error', { message: "Not a member of this DM" });
        return;
      }


      //save to messages table - same table as group messages
      const [result] = await db.query(
        `INSERT INTO messages (channel_id, sender_id, content) VALUES (?, ?, ?)`,
        [dmId, socket.user.id, content.trim()]
      );

      const newDM = {
        id: result.insertId,
        dm_id: dmId,
        sender_id: socket.user.id,
        content: content.trim(),
        username: socket.user.username,
        created_at: new Date().toISOString()
      };

      //Broadcast to dm room - both users receive at
      io.to(`dm_${dmId}`).emit('new_dm', newDM);


    } catch (error) {
      console.error(error);
      socket.emit('error', { message: 'Failed to send DM' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`${socket.user.username} disconnected`);
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));