import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC795YH1oJyQbwJDM6xfemZQ1njDpFwBDg",
  authDomain: "gameofskate-f71f9.firebaseapp.com",
  projectId: "gameofskate-f71f9",
  storageBucket: "gameofskate-f71f9.firebasestorage.app",
  messagingSenderId: "748973391526",
  appId: "1:748973391526:web:0d3ccc9d88bbcc92527e67",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const scoresRef = collection(db, "scores");

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hudCollected = document.getElementById("collected");
const hudTotal = document.getElementById("total");
const hudLevel = document.getElementById("level");
const hudTime = document.getElementById("time");
const hudScore = document.getElementById("score");
const progressFill = document.getElementById("progressFill");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const levelComplete = document.getElementById("levelComplete");
const nextBtn = document.getElementById("nextBtn");
const levelStats = document.getElementById("levelStats");
const muteToggle = document.getElementById("muteToggle");
const playerNameInput = document.getElementById("playerName");
const leaderboardList = document.getElementById("leaderboardList");
const leaderboardStatus = document.getElementById("leaderboardStatus");

const WORLD = {
  width: 3200,
  height: 720,
  groundBase: 520,
};

const CAMERA = {
  x: 0,
  y: 0,
};

const PLAYER = {
  x: 200,
  y: 0,
  vx: 0,
  vy: 0,
  width: 42,
  height: 58,
  speed: 0.6,
  maxSpeed: 7.5,
  jumpPower: 15.5,
  onGround: false,
  direction: 1,
};

const GRAVITY = 0.7;
const FRICTION = 0.85;

const keys = new Set();
const touchState = {
  left: false,
  right: false,
  jump: false,
};

const LEVELS = [
  { width: 2200, mugs: 7, speed: 0.58, maxSpeed: 7.2, jump: 15.2 },
  { width: 2800, mugs: 9, speed: 0.65, maxSpeed: 7.8, jump: 15.6 },
  { width: 3400, mugs: 12, speed: 0.72, maxSpeed: 8.4, jump: 16.1 },
];

let beerMugs = [];
let buildings = [];
let particles = [];
let obstacles = [];

const state = {
  running: false,
  started: false,
  levelComplete: false,
  levelIndex: 0,
  levelTime: 0,
  totalTime: 0,
  score: 0,
  collected: 0,
  total: 0,
  lastTick: 0,
  finishX: 0,
  finishReached: false,
  airTime: 0,
  hitCooldown: 0,
  shake: 0,
  frameDelta: 0,
  playerName: "",
};

let audioCtx = null;
let muted = false;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function groundHeight(x) {
  const wave = Math.sin(x / 240) * 16;
  const bump = Math.sin(x / 90) * 6;
  return WORLD.groundBase + wave + bump;
}

function buildLevel(levelIndex) {
  const base =
    LEVELS[Math.min(levelIndex, LEVELS.length - 1)];
  const extra = Math.max(0, levelIndex - (LEVELS.length - 1));
  WORLD.width = base.width + extra * 260;
  state.finishX = WORLD.width - 140;

  PLAYER.speed = base.speed + extra * 0.03;
  PLAYER.maxSpeed = base.maxSpeed + extra * 0.2;
  PLAYER.jumpPower = base.jump + extra * 0.25;
  PLAYER.vx = 0;
  PLAYER.vy = 0;
  PLAYER.direction = 1;

  const mugCount = base.mugs + extra * 2;
  const rng = createRng(levelIndex + 42);
  beerMugs = [];
  const startX = 260;
  const gap = (WORLD.width - 520) / mugCount;
  for (let i = 0; i < mugCount; i += 1) {
    const offset = (rng() - 0.5) * gap * 0.6;
    const x = clamp(startX + i * gap + offset, 180, WORLD.width - 180);
    beerMugs.push({ x, y: 0, collected: false, floatOffset: rng() * 6 });
  }
  placeBeerMugs();

  buildings = [];
  const buildingRng = createRng(levelIndex + 99);
  let cursor = 0;
  while (cursor < WORLD.width) {
    const width = 180 + buildingRng() * 180;
    const height = 190 + buildingRng() * 160;
    buildings.push({ x: cursor, width, height });
    cursor += width + 30 + buildingRng() * 40;
  }

  obstacles = [];
  const obstacleCount = 4 + levelIndex * 2;
  const obstacleRng = createRng(levelIndex + 123);
  for (let i = 0; i < obstacleCount; i += 1) {
    const x = clamp(
      360 + obstacleRng() * (WORLD.width - 520),
      320,
      WORLD.width - 220
    );
    const kind = obstacleRng() > 0.5 ? "cone" : "barrier";
    obstacles.push({
      x,
      width: kind === "cone" ? 26 : 44,
      height: kind === "cone" ? 28 : 22,
      kind,
      hit: false,
    });
  }

  PLAYER.x = 160;
  PLAYER.y = groundHeight(PLAYER.x);

  state.collected = 0;
  state.total = mugCount;
  state.levelTime = 0;
  state.levelComplete = false;
  state.finishReached = false;
  state.airTime = 0;
  state.hitCooldown = 0;
  state.shake = 0;

  hudTotal.textContent = state.total;
  hudCollected.textContent = "0";
  hudLevel.textContent = `${state.levelIndex + 1}`;
  progressFill.style.width = "0%";
  updateHUD();
}

function placeBeerMugs() {
  beerMugs.forEach((mug) => {
    mug.y = groundHeight(mug.x) - 32;
  });
}

function updateHUD() {
  hudCollected.textContent = state.collected;
  hudScore.textContent = state.score;
  hudTime.textContent = `${state.levelTime.toFixed(1)}s`;
  progressFill.style.width = `${(state.collected / state.total) * 100}%`;
}

function setLeaderboardStatus(message) {
  leaderboardStatus.textContent = message;
}

async function loadLeaderboard() {
  if (window.location.protocol === "file:") {
    setLeaderboardStatus(
      "Открой игру через локальный сервер (http://), чтобы работала таблица."
    );
    leaderboardList.innerHTML = "";
    return;
  }
  setLeaderboardStatus("Подключение к Firebase...");
  leaderboardList.innerHTML = "";
  try {
    const scoresQuery = query(scoresRef, orderBy("score", "desc"), limit(10));
    const snapshot = await getDocs(scoresQuery);
    if (snapshot.empty) {
      const fallbackSnap = await getDocs(query(scoresRef, limit(10)));
      if (fallbackSnap.empty) {
        setLeaderboardStatus("Пока нет результатов.");
        return;
      }
      setLeaderboardStatus(`Без сортировки • записей: ${fallbackSnap.size}`);
      fallbackSnap.forEach((doc) => {
        const data = doc.data();
        const item = document.createElement("li");
        const name = data.name || "Player";
        const score = data.score ?? 0;
        const level = data.level ?? 1;
        item.innerHTML = `<span>${name}</span><span>${score} • L${level}</span>`;
        leaderboardList.appendChild(item);
      });
      return;
    }
    setLeaderboardStatus(`Записей: ${snapshot.size}`);
    snapshot.forEach((doc) => {
      const data = doc.data();
      const item = document.createElement("li");
      const name = data.name || "Player";
      const score = data.score ?? 0;
      const level = data.level ?? 1;
      item.innerHTML = `<span>${name}</span><span>${score} • L${level}</span>`;
      leaderboardList.appendChild(item);
    });
  } catch (error) {
    setLeaderboardStatus(`Ошибка загрузки таблицы: ${
      error?.code || "unknown"
    }`);
    console.error(error);
  }
}

async function saveScore() {
  if (!state.playerName) return;
  if (window.location.protocol === "file:") {
    setLeaderboardStatus("Нужен http(s) сервер, чтобы сохранить результат.");
    return;
  }
  try {
    setLeaderboardStatus("Сохранение результата...");
    await addDoc(scoresRef, {
      name: state.playerName,
      score: state.score,
      level: state.levelIndex + 1,
      time: state.levelTime,
      createdAt: serverTimestamp(),
    });
    setLeaderboardStatus("Результат сохранен.");
    loadLeaderboard();
  } catch (error) {
    setLeaderboardStatus(`Ошибка сохранения: ${
      error?.code || "unknown"
    }`);
    console.error(error);
  }
}

function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function playTone({ freq, duration, type = "sine", volume = 0.2 }) {
  if (!audioCtx || muted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audioCtx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioCtx.currentTime + duration
  );
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration + 0.05);
}

function playSound(type) {
  if (!audioCtx || muted) return;
  if (type === "jump") {
    playTone({ freq: 520, duration: 0.18, type: "triangle", volume: 0.18 });
  }
  if (type === "collect") {
    playTone({ freq: 720, duration: 0.12, type: "sine", volume: 0.2 });
    playTone({ freq: 980, duration: 0.16, type: "sine", volume: 0.12 });
  }
  if (type === "level") {
    playTone({ freq: 440, duration: 0.2, type: "sine", volume: 0.22 });
    playTone({ freq: 660, duration: 0.24, type: "sine", volume: 0.22 });
    playTone({ freq: 880, duration: 0.28, type: "sine", volume: 0.22 });
  }
  if (type === "start") {
    playTone({ freq: 520, duration: 0.22, type: "triangle", volume: 0.18 });
  }
  if (type === "hit") {
    playTone({ freq: 180, duration: 0.12, type: "square", volume: 0.12 });
  }
  if (type === "trick") {
    playTone({ freq: 820, duration: 0.18, type: "triangle", volume: 0.16 });
  }
}

function drawSky(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#1e293b");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 220 + time * 8) % canvas.width;
    const y = 40 + (i * 70) % (canvas.height * 0.5);
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawBuildings() {
  buildings.forEach((building, index) => {
    const parallax = 0.6;
    const screenX = building.x - CAMERA.x * parallax;
    const height = building.height;
    const top = WORLD.groundBase - height - 40;
    ctx.fillStyle = index % 2 === 0 ? "#1f2937" : "#0b1220";
    ctx.fillRect(screenX, top - CAMERA.y * 0.2, building.width, height);

    ctx.fillStyle = "#334155";
    for (let i = 12; i < building.width - 12; i += 28) {
      for (let j = 20; j < height - 20; j += 34) {
        ctx.fillRect(screenX + i, top - CAMERA.y * 0.2 + j, 12, 18);
      }
    }
  });
}

function drawGround() {
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(-CAMERA.x, WORLD.height);
  for (let x = 0; x <= WORLD.width; x += 40) {
    ctx.lineTo(x - CAMERA.x, groundHeight(x) - CAMERA.y);
  }
  ctx.lineTo(WORLD.width - CAMERA.x, WORLD.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += 18) {
    const y = groundHeight(x) - 4;
    if (x === 0) {
      ctx.moveTo(x - CAMERA.x, y - CAMERA.y);
    } else {
      ctx.lineTo(x - CAMERA.x, y - CAMERA.y);
    }
  }
  ctx.stroke();
}

function drawRoadDetails() {
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.setLineDash([12, 18]);
  ctx.beginPath();
  for (let x = 0; x <= WORLD.width; x += 30) {
    const y = groundHeight(x) - 18;
    if (x === 0) {
      ctx.moveTo(x - CAMERA.x, y - CAMERA.y);
    } else {
      ctx.lineTo(x - CAMERA.x, y - CAMERA.y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawFinish() {
  const x = state.finishX - CAMERA.x;
  const y = groundHeight(state.finishX) - CAMERA.y;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 120);
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(x, y - 120);
  ctx.lineTo(x + 36, y - 108);
  ctx.lineTo(x, y - 96);
  ctx.closePath();
  ctx.fill();
}

function drawObstacles(time) {
  obstacles.forEach((obs) => {
    const centerX = obs.x + obs.width / 2;
    const wobble = obs.kind === "cone" ? Math.sin(time * 4 + centerX) * 2 : 0;
    const x = obs.x - CAMERA.x;
    const y = groundHeight(centerX) - obs.height - CAMERA.y + wobble;
    ctx.fillStyle = obs.kind === "cone" ? "#f97316" : "#94a3b8";
    if (obs.kind === "cone") {
      ctx.beginPath();
      ctx.moveTo(x, y + obs.height);
      ctx.lineTo(x + obs.width / 2, y);
      ctx.lineTo(x + obs.width, y + obs.height);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(x, y, obs.width, obs.height);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x + 6, y + 6, obs.width - 12, obs.height - 12);
    }
  });
}

function drawBeerMug(mug, time) {
  if (mug.collected) return;
  const float = Math.sin(time * 3 + mug.floatOffset) * 6;
  const x = mug.x - CAMERA.x;
  const y = mug.y - CAMERA.y + float;
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(x - 10, y - 18, 20, 24);
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(x - 10, y - 22, 20, 6);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 12, y - 8, 8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(251, 191, 36, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - 8, 22, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSkater(time) {
  const x = PLAYER.x - CAMERA.x;
  const y = PLAYER.y - CAMERA.y;
  const speed = Math.abs(PLAYER.vx);
  const bob = Math.sin(time * 8 + x * 0.01) * (PLAYER.onGround ? 2 : 5);
  const lean = clamp(PLAYER.vx / PLAYER.maxSpeed, -1, 1) * 0.15;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(PLAYER.direction, 1);
  ctx.rotate(lean);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-8, -PLAYER.height + 8, 16, 16);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(-10, -PLAYER.height + 24, 20, 18);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-12, -24, 24, 10);

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.moveTo(-26, 2);
  ctx.quadraticCurveTo(0, 12, 26, 2);
  ctx.quadraticCurveTo(0, 16, -26, 2);
  ctx.fill();

  const wheelSpin = time * (speed * 0.4 + 1.2);
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(-16, 10, 5, 0, Math.PI * 2);
  ctx.arc(16, 10, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.arc(-16, 10, 5, wheelSpin, wheelSpin + Math.PI);
  ctx.arc(16, 10, 5, wheelSpin, wheelSpin + Math.PI);
  ctx.stroke();

  ctx.restore();
}

function updatePlayer() {
  const moveLeft = keys.has("ArrowLeft") || keys.has("KeyA") || touchState.left;
  const moveRight =
    keys.has("ArrowRight") || keys.has("KeyD") || touchState.right;
  const jump =
    keys.has("ArrowUp") ||
    keys.has("KeyW") ||
    keys.has("Space") ||
    touchState.jump;

  if (moveLeft) {
    PLAYER.vx -= PLAYER.speed;
    PLAYER.direction = -1;
  }
  if (moveRight) {
    PLAYER.vx += PLAYER.speed;
    PLAYER.direction = 1;
  }

  PLAYER.vx = clamp(PLAYER.vx, -PLAYER.maxSpeed, PLAYER.maxSpeed);

  if (jump && PLAYER.onGround) {
    PLAYER.vy = -PLAYER.jumpPower;
    PLAYER.onGround = false;
    playSound("jump");
  }

  PLAYER.vy += GRAVITY;
  PLAYER.x += PLAYER.vx;
  PLAYER.y += PLAYER.vy;

  const groundY = groundHeight(PLAYER.x);
  if (PLAYER.y >= groundY) {
    if (!PLAYER.onGround && state.airTime > 0.35) {
      const trickBonus = Math.round(state.airTime * 120);
      state.score += trickBonus;
      playSound("trick");
      spawnParticles(PLAYER.x, PLAYER.y - 28);
    }
    PLAYER.y = groundY;
    PLAYER.vy = 0;
    PLAYER.onGround = true;
    state.airTime = 0;
  } else {
    state.airTime += state.frameDelta;
  }

  if (PLAYER.onGround && !moveLeft && !moveRight) {
    PLAYER.vx *= FRICTION;
    if (Math.abs(PLAYER.vx) < 0.05) {
      PLAYER.vx = 0;
    }
  }

  PLAYER.x = clamp(PLAYER.x, 40, WORLD.width - 40);
}

function updateCamera() {
  const maxX = Math.max(0, WORLD.width - canvas.width);
  const maxY = Math.max(0, WORLD.height - canvas.height);
  CAMERA.x = clamp(PLAYER.x - canvas.width * 0.4, 0, maxX);
  CAMERA.y = clamp(PLAYER.y - canvas.height * 0.6, 0, maxY);
  if (state.shake > 0) {
    CAMERA.x += (Math.random() - 0.5) * 10 * state.shake;
    CAMERA.y += (Math.random() - 0.5) * 6 * state.shake;
  }
}

function spawnParticles(x, y) {
  for (let i = 0; i < 10; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: -Math.random() * 3 - 1,
      life: 1,
      color: Math.random() > 0.5 ? "#fde68a" : "#fbbf24",
    });
  }
}

function updateParticles(delta) {
  particles.forEach((p) => {
    p.vy += 4 * delta;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= delta * 1.4;
  });
  particles = particles.filter((p) => p.life > 0);
}

function drawParticles() {
  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillRect(p.x - CAMERA.x, p.y - CAMERA.y, 4, 4);
  });
  ctx.globalAlpha = 1;
}

function checkBeerCollection() {
  let collected = state.collected;
  beerMugs.forEach((mug) => {
    if (mug.collected) return;
    const dx = PLAYER.x - mug.x;
    const dy = PLAYER.y - 32 - mug.y;
    if (Math.hypot(dx, dy) < 36) {
      mug.collected = true;
      collected += 1;
      state.score += 100;
      playSound("collect");
      spawnParticles(mug.x, mug.y - 10);
    }
  });
  if (collected !== state.collected) {
    state.collected = collected;
    updateHUD();
  }
  if (state.collected === state.total && !state.levelComplete) {
    checkFinish();
  }
}

function checkFinish() {
  if (state.levelComplete) return;
  if (state.collected < state.total) return;
  const distance = Math.abs(PLAYER.x - state.finishX);
  if (distance < 60 && PLAYER.onGround) {
    completeLevel();
  }
}

function checkObstacles() {
  if (state.hitCooldown > 0) {
    state.hitCooldown -= state.frameDelta;
    return;
  }
  if (!PLAYER.onGround) return;
  const playerLeft = PLAYER.x - PLAYER.width / 2;
  const playerRight = PLAYER.x + PLAYER.width / 2;
  obstacles.forEach((obs) => {
    const left = obs.x;
    const right = obs.x + obs.width;
    if (playerRight > left && playerLeft < right) {
      state.hitCooldown = 0.6;
      PLAYER.vx = -PLAYER.vx * 0.4;
      state.score = Math.max(0, state.score - 60);
      state.levelTime += 1.5;
      state.shake = 1;
      playSound("hit");
      spawnParticles(obs.x + obs.width / 2, groundHeight(obs.x) - 10);
    }
  });
}

function completeLevel() {
  state.levelComplete = true;
  state.running = false;
  const bonus = Math.max(0, Math.round(600 - state.levelTime * 20));
  state.score += bonus;
  updateHUD();
  levelStats.textContent = `Time ${state.levelTime.toFixed(
    1
  )}s • Bonus ${bonus} • Total ${state.score}`;
  levelComplete.classList.remove("hidden");
  playSound("level");
  saveScore();
}

function render(time) {
  drawSky(time);
  drawBuildings();
  drawGround();
  drawRoadDetails();
  drawFinish();
  drawObstacles(time);

  beerMugs.forEach((mug) => drawBeerMug(mug, time));
  drawParticles();
  drawSkater(time);
}

function loop(timestamp) {
  if (!state.lastTick) state.lastTick = timestamp;
  const delta = Math.min(0.05, (timestamp - state.lastTick) / 1000);
  state.lastTick = timestamp;
  state.frameDelta = delta;
  const time = timestamp / 1000;

  if (state.running) {
    state.levelTime += delta;
    state.totalTime += delta;
    updatePlayer();
    updateCamera();
    updateParticles(delta);
    checkBeerCollection();
    checkObstacles();
    checkFinish();
    state.shake = Math.max(0, state.shake - delta * 3);
    updateHUD();
  }

  render(time);
  requestAnimationFrame(loop);
}

function startGame() {
  state.running = true;
  overlay.classList.add("hidden");
  playSound("start");
}

function startNextLevel() {
  state.levelIndex += 1;
  buildLevel(state.levelIndex);
  state.running = true;
  levelComplete.classList.add("hidden");
  state.lastTick = 0;
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  touchState.left = false;
  touchState.right = false;
  touchState.jump = false;
});

window.addEventListener("resize", () => {
  resize();
  updateCamera();
});

function setTouch(action, isActive) {
  if (action === "left") touchState.left = isActive;
  if (action === "right") touchState.right = isActive;
  if (action === "jump") touchState.jump = isActive;
}

document.querySelectorAll(".touch-controls .btn").forEach((btn) => {
  const action = btn.dataset.action;
  const start = (event) => {
    event.preventDefault();
    setTouch(action, true);
  };
  const end = (event) => {
    event.preventDefault();
    setTouch(action, false);
  };

  btn.addEventListener("touchstart", start, { passive: false });
  btn.addEventListener("touchend", end, { passive: false });
  btn.addEventListener("touchcancel", end, { passive: false });
  btn.addEventListener("mousedown", start);
  btn.addEventListener("mouseup", end);
  btn.addEventListener("mouseleave", end);
});

startBtn.addEventListener("click", () => {
  ensureAudio();
  if (!state.started) {
    const name = playerNameInput.value.trim();
    if (!name) {
      playerNameInput.focus();
      return;
    }
    state.playerName = name;
    state.started = true;
    buildLevel(0);
  }
  startGame();
});

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) {
    startBtn.click();
  }
});

nextBtn.addEventListener("click", () => {
  ensureAudio();
  startNextLevel();
});

muteToggle.addEventListener("click", () => {
  ensureAudio();
  muted = !muted;
  muteToggle.textContent = muted ? "Sound Off" : "Sound On";
});

resize();
buildLevel(0);
updateCamera();
loadLeaderboard();
loop();
