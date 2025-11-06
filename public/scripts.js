const socket = io();

// Three.js Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Licht
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5,10,5);
scene.add(light);

// Spieler
let players = {};
let localPlayer = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:0x00ff00}));
scene.add(localPlayer);
localPlayer.position.y = 1;

// Boden
const ground = new THREE.Mesh(new THREE.PlaneGeometry(50,50), new THREE.MeshPhongMaterial({color:0x228B22}));
ground.rotation.x = -Math.PI/2;
scene.add(ground);

// Bäume
for(let i=0;i<30;i++){
    const tree = new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.5,3), new THREE.MeshPhongMaterial({color:0x8B4513}));
    tree.position.set(Math.random()*40-20,1.5,Math.random()*40-20);
    scene.add(tree);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.5,3), new THREE.MeshPhongMaterial({color:0x006400}));
    leaves.position.set(tree.position.x,3,tree.position.z);
    scene.add(leaves);
}

// Bewegung + Kamera
let velocityY=0, canJump=true;
let moveX=0, moveZ=0, yawMobile=0, pitchMobile=0;
let hp=100;
const healthDiv = document.getElementById("health");

// Touch Events
document.getElementById("joystick-left").addEventListener("touchmove", e=>{
  const t = e.touches[0];
  const rect = e.target.getBoundingClientRect();
  moveX = (t.clientX - rect.left - rect.width/2)/50;
  moveZ = (t.clientY - rect.top - rect.height/2)/50;
});
document.getElementById("joystick-right").addEventListener("touchmove", e=>{
  const t = e.touches[0];
  const rect = e.target.getBoundingClientRect();
  yawMobile = (t.clientX - rect.left - rect.width/2)*0.005;
  pitchMobile = (t.clientY - rect.top - rect.height/2)*0.005;
});
document.getElementById("jump-btn").addEventListener("touchstart", ()=>{
  if(canJump){ velocityY=0.2; canJump=false; }
});
document.getElementById("attack-btn").addEventListener("touchstart", ()=>{
  for(let id in players){
    if(id!==socket.id){
      const dx = players[id].x - localPlayer.position.x;
      const dz = players[id].z - localPlayer.position.z;
      if(Math.sqrt(dx*dx+dz*dz)<2) socket.emit("attack", id);
    }
  }
});

// Server Events
socket.on("currentPlayers", data=>{
  for(let id in data){
    if(id!==socket.id){
      const p = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:0xff0000}));
      p.position.set(data[id].x,data[id].y,data[id].z);
      players[id]=p;
      scene.add(p);
    }
  }
});
socket.on("newPlayer", data=>{
  const p = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:0xff0000}));
  p.position.set(data.x,data.y,data.z);
  players[data.id]=p;
  scene.add(p);
});
socket.on("playerMoved", data=>{if(players[data.id]) players[data.id].position.set(data.x,data.y,data.z);});
socket.on("playerDisconnected", id=>{if(players[id]){scene.remove(players[id]); delete players[id];}});
socket.on("playerHit", data=>{
  if(data.id===socket.id){ hp=data.hp; healthDiv.innerText="HP: "+hp; }
});

// Animation Loop
function animate(){
  requestAnimationFrame(animate);

  // Bewegung
  localPlayer.position.x += moveX * Math.cos(yawMobile) - moveZ * Math.sin(yawMobile);
  localPlayer.position.z += moveZ * Math.cos(yawMobile) + moveX * Math.sin(yawMobile);

  velocityY -= 0.01;
  localPlayer.position.y += velocityY;
  if(localPlayer.position.y<=1){ localPlayer.position.y=1; velocityY=0; canJump=true; }

  // Kamera
  yawMobile=0; pitchMobile=0;
  camera.position.copy(localPlayer.position);
  camera.position.y+=1.5;

  // Senden der Position an Server
  socket.emit("move",{x:localPlayer.position.x,y:localPlayer.position.y,z:localPlayer.position.z,hp:hp});

  renderer.render(scene,camera);
}
animate();
