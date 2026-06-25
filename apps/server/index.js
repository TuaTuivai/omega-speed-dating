const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

let matchmakingQueue = [];
let activeRooms = {}; // Track room metadata (like active likes)

io.on('connection', (socket) => {
  console.log(`📡 User connected: ${socket.id}`);

  socket.on('join-queue', () => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    if (!matchmakingQueue.includes(socket.id)) {
      matchmakingQueue.push(socket.id);
      console.log(`👥 Queue updated. Total waiting: ${matchmakingQueue.length}`);
    }

    if (matchmakingQueue.length >= 2) {
      const player1Id = matchmakingQueue.shift();
      const player2Id = matchmakingQueue.shift();
      const roomName = `room-${player1Id}-${player2Id}`;

      const p1Socket = io.sockets.sockets.get(player1Id);
      const p2Socket = io.sockets.sockets.get(player2Id);

      if (p1Socket) p1Socket.join(roomName);
      if (p2Socket) p2Socket.join(roomName);

      // Initialize match state tracking
      activeRooms[roomName] = {
        users: [player1Id, player2Id],
        likes: {}
      };

      io.to(roomName).emit('match-found', { room: roomName });
      console.log(`⚡ MATCH CREATED: ${roomName}`);
    }
  });

  socket.on('send-message', (data) => {
    socket.to(data.room).emit('receive-message', { text: data.text });
  });

  // Handle Mutual Like Logic
  socket.on('like-match', (data) => {
    const room = activeRooms[data.room];
    if (room) {
      room.likes[socket.id] = true;
      console.log(`❤️ Like registered from ${socket.id} in room ${data.room}`);

      // Check if EVERY user in this specific room has pressed the Like button
      const isMutualMatch = room.users.every(userId => room.likes[userId] === true);
      if (isMutualMatch) {
        io.to(data.room).emit('mutual-match');
        console.log(`🎉 MUTUAL MATCH LOCKED IN: ${data.room}`);
      }
    }
  });

  socket.on('skip-match', (data) => {
    if (data.room) {
      console.log(`🛑 Match dissolved in room: ${data.room}`);
      io.to(data.room).emit('match-terminated');
      delete activeRooms[data.room]; // Safe memory clean up
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    matchmakingQueue = matchmakingQueue.filter(id => id !== socket.id);
    
    // Dissolve any active rooms the disconnected user was occupying
    for (const roomName in activeRooms) {
      if (activeRooms[roomName].users.includes(socket.id)) {
        io.to(roomName).emit('match-terminated');
        delete activeRooms[roomName];
      }
    }
  });
});

server.listen(5000, () => {
  console.log('🚀 BACKEND V4 RUNNING ON PORT 5000');
});