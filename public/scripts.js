const socket = io();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5,10,5);
scene.add(light);

let players = {};
let localPlayer = new THREE.Mesh(new THREE.BoxGeometry(1,2,1), new THREE.MeshBasicMaterial({color:0x00ff00}));
scene.add(localPlayer);
localPlayer.position.y = 1;

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
let keys={};
document.addEventListener("keydown", e=>keys[e.key.toLowerCase()]=true);
document.addEventListener("keyup", e=>keys[e.key.toLowerCase()]=false);
document.addEventListener("click", ()=>document.body.requestPointerLock());

let yaw=0,pitch=0;
document.addEventListener("mousemove", e=>{
  yaw -= e.movementX*0.002;
  pitch -= e.movementY*0.002;
  pitch=Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
});

document.addEventListener("keydown", e=>{
  if(e.code==="Space" && canJump){ velocityY=0.2; canJump=false; }
});

document.addEventListener("mousedown", ()=>{
  for(let id in players){
    if(id!==socket.id){
      const dx=players[id].x-localPlayer.position.x;
      const dz=players[id].z-localPlayer.position.z;
      if(Math.sqrt(dx*dx+dz*dz)<2) socket.emit("attack", id);
    }
  }
});

// Health Anzeige
let hp=100;
const healthDiv = document.getElementById("health");

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

function animate(){
  requestAnimationFrame(animate);

  let dirX=0,dirZ=0;
  if(keys["w"]) dirZ=-0.2;
  if(keys["s"]) dirZ=0.2;
  if(keys["a"]) dirX=-0.2;
  if(keys["d"]) dirX=0.2;

  localPlayer.position.x += dirX*Math.cos(yaw)-dirZ*Math.sin(yaw);
  localPlayer.position.z += dirZ*Math.cos(yaw)+dirX*Math.sin(yaw);

  velocityY -= 0.01;
  localPlayer.position.y += velocityY;
  if(localPlayer.position.y<=1){ localPlayer.position.y=1; velocityY=0; canJump=true; }

  camera.position.copy(localPlayer.position);
  camera.position.y+=1.5;
  camera.rotation.set(pitch,yaw,0);

  socket.emit("move",{x:localPlayer.position.x,y:localPlayer.position.y,z:localPlayer.position.z,hp:hp});

  renderer.render(scene,camera);
}
animate();
