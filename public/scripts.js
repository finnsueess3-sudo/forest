// scripts.js (Browser module)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/controls/PointerLockControls.js';

const socket = io(); // socket.io client (in index.html)

///// UI elements /////
const loadscreen = document.getElementById('loadscreen');
const pinInput = document.getElementById('pinInput');
const pinBtn = document.getElementById('pinBtn');
const pinMsg = document.getElementById('pinMsg');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const overlay = document.getElementById('overlay');
const centerBtn = document.getElementById('centerBtn');
const healthDiv = document.getElementById('health');

const CORRECT_PIN = '1412';

// Assets to load
const modelList = [
  '/models/player.glb',
  '/models/sword.glb',
  '/models/bow.glb',
  '/models/house.glb'
];

let models = {}; // will hold loaded gltf scenes
let animations = {}; // animations per model (player)
let assetsLoaded = 0, assetsTotal = modelList.length;

// Loading manager to update progress bar
const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = function(url, itemsLoaded, itemsTotal){
  // itemsLoaded might be for many internal resources; we use our counter instead
};
loadingManager.onLoad = function(){
  updateProgress(1); // 100%
  // all done
};
loadingManager.onError = function(url){
  console.warn('Failed to load', url);
};

// simple function to update the progress UI (0..1)
function updateProgress(fraction){
  const pct = Math.round(fraction*100);
  progressFill.style.width = pct + '%';
  progressText.innerText = pct + '%';
}

// tryLoadAssets invoked when PIN correct
const loader = new GLTFLoader(loadingManager);
function tryLoadAssets(){
  progressWrap.style.display = 'block';
  assetsLoaded = 0;
  updateProgress(0.03);

  modelList.forEach((url) => {
    loader.load(url, (gltf) => {
      models[url] = gltf;
      assetsLoaded++;
      updateProgress(assetsLoaded / assetsTotal);
      // cache animations from player
      if(url.endsWith('player.glb') && gltf.animations && gltf.animations.length){
        animations.player = gltf.animations;
      }
      if(assetsLoaded === assetsTotal){
        updateProgress(1);
        setTimeout(()=>startScene(), 300); // slight delay so user sees 100%
      }
    }, (xhr) => {
      // xhr.loaded/xhr.total may be undefined for cross-origin; we rely on count
    }, (err) => {
      console.warn('Could not load', url, err);
      // treat missing as loaded (fallback)
      models[url] = null;
      assetsLoaded++;
      updateProgress(assetsLoaded / assetsTotal);
      if(assetsLoaded === assetsTotal) setTimeout(()=>startScene(), 300);
    });
  });
}

pinBtn.addEventListener('click', ()=>{
  const v = pinInput.value.trim();
  if(v === CORRECT_PIN){
    pinMsg.innerText = '';
    pinInput.disabled = true;
    pinBtn.disabled = true;
    // start loading assets and show progress
    tryLoadAssets();
  } else {
    pinMsg.innerText = 'Falscher PIN';
    pinInput.value = '';
  }
});
pinInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') pinBtn.click(); });

///// After loading -> init scene /////
let scene, camera, renderer, controls;
let localModel = null, mixer = null, actionMap = {};
let otherPlayers = {}; // id -> { model, hp }

function startScene(){
  // hide load UI, show overlay
  loadscreen.style.display = 'none';
  overlay.style.display = 'block';

  // basic Three.js setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 3000);
  camera.position.set(0,1.7,0);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', ()=> {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(100,200,100);
  sun.castShadow = true;
  sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048;
  scene.add(sun);

  // ground
  const GROUND = 400;
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND, GROUND, 32, 32), groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // walls bounding the map
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const wallHeight = 12;
  function addWall(x,z,sx,sz){
    const box = new THREE.Mesh(new THREE.BoxGeometry(sx, wallHeight, sz), wallMat);
    box.position.set(x, wallHeight/2, z);
    box.castShadow = true; scene.add(box);
  }
  addWall(0, GROUND/2 + 2, GROUND + 4, 2);
  addWall(0, -GROUND/2 - 2, GROUND + 4, 2);
  addWall(GROUND/2 + 2, 0, 2, GROUND + 4);
  addWall(-GROUND/2 - 2, 0, 2, GROUND + 4);

  // trees (colliders & visuals)
  const treeColliders = [];
  for(let i=0;i<90;i++){
    const x = (Math.random()-0.5)*(GROUND-80);
    const z = (Math.random()-0.5)*(GROUND-80);
    const h = 4 + Math.random()*6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.7,h), new THREE.MeshStandardMaterial({ color: 0x8B4513 }));
    trunk.position.set(x, h/2, z); trunk.castShadow = true; scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, h*0.9), new THREE.MeshStandardMaterial({ color: 0x0b6623 }));
    leaves.position.set(x, h*0.9, z); leaves.castShadow = true; scene.add(leaves);
    treeColliders.push({ x,z, r: 1.6 + Math.random()*0.6 });
  }

  // houses (try spawn loaded models or fallback boxes)
  const housePositions = [];
  for(let i=0;i<12;i++){
    const x = (Math.random()-0.5)*(GROUND-120);
    const z = (Math.random()-0.5)*(GROUND-120);
    housePositions.push({x,z});
    if(models['/models/house.glb'] && models['/models/house.glb'].scene){
      const clone = models['/models/house.glb'].scene.clone(true);
      clone.position.set(x,0,z); clone.scale.set(2,2,2);
      clone.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
      scene.add(clone);
    } else {
      // fallback simple house
      const base = new THREE.Mesh(new THREE.BoxGeometry(6,4,6), new THREE.MeshStandardMaterial({ color: 0x8b7d6b }));
      base.position.set(x,2,z); base.castShadow=true; scene.add(base);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(4,2,4), new THREE.MeshStandardMaterial({ color: 0x6b2f2f }));
      roof.position.set(x,5,z); roof.castShadow=true; scene.add(roof);
    }
  }

  // spawn local player model (use loaded player model if available, else fallback)
  if(models['/models/player.glb'] && models['/models/player.glb'].scene){
    localModel = models['/models/player.glb'].scene.clone(true);
    localModel.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
    // initial scale/pos
    localModel.scale.set(1,1,1);
    localModel.position.set(0,0,0);
    scene.add(localModel);

    // animations
    if(models['/models/player.glb'].animations && models['/models/player.glb'].animations.length){
      mixer = new THREE.AnimationMixer(localModel);
      const clips = models['/models/player.glb'].animations;
      // map clips by name for convenience
      clips.forEach(c => { actionMap[c.name.toLowerCase()] = mixer.clipAction(c); });
      // play idle if exists or first clip
      const idle = actionMap['idle'] || actionMap['stand'] || actionMap[Object.keys(actionMap)[0]];
      if(idle) { idle.play(); }
    }
  } else {
    // fallback humanoid group
    localModel = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.6,0.5), new THREE.MeshStandardMaterial({ color: 0x00cc66 }));
    body.position.y = 0.9; localModel.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5), new THREE.MeshStandardMaterial({ color: 0xffddb3 }));
    head.position.y = 1.9; localModel.add(head);
    localModel.position.set(0,0,0);
    localModel.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
    scene.add(localModel);
  }

  // attach weapon visuals (sword/bow) to localModel if loaded, otherwise fallback simple geometry
  function attachWeaponToLocal(type){
    // remove previous if any
    const prev = localModel.getObjectByName('__weapon__');
    if(prev) localModel.remove(prev);
    if(type === 'sword' && models['/models/sword.glb'] && models['/models/sword.glb'].scene){
      const w = models['/models/sword.glb'].scene.clone(true);
      w.name = '__weapon__';
      w.position.set(0.5,1.0,0); w.scale.set(0.8,0.8,0.8);
      localModel.add(w);
    } else if(type === 'bow' && models['/models/bow.glb'] && models['/models/bow.glb'].scene){
      const w = models['/models/bow.glb'].scene.clone(true);
      w.name = '__weapon__';
      w.position.set(0.5,1.0,0); w.scale.set(0.8,0.8,0.8);
      localModel.add(w);
    } else {
      // fallback small box as weapon
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.08,1.0,0.08), new THREE.MeshStandardMaterial({ color:0xaaaaaa }));
      w.name = '__weapon__';
      w.position.set(0.5,1.0,0);
      localModel.add(w);
    }
  }
  attachWeaponToLocal('sword');

  // pointerlock controls for first-person
  controls = new PointerLockControls(camera, renderer.domElement);
  centerBtn.addEventListener('click', ()=> controls.lock());
  controls.addEventListener('lock', ()=> centerBtn.style.display = 'none');
  controls.addEventListener('unlock', ()=> centerBtn.style.display = '');

  // movement params: km/h -> m/s
  const WALK_KMH = 10, SPRINT_KMH = 15;
  const KMH_TO_MS = 1000/3600;
  const WALK_SPEED = WALK_KMH * KMH_TO_MS; // ~2.78 m/s
  const SPRINT_SPEED = SPRINT_KMH * KMH_TO_MS; // ~4.17 m/s

  const keys = { w:false,a:false,s:false,d:false, shift:false };
  window.addEventListener('keydown', (e)=> {
    const k = e.key.toLowerCase();
    if(k==='w'||k==='a'||k==='s'||k==='d'||k==='shift') keys[k]=true;
    if(k==='r'){ localWeapon = (localWeapon === 'sword') ? 'bow' : 'sword'; attachWeaponToLocal(localWeapon); }
    if(k===' ') { // jump
      // simple jump: move up quickly and fall back (no physics)
      if(localModel && !localModel.userData.jumping){
        localModel.userData.jumping = true;
        let jumpUp = 0.14;
        const jInterval = setInterval(()=> {
          localModel.position.y += jumpUp;
          jumpUp -= 0.02;
          if(jumpUp <= -0.2){
            clearInterval(jInterval);
            localModel.userData.jumping = false;
            localModel.position.y = 0;
          }
        }, 30);
      }
    }
  });
  window.addEventListener('keyup', (e)=> {
    const k = e.key.toLowerCase();
    if(k==='w'||k==='a'||k==='s'||k==='d'||k==='shift') keys[k]=false;
  });

  // mouse sensitivity: reduce yaw/pitch response by factor
  const MOUSE_SENS = 0.002; // smaller => less sensitive
  // PointerLockControls uses camera rotation by mouse automatically; we can scale movement by sensitivity by listening to mousemove while locked
  // But PointerLockControls uses internal event; as a simple approach we can scale camera rotation directly by listening to movementX when locked:
  document.addEventListener('mousemove', (ev)=> {
    if(!controls.isLocked) return;
    // scale rotation by MOUSE_SENS factor -> adjust yaw/pitch inside controls.object.rotation
    const yaw = ev.movementX * MOUSE_SENS;
    const pitch = ev.movementY * MOUSE_SENS;
    controls.getObject().rotation.y -= yaw;
    controls.getObject().rotation.x -= pitch;
    // clamp pitch
    controls.getObject().rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, controls.getObject().rotation.x));
  });

  // attack handling (left click)
  window.addEventListener('mousedown', (e)=> {
    if(e.button !== 0) return;
    // play attack animation locally if available
    if(mixer && actionMap['attack']){
      // crossfade
      mixer.stopAllAction();
      actionMap['attack'].reset().play();
      // return to idle after short time
      setTimeout(()=> {
        if(actionMap['idle']){ mixer.stopAllAction(); actionMap['idle'].reset().play(); }
      }, 500);
    }
    // find a close player to target (client-side convenience)
    let targetId = null, minDist = 9999;
    for(const id in otherPlayers){
      const p = otherPlayers[id].model;
      const dx = p.position.x - localModel.position.x;
      const dz = p.position.z - localModel.position.z;
      const d = Math.hypot(dx,dz);
      if(d < 3 && d < minDist){ minDist = d; targetId = id; }
    }
    socket.emit('attack', { targetId, type: localWeapon });
  });

  // multiplayer events
  socket.on('currentPlayers', (data) => {
    for(const id in data){
      if(id === socket.id) continue;
      spawnRemote(id, data[id]);
    }
  });
  socket.on('newPlayer', (info) => { if(info.id !== socket.id) spawnRemote(info.id, info); });
  socket.on('playerMoved', (info) => {
    if(info.id === socket.id) return;
    if(otherPlayers[info.id] && otherPlayers[info.id].model) {
      otherPlayers[info.id].model.position.set(info.x, info.y, info.z);
    }
  });
  socket.on('playerDisconnected', (id)=> {
    if(otherPlayers[id]){ scene.remove(otherPlayers[id].model); delete otherPlayers[id]; }
  });
  socket.on('playerHit', (d)=> {
    if(d.id === socket.id) {
      healthDiv.innerText = 'HP: ' + Math.round(Math.max(0, d.hp));
    } else if(otherPlayers[d.id]) {
      otherPlayers[d.id].hp = d.hp;
    }
  });

  function spawnRemote(id, info){
    if(otherPlayers[id]) return;
    let m = null;
    if(models['/models/player.glb'] && models['/models/player.glb'].scene){
      m = models['/models/player.glb'].scene.clone(true);
      m.traverse(c=>{ if(c.isMesh){ c.castShadow=true; c.receiveShadow=true; }});
    } else {
      m = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.8,1.6,0.5), new THREE.MeshStandardMaterial({ color: 0xff4444 }));
      b.position.y = 0.9; m.add(b);
    }
    m.position.set(info.x, info.y, info.z);
    scene.add(m);
    otherPlayers[id] = { model: m, hp: info.hp, weapon: info.weapon };
  }

  // simple collision check for trees/houses/walls
  function collides(x,z){
    // trees
    for(const t of treeColliders){
      if(Math.hypot(x - t.x, z - t.z) < (t.r + 0.6)) return true;
    }
    // houses bounding boxes
    for(const hp of housePositions){
      if(x > hp.x - 6 && x < hp.x + 6 && z > hp.z - 6 && z < hp.z + 6) return true;
    }
    // walls: map limit
    const limit = GROUND/2 - 1;
    if(x < -limit || x > limit || z < -limit || z > limit) return true;
    return false;
  }

  // movement loop
  const clock = new THREE.Clock();
  function loop(){
    requestAnimationFrame(loop);
    const dt = clock.getDelta();

    if(localModel){
      // movement vector from input
      const f = (keys.w?1:0) - (keys.s?1:0);
      const s = (keys.d?1:0) - (keys.a?1:0);
      let len = Math.hypot(f, s);
      let localDx = 0, localDz = 0;
      if(len > 0){
        const speed = (keys.shift ? SPRINT_SPEED : WALK_SPEED);
        localDx = (s/len) * speed * dt;
        localDz = (f/len) * speed * dt;
      }
      // rotate movement by camera yaw
      const yaw = controls.getObject().rotation.y;
      const cos = Math.cos(yaw), sin = Math.sin(yaw);
      const worldDX = localDx * cos - localDz * sin;
      const worldDZ = localDz * cos + localDx * sin;

      const candX = localModel.position.x + worldDX;
      const candZ = localModel.position.z + worldDZ;
      if(!collides(candX, candZ)){
        localModel.position.x = candX;
        localModel.position.z = candZ;
      }

      // update camera pos to follow model
      camera.position.set(localModel.position.x, localModel.position.y + 1.7, localModel.position.z);

      // animation switching: run vs idle (if animations available)
      if(mixer && actionMap){
        if(len > 0){
          // run
          if(actionMap['run']){
            mixer.stopAllAction();
            actionMap['run'].play();
          }
        } else {
          if(actionMap['idle']){
            mixer.stopAllAction();
            actionMap['idle'].play();
          }
        }
        mixer.update(dt);
      }

      // send position to server (throttle could be added)
      socket.emit('move', { x: localModel.position.x, y: localModel.position.y, z: localModel.position.z, hp:100, weapon: localWeapon });
    }

    renderer.render(scene, camera);
  }
  loop();
} // end startScene

// If user never loaded models within some seconds, allow fallback to start (safety)
setTimeout(()=> {
  if(assetsLoaded < assetsTotal && !models['/models/player.glb']){
    // let user continue with fallback if they already clicked PIN and nothing loaded
    // (do not auto-start unless PIN pressed)
    // here we simply show message by enabling progressWrap if not yet
    progressWrap.style.display = 'block';
    updateProgress(assetsLoaded / Math.max(1, assetsTotal));
  }
}, 3000);

