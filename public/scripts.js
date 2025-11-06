import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';

const socket = io();

// Three.js
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

// Mauern
const wallHeight = 10;
const wallThickness = 1;
const wallMaterial = new THREE.MeshStandardMaterial({color:0x444444});
const walls = [
  new THREE.Mesh(new THREE.BoxGeometry(groundSize,wallHeight,wallThickness), wallMaterial),
  new THREE.Mesh(new THREE.BoxGeometry(groundSize,wallHeight,wallThickness), wallMaterial),
  new THREE.Mesh(new THREE.BoxGeometry(wallThickness,wallHeight,groundSize), wallMaterial),
  new THREE.Mesh(new THREE.BoxGeometry(wallThickness,wallHeight,groundSize), wallMaterial)
];
walls[0].position.set(0,wallHeight/2,groundSize/2);
walls[1].position.set(0,wallHeight/2,-groundSize/2);
walls[2].position.set(-groundSize/2,wallHeight/2,0);
walls[3].position.set(groundSize/2,wallHeight/2,0);
walls.forEach(w=>{scene.add(w); w.castShadow=true;});

// Häuser
const loader = new GLTFLoader();
for(let i=0;i<10;i++){
  loader.load('/models/house.glb', gltf=>{
    const house = gltf.scene.clone();
    house.position.set(Math.random()*groundSize - groundSize/2,0,Math.random()*groundSize - groundSize/2);
    house.scale.set(2,2,2);
    scene.add(house);
  });
}

// Spieler
let player, sword, bow;
loader.load('/models/player.glb', gltf=>{
  player = gltf.scene;
  player.position.set(0,0,0);
  scene.add(player);

  loader.load('/models/sword.glb', g=>{
    sword = g.scene;
    sword.position.set(0.3,1.2,0);
    player.add(sword);
  });

  loader.load('/models/bow.glb', g=>{
    bow = g.scene;
    bow.position.set(-0.3,1.2,0);
    player.add(bow);
  });
});

// Steuerung
const keys = {};
document.addEventListener('keydown', e=>{keys[e.key.toLowerCase()]=true;});
document.addEventListener('keyup', e=>{keys[e.key.toLowerCase()]=false;});

let hp = 100;
const healthDiv = document.getElementById("health");

// Animation
function animate(){
  requestAnimationFrame(animate);

  if(!player) return;

  let speed = keys['shift'] ? 0.004 : 0.0027; // 15 km/h Sprint, 10 km/h normal
  let dirX=0, dirZ=0;
  if(keys['w']) dirZ -= speed;
  if(keys['s']) dirZ += speed;
  if(keys['a']) dirX -= speed;
  if(keys['d']) dirX += speed;

  // Rotation Kamera
  camera.position.set(player.position.x, player.position.y+1.7, player.position.z+2);
  camera.lookAt(player.position.x, player.position.y+1, player.position.z);

  player.position.x += dirX*100; 
  player.position.z += dirZ*100;

  // Server Update
  socket.emit('move',{x:player.position.x,y:player.position.y,z:player.position.z,hp});

  renderer.render(scene,camera);
}
animate();
