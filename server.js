const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let players = {};

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  players[socket.id] = {
    x: Math.random() * 800,
    y: Math.random() * 600,
    hp: 4,
    facing: 'down'
  };

  socket.emit('currentPlayers', players);
  socket.broadcast.emit('newPlayer', { id: socket.id, data: players[socket.id] });

  socket.on('move', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      players[socket.id].facing = data.facing;
      io.emit('playerMoved', { id: socket.id, data: players[socket.id] });
    }
  });

  socket.on('attack', () => {
    const attacker = players[socket.id];
    if (!attacker) return;

    // Trefferprüfung
    for (let id in players) {
      if (id === socket.id) continue;
      const target = players[id];
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      if (Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        target.hp -= 1;
        if (target.hp <= 0) {
          target.hp = 4;
          target.x = Math.random() * 800;
          target.y = Math.random() * 600;
        }
        io.emit('playerHit', { id, hp: target.hp });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
