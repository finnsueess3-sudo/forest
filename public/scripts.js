const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAP_WIDTH = 3000;
const MAP_HEIGHT = 3000;

let players = {};
let myId = null;
let arrows = [];
let keys = {};
let camera = { x: 0, y: 0 };
let attacking = false;

const speed = 3;
let frame = 0;

// ==== Grafik-Assets ====
const images = {};
const imageList = ["character", "house", "fire", "arrow", "sword", "ground"];
imageList.forEach(name => {
  const img = new Image();
  img.src = `images/${name}.png`;
  images[name] = img;
});

// Animations-Frame-Zähler
setInterval(() => frame = (frame + 1) % 4, 200); // 4 Frames pro Animation

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') attack();
  if (e.key === 'e') shootArrow();
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// ==== Socket.IO Events ====
socket.on('connect', () => myId = socket.id);
socket.on('currentPlayers', d => players = d);
socket.on('newPlayer', ({ id, data }) => players[id] = data);
socket.on('playerDisconnected', id => delete players[id]);
socket.on('playerMoved', ({ id, data }) => players[id] = data);
socket.on('playerHit', ({ id, hp }) => players[id].hp = hp);
socket.on('newArrow', arrow => arrows.push(arrow));

// ==== Spieler-Aktionen ====
function attack() {
  if (attacking) return;
  attacking = true;
  socket.emit('attack');
  setTimeout(() => attacking = false, 300);
}

function shootArrow() {
  const me = players[myId];
  if (!me) return;
  const dir = me.facing;
  const speedArrow = 6;
  const arrow = {
    x: me.x,
    y: me.y,
    dx: dir === 'left' ? -speedArrow : dir === 'right' ? speedArrow : 0,
    dy: dir === 'up' ? -speedArrow : dir === 'down' ? speedArrow : 0,
    lifetime: 100
  };
  arrows.push(arrow);
  socket.emit('shootArrow', arrow);
}

// ==== Update-Funktion ====
function update() {
  const me = players[myId];
  if (!me) return;

  let moved = false;
  if (keys['w']) { me.y -= speed; me.facing = 'up'; moved = true; }
  if (keys['s']) { me.y += speed; me.facing = 'down'; moved = true; }
  if (keys['a']) { me.x -= speed; me.facing = 'left'; moved = true; }
  if (keys['d']) { me.x += speed; me.facing = 'right'; moved = true; }

  me.x = Math.max(0, Math.min(MAP_WIDTH, me.x));
  me.y = Math.max(0, Math.min(MAP_HEIGHT, me.y));
  if (moved) socket.emit('move', { x: me.x, y: me.y, facing: me.facing });

  camera.x = me.x - canvas.width / 2;
  camera.y = me.y - canvas.height / 2;

  // Update Pfeile
  arrows = arrows.filter(a => a.lifetime-- > 0);
  arrows.forEach(a => {
    a.x += a.dx;
    a.y += a.dy;
  });
}

// ==== Zeichnen ====
function drawMap() {
  // Boden
  ctx.fillStyle = '#285128';
  ctx.fillRect(-camera.x, -camera.y, MAP_WIDTH, MAP_HEIGHT);

  // Wege
  ctx.fillStyle = '#b8936b';
  ctx.fillRect(0 - camera.x + 500, 0 - camera.y + 500, 2000, 60);
  ctx.fillRect(0 - camera.x + 1000, 0 - camera.y + 100, 60, 1800);

  // Häuser
  for (let i = 0; i < 6; i++) {
    const hx = 300 * i + 400 - camera.x;
    const hy = 300 * i + 300 - camera.y;
    ctx.drawImage(images.house, hx, hy, 128, 128);
  }

  // Feuerstellen (animiert)
  for (let i = 0; i < 8; i++) {
    const fx = (i * 300 + 250) - camera.x;
    const fy = (i * 200 + 600) - camera.y;
    const fireFrame = Math.floor((Date.now() / 150 + i) % 4);
    ctx.drawImage(images.fire, fireFrame * 32, 0, 32, 32, fx, fy, 32, 32);
  }
}

function drawPlayers() {
  for (let id in players) {
    const p = players[id];
    const px = p.x - camera.x;
    const py = p.y - camera.y;

    // Charakter-Sprite: 4 Richtungen, 4 Frames
    let dirY = 0; // row im Spritesheet
    if (p.facing === 'down') dirY = 0;
    if (p.facing === 'left') dirY = 1;
    if (p.facing === 'right') dirY = 2;
    if (p.facing === 'up') dirY = 3;
    ctx.drawImage(images.character, frame * 32, dirY * 32, 32, 32, px - 16, py - 32, 32, 32);

    // Schwert Animation
    if (id === myId && attacking) {
      let sx = 0, sy = 0;
      if (p.facing === 'up') { sx = 0; sy = 0; ctx.drawImage(images.sword, sx, sy, 32, 32, px - 16, py - 48, 32, 32); }
      if (p.facing === 'down') { sx = 0; sy = 0; ctx.drawImage(images.sword, sx, sy, 32, 32, px - 16, py, 32, 32); }
      if (p.facing === 'left') { sx = 0; sy = 0; ctx.drawImage(images.sword, sx, sy, 32, 32, px - 48, py - 16, 32, 32); }
      if (p.facing === 'right') { sx = 0; sy = 0; ctx.drawImage(images.sword, sx, sy, 32, 32, px + 16, py - 16, 32, 32); }
    }

    // HP-Balken
    ctx.fillStyle = 'white';
    ctx.fillRect(px - 10, py - 36, 20, 4);
    ctx.fillStyle = 'lime';
    ctx.fillRect(px - 10, py - 36, (p.hp / 4) * 20, 4);
  }
}

function drawArrows() {
  for (let a of arrows) {
    ctx.drawImage(images.arrow, 0, 0, 16, 16, a.x - camera.x, a.y - camera.y, 16, 16);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawPlayers();
  drawArrows();
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
