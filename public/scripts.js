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

document.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') attack();
  if (e.key === 'e') shootArrow();
});
document.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

socket.on('connect', () => myId = socket.id);
socket.on('currentPlayers', d => players = d);
socket.on('newPlayer', ({ id, data }) => players[id] = data);
socket.on('playerDisconnected', id => delete players[id]);
socket.on('playerMoved', ({ id, data }) => players[id] = data);
socket.on('playerHit', ({ id, hp }) => players[id].hp = hp);
socket.on('newArrow', arrow => arrows.push(arrow));

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
  const speed = 6;
  const arrow = {
    x: me.x,
    y: me.y,
    dx: dir === 'left' ? -speed : dir === 'right' ? speed : 0,
    dy: dir === 'up' ? -speed : dir === 'down' ? speed : 0,
    lifetime: 100
  };
  arrows.push(arrow);
  socket.emit('shootArrow', arrow);
}

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

  arrows = arrows.filter(a => a.lifetime-- > 0);
  arrows.forEach(a => {
    a.x += a.dx;
    a.y += a.dy;
  });
}

function drawMap() {
  ctx.fillStyle = '#285128';
  ctx.fillRect(-camera.x, -camera.y, MAP_WIDTH, MAP_HEIGHT);

  // simple dirt paths
  ctx.fillStyle = '#b8936b';
  ctx.fillRect(0 - camera.x + 500, 0 - camera.y + 500, 2000, 60);
  ctx.fillRect(0 - camera.x + 1000, 0 - camera.y + 100, 60, 1800);

  // Houses (more realistic)
  for (let i = 0; i < 6; i++) {
    const hx = 300 * i + 400 - camera.x;
    const hy = 300 * i + 300 - camera.y;
    // walls
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(hx, hy, 120, 100);
    // roof
    ctx.fillStyle = '#5a1a1a';
    ctx.beginPath();
    ctx.moveTo(hx - 10, hy);
    ctx.lineTo(hx + 60, hy - 40);
    ctx.lineTo(hx + 130, hy);
    ctx.closePath();
    ctx.fill();
    // door
    ctx.fillStyle = '#333';
    ctx.fillRect(hx + 50, hy + 60, 20, 40);
  }

  // campfires
  for (let i = 0; i < 8; i++) {
    const fx = (i * 300 + 250) - camera.x;
    const fy = (i * 200 + 600) - camera.y;
    const flicker = 8 + Math.sin(Date.now() / 100 + i) * 2;
    ctx.beginPath();
    ctx.arc(fx, fy, flicker, 0, Math.PI * 2);
    ctx.fillStyle = 'orange';
    ctx.fill();
  }
}

function drawPlayers() {
  for (let id in players) {
    const p = players[id];
    const px = p.x - camera.x;
    const py = p.y - camera.y;

    // body
    ctx.fillStyle = id === myId ? '#00ffff' : '#ff4444';
    ctx.fillRect(px - 8, py - 16, 16, 28);

    // head
    ctx.fillStyle = '#ffe0bd';
    ctx.fillRect(px - 6, py - 26, 12, 12);

    // sword animation
    if (id === myId && attacking) {
      ctx.fillStyle = 'silver';
      if (p.facing === 'up') ctx.fillRect(px - 2, py - 40, 4, 12);
      if (p.facing === 'down') ctx.fillRect(px - 2, py + 20, 4, 12);
      if (p.facing === 'left') ctx.fillRect(px - 16, py - 8, 12, 4);
      if (p.facing === 'right') ctx.fillRect(px + 4, py - 8, 12, 4);
    }

    // HP bar
    ctx.fillStyle = 'white';
    ctx.fillRect(px - 10, py - 34, 20, 3);
    ctx.fillStyle = 'lime';
    ctx.fillRect(px - 10, py - 34, (p.hp / 4) * 20, 3);
  }
}

function drawArrows() {
  ctx.fillStyle = '#d4af37';
  for (let a of arrows) {
    ctx.fillRect(a.x - camera.x, a.y - camera.y, 6, 2);
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
