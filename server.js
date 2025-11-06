const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

let players = {};

io.on("connection", socket => {
  console.log("Neuer Spieler:", socket.id);
  players[socket.id] = { x:0, y:0, z:0, hp:100, weapon:'sword' };

  socket.emit("currentPlayers", players);
  socket.broadcast.emit("newPlayer", { id: socket.id, ...players[socket.id] });

  socket.on("move", data => {
    players[socket.id] = data;
    socket.broadcast.emit("playerMoved", { id: socket.id, ...data });
  });

  socket.on("attack", data => {
    // Angriffscode (Schwert/Bogen) hier
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server läuft auf Port", PORT));
