// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = {};

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  // Startposition zufällig innerhalb kleiner Range
  players[socket.id] = { x: (Math.random()-0.5)*20, y:0, z:(Math.random()-0.5)*20, hp:100, weapon:"sword" };

  // sende aktuellen Zustand an neuen Spieler
  socket.emit("currentPlayers", players);
  socket.broadcast.emit("newPlayer", { id: socket.id, ...players[socket.id] });

  socket.on("move", (data) => {
    // minimal validieren
    players[socket.id] = { ...players[socket.id], ...data };
    socket.broadcast.emit("playerMoved", { id: socket.id, ...players[socket.id] });
  });

  socket.on("attack", (payload) => {
    // payload: { targetId, type }
    if(!payload) return;
    const target = payload.targetId;
    const type = payload.type || "sword";
    if(target && players[target]){
      const dmg = type === "bow" ? 15 : 10;
      players[target].hp = Math.max(0, players[target].hp - dmg);
      io.emit("playerHit", { id: target, hp: players[target].hp });
    }
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));
