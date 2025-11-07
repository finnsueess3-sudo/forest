import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/controls/PointerLockControls.js';

const socket = io();

// ---------- Loadscreen + PIN ----------
const loadscreen = document.getElementById('loadscreen');
const pinInput = document.getElementById('pinInput');
const pinButton = document.getElementById('pinButton');
const pinMsg = document.getElementById('pinMsg');
const overlay = document.getElementById('overlay');

const CORRECT_PIN = '1412';

pinButton.addEventListener('click', ()=>{
  if(pinInput.value === CORRECT_PIN){
    loadscreen.style.display='none';
    overlay.style.display='block';
    initGame(); // Starte Three.js-Spiel
  } else {
    pinMsg.innerText='Falscher PIN!';
    pinInput.value='';
  }
});

// Enter-Taste für PIN
pinInput.addEventListener('keydown', e=>{
  if(e.key==='Enter') pinButton.click();
});

// ---------- Game init ----------
function initGame(){
  // ---------- Szene ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
  camera.position.set(0,1.7,0);

  const renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled=true;
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', ()=>{
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ---------- Licht ----------
  scene.add(new THREE.AmbientLight(0xffffff,0.6));
  const sun = new THREE.DirectionalLight(0xffffff,1);
  sun.position.set(100,200,100);
  sun.castShadow=true;
  scene.add(sun);

  // ---------- Boden ----------
  const GROUND_SIZE=200;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE,GROUND_SIZE),
    new THREE.MeshStandardMaterial({color:0x2e8b57})
  );
  ground.rotation.x=-Math.PI/2;
  ground.receiveShadow=true;
  scene.add(ground);

  // ---------- Spieler (Fallback-Box) ----------
  const localModel = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.6,0.5), new THREE.MeshStandardMaterial({color:0x00cc66}));
  body.position.y=0.9; localModel.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshStandardMaterial({color:0xffddb3}));
  head.position.y=1.9; localModel.add(head);
  scene.add(localModel);

  // ---------- PointerLock ----------
  const controls = new PointerLockControls(camera, renderer.domElement);
  document.getElementById('center').addEventListener('click', ()=> controls.lock());
  controls.addEventListener('lock', ()=> document.getElementById('center').style.display='none');
  controls.addEventListener('unlock', ()=> document.getElementById('center').style.display='');

  // ---------- Movement ----------
  const keys={ w:false,a:false,s:false,d:false,shift:false };
  window.addEventListener('keydown', e=>{ if(['w','a','s','d','shift'].includes(e.key.toLowerCase())) keys[e.key.toLowerCase()]=true; });
  window.addEventListener('keyup', e=>{ if(['w','a','s','d','shift'].includes(e.key.toLowerCase())) keys[e.key.toLowerCase()]=false; });

  const WALK_SPEED=2.78; // 10 km/h
  const SPRINT_SPEED=4.17; // 15 km/h

  // ---------- Animate ----------
  let lastTime = performance.now();
  function animate(){
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = (now - lastTime)/1000; lastTime=now;

    // Bewegung
    let forward=(keys.w?1:0)-(keys.s?1:0);
    let strafe=(keys.d?1:0)-(keys.a?1:0);
    let len=Math.hypot(forward,strafe);
    let dx=0,dz=0;
    if(len>0){
      const speed = keys.shift?SPRINT_SPEED:WALK_SPEED;
      dx=(strafe/len)*speed*delta;
      dz=(forward/len)*speed*delta;
    }
    const euler = new THREE.Euler(); euler.copy(camera.rotation); const yaw=euler.y;
    const cos=Math.cos(yaw), sin=Math.sin(yaw);
    const worldDX=dx*cos-dz*sin, worldDZ=dz*cos+dx*sin;
    localModel.position.x += worldDX;
    localModel.position.z += worldDZ;

    camera.position.set(localModel.position.x, localModel.position.y+1.7, localModel.position.z);

    renderer.render(scene,camera);
  }
  animate();
}
