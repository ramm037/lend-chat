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

//This fires every time a browser tab opens a socket connection
//socket auth middle ware
//runs before every socket connection'
//verifies the access token the cleint sends in the socket handshake

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('token received in socket:' , token);
  console.log('secret being used', )


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

io.on('connection', (socket) => {
  console.log(`${socket.user.username} connected ${socket.id}`);

  try{
    //when user connects, fetch all their channels from db
    //and join the corresponding socket.io rooms automatically
    //this means they start instantly start receiving messages from
    //all their channels without any extra client side action

    const [channels] = db.query(
      `SELECT channel_id FROM channel_members WHERE user_id = ?`,
      [socket.user.id]
    );

    channels.forEach((row) => {
      //Socket.IO room name = 'channel_<id>
      //eg channel_1, channel_2 etc
      socket.join(`channel_${row.channel_id}`);  
    });

    console.log(`${socket.user.username} joined ${channels.length} channel rooms`);
  }catch (err) {
    console.error('Error joining rooms:', err);
  }

  // When user joins a new channel mid-session,
  // add them to the socket room immediately
  socket.on('join_channel', (channelId) => {
    socket.join(`channel_${channelId}`);
    console.log(`${socket.user.username} joined room channel_${channelId}`);
  });

  socket.on('disconnect', () => {
    console.log(`${socket.user.username} disconnected`);
  });
});



// This fires every time a browser tab opens a socket connection


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));