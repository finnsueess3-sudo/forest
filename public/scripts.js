// scripts.js (Browser-Modul)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/controls/PointerLockControls.js';

const socket = io();

// ---------- Szene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- Licht ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1);
sun.position.set(100, 200, 100);
sun.castShadow = true;
sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
scene.add(sun);

// ---------- Boden & Mauern ----------
const GROUND_SIZE = 600;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE, 32, 32), new THREE.MeshStandardMaterial({ color: 0x2e8b57 }));
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

const wallMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
function addWall(x,y,z,sx,sy,sz){
  const wall = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), wallMat);
  wall.position.set(x,y,z); wall.castShadow=true; scene.add(wall);
}
const wallHeight=12, wallThickness=2;
addWall(0, wallHeight/2, GROUND_SIZE/2+wallThickness/2, GROUND_SIZE+wallThickness*2, wallHeight, wallThickness);
addWall(0, wallHeight/2, -GROUND_SIZE/2-wallThickness/2, GROUND_SIZE+wallThickness*2, wallHeight, wallThickness);
addWall(GROUND_SIZE/2+wallThickness/2, wallHeight/2, 0, wallThickness, wallHeight, GROUND_SIZE+wallThickness*2);
addWall(-GROUND_SIZE/2-wallThickness/2, wallHeight/2, 0, wallThickness, wallHeight, GROUND_SIZE+wallThickness*2);

// ---------- Bäume ----------
const treeColliders=[];
for(let i=0;i<120;i++){
  const x=(Math.random()-0.5)*(GROUND_SIZE-60);
  const z=(Math.random()-0.5)*(GROUND_SIZE-60);
  const h=4+Math.random()*6;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.7,h), new THREE.MeshStandardMaterial({color:0x8B4513}));
  trunk.position.set(x,h/2,z); trunk.castShadow=true; scene.add(trunk);
  const leaves=new THREE.Mesh(new THREE.ConeGeometry(2.5,h*0.9,8), new THREE.MeshStandardMaterial({color:0x0b6623}));
  leaves.position.set(x,h*0.9,z); leaves.castShadow=true; scene.add(leaves);
  treeColliders.push({x,z,r:1.6+Math.random()*0.6});
}

// ---------- Häuser ----------
const loader=new GLTFLoader();
const housePositions=[];
for(let i=0;i<12;i++){
  const x=(Math.random()-0.5)*(GROUND_SIZE-120);
  const z=(Math.random()-0.5)*(GROUND_SIZE-120);
  housePositions.push({x,z});
  loader.load('/models/house.glb',gltf=>{
    const h=gltf.scene.clone(); h.position.set(x,0,z); h.scale.set(2,2,2);
    h.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
    scene.add(h);
  }, ()=>{}, ()=>{
    const base=new THREE.Mesh(new THREE.BoxGeometry(6,4,6), new THREE.MeshStandardMaterial({color:0x8b7d6b}));
    base.position.set(x,2,z); base.castShadow=true; scene.add(base);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(4,2,4), new THREE.MeshStandardMaterial({color:0x6b2f2f}));
    roof.position.set(x,5,z); roof.castShadow=true; scene.add(roof);
  });
}

// ---------- Spieler ----------
let localModel=null, localWeapon='sword', hasModel=false;
const otherPlayers={};
function createFallbackPlayer(color=0x00ff00){
  const g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.6,0.5), new THREE.MeshStandardMaterial({color}));
  body.position.y=0.9; g.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshStandardMaterial({color:0xffddb3}));
  head.position.y=1.9; g.add(head);
  g.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
  return g;
}
loader.load('/models/player.glb', gltf=>{
  localModel=gltf.scene; localModel.scale.set(1,1,1);
  localModel.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
  scene.add(localModel); hasModel=true;
}, ()=>{}, ()=>{ localModel=createFallbackPlayer(0x00cc66); scene.add(localModel); });

// ---------- PointerLock Controls ----------
const controls=new PointerLockControls(camera,renderer.domElement);
document.getElementById('center').addEventListener('click', ()=> controls.lock());
controls.addEventListener('lock', ()=> document.getElementById('center').style.display='none');
controls.addEventListener('unlock', ()=> document.getElementById('center').style.display='');

// ---------- Movement ----------
const WALK_KMH=10, SPRINT_KMH=15;
const KMH_TO_MS=1000/3600;
const WALK_SPEED=WALK_KMH*KMH_TO_MS;
const SPRINT_SPEED=SPRINT_KMH*KMH_TO_MS;
const keys={ w:false,a:false,s:false,d:false,shift:false };
window.addEventListener('keydown',e=>{ const k=e.key.toLowerCase(); if(k==='w'||k==='a'||k==='s'||k==='d'||k==='shift') keys[k]=true; if(k==='r') localWeapon=(localWeapon==='sword')?'bow':'sword'; });
window.addEventListener('keyup',e=>{ const k=e.key.toLowerCase(); if(k==='w'||k==='a'||k==='s'||k==='d'||k==='shift') keys[k]=false; });

// ---------- Attack ----------
window.addEventListener('mousedown',e=>{
  if(e.button===0){
    let targetId=null,minDist=9999;
    for(const id in otherPlayers){
      const p=otherPlayers[id].model;
      const dx=p.position.x-(localModel?localModel.position.x:0);
      const dz=p.position.z-(localModel?localModel.position.z:0);
      const dist=Math.sqrt(dx*dx+dz*dz);
      if(dist<3 && dist<minDist){ minDist=dist; targetId=id; }
    }
    socket.emit('attack',{ targetId, type: localWeapon });
  }
});

// ---------- Collision ----------
function collides(x,z,padding=0.5){
  for(const t of treeColliders){ if(Math.hypot(x-t.x,z-t.z)<t.r+padding) return true; }
  const limit=GROUND_SIZE/2-1; if(x<-limit||x>limit||z<-limit||z>limit) return true;
  for(const hp of housePositions){ if(x>hp.x-6 && x<hp.x+6 && z>hp.z-6 && z<hp.z+6) return true; }
  return false;
}

// ---------- Multiplayer ----------
socket.on('currentPlayers', data=>{ for(const id in data) if(id!==socket.id) spawnRemote(id,data[id]); });
socket.on('newPlayer', info=>{ if(info.id!==socket.id) spawnRemote(info.id,info); });
socket.on('playerMoved', info=>{ if(info.id!==socket.id && otherPlayers[info.id]) otherPlayers[info.id].model.position.set(info.x,info.y,info.z); });
socket.on('playerDisconnected', id=>{ if(otherPlayers[id]){ scene.remove(otherPlayers[id].model); delete otherPlayers[id]; } });
socket.on('playerHit', data=>{ if(data.id===socket.id) document.getElementById('health').innerText='HP: '+Math.round(Math.max(0,data.hp)); else if(otherPlayers[data.id]) otherPlayers[data.id].hp=data.hp; });

function spawnRemote(id,info){
  if(otherPlayers[id]) return;
  const g=createFallbackPlayer(0xff4444);
  g.position.set(info.x,info.y,info.z);
  scene.add(g);
  otherPlayers[id]={model:g,hp:info.hp,weapon:info.weapon};
}

// ---------- Animate ----------
let lastTime=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(), delta=(now-lastTime)/1000; lastTime=now;

  if(localModel){
    const forward=(keys.w?1:0)-(keys.s?1:0);
    const strafe=(keys.d?1:0)-(keys.a?1:0);
    const len=Math.hypot(forward,strafe); let dx=0,dz=0;
    if(len>0){ dx=(strafe/len)*(keys.shift?SPRINT_SPEED:WALK_SPEED)*delta; dz=(forward/len)*(keys.shift?SPRINT_SPEED:WALK_SPEED)*delta; }

    const euler=new THREE.Euler(); euler.copy(camera.rotation); const yaw=euler.y;
    const cos=Math.cos(yaw), sin=Math.sin(yaw);
    const worldDX=dx*cos-dz*sin; const worldDZ=dz*cos+dx*sin;
    const candX=localModel.position.x+worldDX, candZ=localModel.position.z+worldDZ;
    if(!collides(candX,candZ)){ localModel.position.x=candX; localModel.position.z=candZ; }

    camera.position.set(localModel.position.x,localModel.position.y+1.7,localModel.position.z);
    socket.emit('move',{ x:localModel.position.x, y:localModel.position.y, z:localModel.position.z, hp:100, weapon:localWeapon });
  }

  renderer.render(scene,camera);
}
animate();
