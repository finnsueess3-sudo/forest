const socket = io();

// Three.js Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Licht
const ambientLight = new THREE.AmbientLight(0xffffff,0.7);
scene.add(ambientLight);
const sun = new THREE.DirectionalLight(0xffffff,1);
sun.position.set(50,100,50);
sun.castShadow = true;
scene.add(sun);

// Boden
const groundSize = 400;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(groundSize, groundSize),
  new THREE.MeshPhongMaterial({ color: 0x228B22 })
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// Mauer um Map
const wallHeight = 10;
const wallThickness = 1;
const wallMaterial = new THREE.MeshStandardMaterial({color:0x444444});
const walls = [
  new THREE.Mesh(new THREE.BoxGeometry(groundSize,wallHeight,wallThickness), wallMaterial), // vorne
  new THREE.Mesh(new THREE.BoxGeometry(groundSize,wallHeight,wallThickness), wallMaterial), // hinten
  new THREE.Mesh(new THREE.BoxGeometry(wallThickness,wallHeight,groundSize), wallMaterial), // links
  new THREE.Mesh(new THREE.BoxGeometry(wallThickness,wallHeight,groundSize), wallMaterial)  // rechts
];
walls[0].position.set(0,wallHeight/2,groundSize/2);
walls[1].position.set(0,wallHeight/2,-groundSize/2);
walls[2].position.set(-groundSize/2,wallHeight/2,0);
walls[3].position.set(groundSize/2,wallHeight/2,0);
walls.forEach(w=>{scene.add(w); w.castShadow=true;});

// Bäume
let treeColliders = [];
for(let i=0;i<100;i++){
  const h = 3 + Math.random()*7;
  const x = Math.random()*groundSize - groundSize/2;
  const z = Math.random()*groundSize - groundSize/2;

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.8,h), new THREE.MeshStandardMaterial({color:0x8B4513}));
  trunk.position.set(x,h/2,z); trunk.castShadow=true; scene.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(2,h/2), new THREE.MeshStandardMaterial({color:0x006400}));
  leaves.position.set(x,h*0.75,z); leaves.castShadow=true; scene.add(leaves);
  treeColliders.push({x:x,z:z,radius:1.5});
}

// Spielerfigur
let playerGroup = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(1,2,0.5), new THREE.MeshStandardMaterial({color:0x00ff00}));
body.position.y = 1; playerGroup.add(body);
const head = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.8), new THREE.MeshStandardMaterial({color:0xffffcc}));
head.position.y = 2.4; playerGroup.add(head);
const legLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4,1,0.4), new THREE.MeshStandardMaterial({color:0x006600}));
legLeft.position.set(-0.3,0.5,0); playerGroup.add(legLeft);
const legRight = new THREE.Mesh(new THREE.BoxGeometry(0.4,1,0.4), new THREE.MeshStandardMaterial({color:0x006600}));
legRight.position.set(0.3,0.5,0); playerGroup.add(legRight);
const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1,1.5,0.1), new THREE.MeshStandardMaterial({color:0xaaaaaa}));
sword.position.set(0.5,1.2,0); playerGroup.add(sword);
scene.add(playerGroup);
playerGroup.traverse(c=>c.castShadow=true);

// Steuerung
let velocityY=0, canJump=true;
let moveX=0, moveZ=0, velX=0, velZ=0, yawMobile=0, pitchMobile=0;
let hp=100;
const healthDiv = document.getElementById("health");

// Touch Events
document.getElementById("joystick-left").addEventListener("touchmove", e=>{
  const t = e.touches[0]; const rect = e.target.getBoundingClientRect();
  moveX = (t.clientX - rect.left - rect.width/2)/50;
  moveZ = (t.clientY - rect.top - rect.height/2)/50;
});
document.getElementById("joystick-right").addEventListener("touchmove", e=>{
  const t = e.touches[0]; const rect = e.target.getBoundingClientRect();
  yawMobile = (t.clientX - rect.left - rect.width/2)*0.005;
  pitchMobile = (t.clientY - rect.top - rect.height/2)*0.005;
});
document.getElementById("jump-btn").addEventListener("touchstart", ()=>{
  if(canJump){ velocityY=0.2; canJump=false; }
});
document.getElementById("attack-btn").addEventListener("touchstart", ()=>{
  for(let id in players){
    if(id!==socket.id){
      const dx = players[id].x - playerGroup.position.x;
      const dz = players[id].z - playerGroup.position.z;
      if(Math.sqrt(dx*dx+dz*dz)<2) socket.emit("attack", id);
    }
  }
});

// Multiplayer
let players = {};
socket.on("currentPlayers", data=>{
  for(let id in data){
    if(id!==socket.id){
      const p = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:0xff0000}));
      p.position.set(data[id].x,data[id].y,data[id].z);
      players[id]=p; scene.add(p);
    }
  }
});
socket.on("newPlayer", data=>{
  const p = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:0xff0000}));
  p.position.set(data.x,data.y,data.z); players[data.id]=p; scene.add(p);
});
socket.on("playerMoved", data=>{if(players[data.id]) players[data.id].position.set(data.x,data.y,data.z);});
socket.on("playerDisconnected", id=>{if(players[id]){scene.remove(players[id]); delete players[id];}});
socket.on("playerHit", data=>{if(data.id===socket.id){ hp=data.hp; healthDiv.innerText="HP: "+hp; }});

// Animation
function animate(){
  requestAnimationFrame(animate);

  // Trägheits-Bewegung
  velX += (moveX - velX) * 0.1; velZ += (moveZ - velZ) * 0.1;

  let nextX = playerGroup.position.x + velX * Math.cos(yawMobile) - velZ * Math.sin(yawMobile);
  let nextZ = playerGroup.position.z + velZ * Math.cos(yawMobile) + velX * Math.sin(yawMobile);

  // Kollision Bäume + Mauern
  for(let t of treeColliders){ const dx = nextX-t.x, dz = nextZ-t.z;
    if(Math.sqrt(dx*dx+dz*dz)<t.radius+0.5){ nextX=playerGroup.position.x; nextZ=playerGroup.position.z; }
  }
  // Mauern
  const limit = groundSize/2-1;
  nextX = Math.max(-limit, Math.min(limit, nextX));
  nextZ = Math.max(-limit, Math.min(limit, nextZ));

  playerGroup.position.x=nextX;
  playerGroup.position.z=nextZ;

  // Sprung
  velocityY -= 0.01;
  playerGroup.position.y += velocityY;
  if(playerGroup.position.y<0){playerGroup.position.y=0; velocityY=0; canJump=true;}

  // Kamera First-Person
  camera.position.copy(playerGroup.position); camera.position.y+=1.5;
  camera.rotation.set(pitchMobile, yawMobile, 0);

  // Server Update
  socket.emit("move",{x:playerGroup.position.x,y:playerGroup.position.y,z:playerGroup.position.z,hp:hp});

  renderer.render(scene,camera);
}
animate();
