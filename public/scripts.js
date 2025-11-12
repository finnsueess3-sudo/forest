const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let players = {};
let myId = null;
const speed = 3;
const size = 20;
let attacking = false;

const keys = {};

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') {
    attack();
  }
});

document.addEventListener('keyup', e => {
  keys[e.key.toLowerCase()] = false;
});

socket.on('connect', () => {
  myId = socket.id;
});

socket.on('currentPlayers', (data) => {
  players = data;
});

socket.on('newPlayer', ({ id, data }) => {
  players[id] = data;
});

socket.on('playerDisconnected', (id) => {
  delete players[id];
});

socket.on('playerMoved', ({ id, data }) => {
  if (players[id]) players[id] = data;
});

socket.on('playerHit', ({ id, hp }) => {
  if (players[id]) players[id].hp = hp;
});

function attack() {
  if (attacking) return;
  attacking = true;
  socket.emit('attack');
  setTimeout(() => (attacking = false), 400);
}

function update() {
  const me = players[myId];
  if (!me) return;

  let moved = false;
  if (keys['w']) { me.y -= speed; me.facing = 'up'; moved = true; }
  if (keys['s']) { me.y += speed; me.facing = 'down'; moved = true; }
  if (keys['a']) { me.x -= speed; me.facing = 'left'; moved = true; }
  if (keys['d']) { me.x += speed; me.facing = 'right'; moved = true; }

  if (moved) {
    socket.emit('move', { x: me.x, y: me.y, facing: me.facing });
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let id in players) {
    const p = players[id];
    ctx.fillStyle = id === myId ? 'cyan' : 'red';
    ctx.fillRect(p.x, p.y, size, size);

    // HP-Balken
    ctx.fillStyle = 'white';
    ctx.fillRect(p.x, p.y - 10, 20, 4);
    ctx.fillStyle = 'lime';
    ctx.fillRect(p.x, p.y - 10, (p.hp / 4) * 20, 4);
  }
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
