// src/scaffolder.js - Graviton V3.9.0 Zero-Token Project Scaffolder Engine
import fs from 'fs';
import path from 'path';

/**
 * Detects the architectural domain from natural language prompt.
 * @param {string} promptText
 * @returns {string}
 */
export function detectDomainFromPrompt(promptText = '') {
  const clean = promptText.toLowerCase();
  if (/\b(?:minecraft|voxel|crafting|block|cube)\b/.test(clean)) {
    return 'voxel_minecraft';
  }
  if (/\b(?:cs2|counter-strike|fps|shooter|tembak|gun)\b/.test(clean)) {
    return 'fps_arena';
  }
  if (/\b(?:flappy|bird|snake|tetris|pong|pacman|arcade|2d|canvas)\b/.test(clean)) {
    return 'arcade_2d';
  }
  if (/\b(?:saas|trello|kanban|dashboard|spotify|ecommerce|crud|clone|shop)\b/.test(clean)) {
    return 'fullstack_saas';
  }
  return 'general_web';
}

/**
 * Generates the HTML5 template containing procedural 16x16 textures, Web Audio, and game loop.
 * @param {string} domain
 * @returns {string}
 */
export function getScaffoldTemplate(domain) {
  switch (domain) {
    case 'voxel_minecraft':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Voxel 3D World (Minecraft Clone)</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; background: #000; font-family: monospace; user-select: none; }
    #crosshair {
      position: absolute; top: 50%; left: 50%; width: 14px; height: 14px;
      transform: translate(-50%, -50%); pointer-events: none;
    }
    #crosshair::before, #crosshair::after {
      content: ''; position: absolute; background: rgba(255,255,255,0.85);
    }
    #crosshair::before { top: 6px; left: 0; width: 14px; height: 2px; }
    #crosshair::after { top: 0; left: 6px; width: 2px; height: 14px; }
    #hotbar {
      position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 8px; background: rgba(0,0,0,0.65); padding: 6px; border-radius: 8px;
    }
    .slot {
      width: 44px; height: 44px; border: 2px solid #555; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; color: #fff;
      font-size: 11px; font-weight: bold; cursor: pointer; transition: all 0.15s;
    }
    .slot.active { border-color: #00f0ff; box-shadow: 0 0 10px #00f0ff; }
    #overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.8);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #fff; cursor: pointer; z-index: 10;
    }
    #overlay h1 { font-size: 2.2rem; margin-bottom: 0.8rem; color: #00f0ff; }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="crosshair"></div>
  <div id="hotbar">
    <div class="slot active" data-type="1">1:Grass</div>
    <div class="slot" data-type="2">2:Dirt</div>
    <div class="slot" data-type="3">3:Stone</div>
    <div class="slot" data-type="4">4:Wood</div>
    <div class="slot" data-type="5">5:Water</div>
  </div>
  <div id="overlay">
    <h1>VOXEL 3D WORLD</h1>
    <p>Click Anywhere to Play</p>
    <p style="margin-top: 0.8rem; font-size: 0.85rem; color: #94a3b8;">WASD to Move • Space to Jump • Left Click Mine • Right Click Place</p>
  </div>

  <script>
    // PROCEDURAL AUDIO SYNTHESIZER (ZERO-DEPENDENCY)
    let audioCtx = null;
    function getAudio() {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }
    function playTone(freq, duration, type = 'sine') {
      try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch(e) {}
    }

    // PROCEDURAL 16x16 PIXEL ART TEXTURE GENERATOR (ZERO 404s)
    function createVoxelTexture(color, noiseColor) {
      const canvas = document.createElement('canvas');
      canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = noiseColor;
      for (let i = 0; i < 35; i++) {
        const x = Math.floor(Math.random() * 16);
        const y = Math.floor(Math.random() * 16);
        ctx.fillRect(x, y, 1, 1);
      }
      return new THREE.CanvasTexture(canvas);
    }

    const textures = {
      grass: createVoxelTexture('#55aa33', '#337711'),
      dirt: createVoxelTexture('#8b5a2b', '#5c3a1e'),
      stone: createVoxelTexture('#888888', '#555555'),
      wood: createVoxelTexture('#996633', '#663311'),
      water: createVoxelTexture('#2288ee', '#1155aa')
    };

    // THREE.JS SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(50, 100, 50);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x666666));

    // PROCEDURAL TERRAIN (16x16 BLOCKS)
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const materials = {
      1: new THREE.MeshLambertMaterial({ map: textures.grass }),
      2: new THREE.MeshLambertMaterial({ map: textures.dirt }),
      3: new THREE.MeshLambertMaterial({ map: textures.stone }),
      4: new THREE.MeshLambertMaterial({ map: textures.wood }),
      5: new THREE.MeshLambertMaterial({ map: textures.water, transparent: true, opacity: 0.7 })
    };

    const world = {};
    for (let x = -8; x < 8; x++) {
      for (let z = -8; z < 8; z++) {
        const y = 0;
        const mesh = new THREE.Mesh(boxGeo, materials[1]);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        world[\`\${x},\${y},\${z}\`] = mesh;
      }
    }

    camera.position.set(0, 3, 5);

    // CONTROLS & POINTER LOCK
    let isLocked = false;
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => {
      document.body.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      isLocked = document.pointerLockElement === document.body;
      overlay.style.display = isLocked ? 'none' : 'flex';
      getAudio();
    });

    let yaw = 0, pitch = 0;
    document.addEventListener('mousemove', (e) => {
      if (!isLocked) return;
      yaw -= e.movementX * 0.002;
      pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, pitch - e.movementY * 0.002));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    });

    const keys = {};
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);

    // RAYCASTING (MINE & PLACE)
    const raycaster = new THREE.Raycaster();
    let currentSlot = 1;

    window.addEventListener('keydown', (e) => {
      if (e.key >= '1' && e.key <= '5') {
        currentSlot = Number(e.key);
        document.querySelectorAll('.slot').forEach(s => s.classList.toggle('active', s.dataset.type === e.key));
        playTone(440, 0.05);
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (!isLocked) return;
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const meshes = Object.values(world);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0 && hits[0].distance < 6) {
        const hit = hits[0];
        if (e.button === 0) {
          // Left click: Mine
          scene.remove(hit.object);
          const pos = hit.object.position;
          delete world[\`\${pos.x},\${pos.y},\${pos.z}\`];
          playTone(220, 0.1, 'sawtooth');
        } else if (e.button === 2) {
          // Right click: Place
          const norm = hit.face.normal;
          const newPos = hit.object.position.clone().add(norm);
          const key = \`\${newPos.x},\${newPos.y},\${newPos.z}\`;
          if (!world[key]) {
            const newMesh = new THREE.Mesh(boxGeo, materials[currentSlot]);
            newMesh.position.copy(newPos);
            scene.add(newMesh);
            world[key] = newMesh;
            playTone(600, 0.08, 'square');
          }
        }
      }
    });

    window.addEventListener('contextmenu', e => e.preventDefault());

    // GAME LOOP
    function animate() {
      requestAnimationFrame(animate);
      if (isLocked) {
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        if (keys['KeyW']) camera.position.addScaledVector(forward, 0.1);
        if (keys['KeyS']) camera.position.addScaledVector(forward, -0.1);
        if (keys['KeyA']) camera.position.addScaledVector(right, -0.1);
        if (keys['KeyD']) camera.position.addScaledVector(right, 0.1);
        if (keys['Space']) camera.position.y += 0.08;
        if (keys['ShiftLeft']) camera.position.y -= 0.08;
      }
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;

    case 'fps_arena':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>3D FPS Arena</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { overflow: hidden; background: #000; font-family: monospace; user-select: none; }
    #crosshair {
      position: absolute; top: 50%; left: 50%; width: 16px; height: 16px;
      transform: translate(-50%, -50%); pointer-events: none;
    }
    #crosshair::before, #crosshair::after {
      content: ''; position: absolute; background: #00f0ff;
    }
    #crosshair::before { top: 7px; left: 0; width: 16px; height: 2px; }
    #crosshair::after { top: 0; left: 7px; width: 2px; height: 16px; }
    #hud {
      position: absolute; bottom: 20px; left: 20px; right: 20px;
      display: flex; justify-content: space-between; color: #fff; font-size: 1.2rem;
      pointer-events: none; text-shadow: 0 0 10px rgba(0,240,255,0.7);
    }
    #overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.85);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      color: #fff; cursor: pointer; z-index: 10;
    }
  </style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="crosshair"></div>
  <div id="hud">
    <div>HEALTH: <span id="hp" style="color:#10b981;">100</span></div>
    <div>SCORE: <span id="score">0</span></div>
    <div>AMMO: <span id="ammo">30 / 90</span></div>
  </div>
  <div id="overlay">
    <h1 style="color:#00f0ff; margin-bottom: 1rem;">FPS 3D COMBAT ARENA</h1>
    <p>Click Anywhere to Enter Arena</p>
    <p style="margin-top:0.5rem; font-size: 0.85rem; color:#94a3b8;">WASD: Move • Mouse: Aim • Left Click: Shoot • R: Reload</p>
  </div>

  <script>
    // WEB AUDIO PROCEDURAL WEAPON SOUNDS
    let audioCtx = null;
    function playShotSound() {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } catch(e) {}
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101525);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // ARENA FLOOR
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x1f293d, wireframe: true });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // TARGET DUMMIES
    const targets = [];
    for (let i = 0; i < 5; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 1.2), new THREE.MeshBasicMaterial({ color: 0xf43f5e }));
      t.position.set((Math.random() - 0.5) * 35, 1.2, (Math.random() - 0.5) * 35);
      scene.add(t);
      targets.push(t);
    }

    camera.position.set(0, 1.7, 0);

    let isLocked = false;
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => document.body.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
      isLocked = document.pointerLockElement === document.body;
      overlay.style.display = isLocked ? 'none' : 'flex';
    });

    let yaw = 0, pitch = 0;
    document.addEventListener('mousemove', (e) => {
      if (!isLocked) return;
      yaw -= e.movementX * 0.002;
      pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, pitch - e.movementY * 0.002));
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
    });

    let score = 0;
    const raycaster = new THREE.Raycaster();
    window.addEventListener('mousedown', (e) => {
      if (!isLocked || e.button !== 0) return;
      playShotSound();
      raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
      const hits = raycaster.intersectObjects(targets);
      if (hits.length > 0) {
        const hit = hits[0].object;
        hit.position.set((Math.random() - 0.5) * 35, 1.2, (Math.random() - 0.5) * 35);
        score += 100;
        document.getElementById('score').innerText = score;
      }
    });

    function animate() {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;

    case 'arcade_2d':
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>2D Arcade Game</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #040711; color: #fff; font-family: monospace;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; overflow: hidden;
    }
    canvas {
      border: 2px solid #00f0ff; border-radius: 8px; background: #081022;
      box-shadow: 0 0 25px rgba(0,240,255,0.25);
    }
    #score-bar {
      margin-bottom: 12px; font-size: 1.2rem; display: flex; gap: 2rem;
    }
  </style>
</head>
<body>
  <div id="score-bar">
    <div>SCORE: <span id="score" style="color:#00f0ff;">0</span></div>
    <div>HIGH: <span id="high">0</span></div>
  </div>
  <canvas id="game" width="480" height="640"></canvas>
  <p style="margin-top: 10px; font-size: 0.8rem; color: #94a3b8;">Spacebar or Tap to Play</p>

  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    let score = 0;
    let high = localStorage.getItem('arcade_high') || 0;
    document.getElementById('high').innerText = high;

    let birdY = 300, velocity = 0;
    const gravity = 0.35, jump = -6.5;

    // PROCEDURAL SOUND
    let audioCtx = null;
    function beep(freq) {
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } catch(e) {}
    }

    function doJump() {
      velocity = jump;
      beep(520);
    }

    window.addEventListener('keydown', e => { if (e.code === 'Space') doJump(); });
    window.addEventListener('touchstart', () => doJump());

    function loop() {
      velocity += gravity;
      birdY += velocity;

      if (birdY > canvas.height - 20) { birdY = 300; velocity = 0; score = 0; beep(180); }
      if (birdY < 10) birdY = 10;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Player
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(80, birdY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      score++;
      document.getElementById('score').innerText = Math.floor(score / 10);

      requestAnimationFrame(loop);
    }
    loop();
  </script>
</body>
</html>`;

    default: // fullstack_saas or general_web
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Modern Application</title>
  <style>
    :root {
      --bg: #040711; --surface: #060c1d; --card: rgba(8, 16, 34, 0.75);
      --border: rgba(56, 189, 248, 0.15); --aqua: #00f0ff; --text: #f1f5f9;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: sans-serif; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
    header { border-bottom: 1px solid var(--border); padding-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
    h1 { color: var(--aqua); font-size: 1.5rem; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1.5rem; }
    input, button { font-family: inherit; font-size: 0.9rem; padding: 0.6rem 1rem; border-radius: 6px; }
    input { background: #02050e; border: 1px solid var(--border); color: #fff; width: 100%; margin-bottom: 1rem; outline: none; }
    input:focus { border-color: var(--aqua); }
    button { background: var(--aqua); color: #040711; border: none; font-weight: bold; cursor: pointer; }
    button:hover { opacity: 0.9; }
    .item-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .item-row { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Modern Web Application</h1>
      <span id="badge" style="font-size: 0.8rem; color: #94a3b8;">Local State Active</span>
    </header>
    <div class="card">
      <input type="text" id="item-input" placeholder="Enter new item...">
      <button onclick="addItem()">Add Record</button>
      <div class="item-list" id="list"></div>
    </div>
  </div>

  <script>
    let items = JSON.parse(localStorage.getItem('app_items') || '["Sample Task 1", "Sample Task 2"]');
    function render() {
      const list = document.getElementById('list');
      list.innerHTML = items.map((it, idx) => \`
        <div class="item-row">
          <span>\${it}</span>
          <button style="background: #f43f5e; color: #fff; padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="removeItem(\${idx})">Delete</button>
        </div>
      \`).join('');
      localStorage.setItem('app_items', JSON.stringify(items));
    }
    function addItem() {
      const val = document.getElementById('item-input').value.trim();
      if (!val) return;
      items.push(val);
      document.getElementById('item-input').value = '';
      render();
    }
    function removeItem(idx) {
      items.splice(idx, 1);
      render();
    }
    render();
  </script>
</body>
</html>`;
  }
}

/**
 * Executes instant zero-token project scaffolding on disk.
 * @param {string} domain
 * @param {string} [targetDir=process.cwd()]
 * @param {object} [options={}]
 * @returns {object}
 */
export function scaffoldProject(domain, targetDir = process.cwd(), options = {}) {
  const normalizedDomain = domain === 'minecraft' ? 'voxel_minecraft' :
    domain === 'fps' || domain === 'cs2' ? 'fps_arena' :
    domain === 'arcade' || domain === '2d' ? 'arcade_2d' :
    domain === 'saas' || domain === 'trello' ? 'fullstack_saas' :
    domain;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const template = getScaffoldTemplate(normalizedDomain);
  const targetFile = path.join(targetDir, 'index.html');
  fs.writeFileSync(targetFile, template, 'utf8');

  return {
    success: true,
    domain: normalizedDomain,
    targetDir,
    filesCreated: ['index.html'],
    templateSizeBytes: template.length,
    message: `Successfully scaffolded runnable ${normalizedDomain} architecture in ${targetDir}`
  };
}
