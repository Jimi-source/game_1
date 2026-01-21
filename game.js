const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hudCollected = document.getElementById("collected");
const hudTotal = document.getElementById("total");

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

const beerMugs = [
  { x: 450, y: 0, collected: false },
  { x: 730, y: 0, collected: false },
  { x: 980, y: 0, collected: false },
  { x: 1320, y: 0, collected: false },
  { x: 1670, y: 0, collected: false },
  { x: 2040, y: 0, collected: false },
  { x: 2330, y: 0, collected: false },
  { x: 2700, y: 0, collected: false },
  { x: 2980, y: 0, collected: false },
];

const buildings = [
  { x: 0, width: 240, height: 260 },
  { x: 260, width: 220, height: 200 },
  { x: 520, width: 320, height: 300 },
  { x: 880, width: 260, height: 230 },
  { x: 1180, width: 300, height: 310 },
  { x: 1520, width: 280, height: 210 },
  { x: 1820, width: 320, height: 280 },
  { x: 2180, width: 260, height: 220 },
  { x: 2480, width: 360, height: 320 },
  { x: 2880, width: 280, height: 240 },
];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function groundHeight(x) {
  const wave = Math.sin(x / 240) * 16;
  const bump = Math.sin(x / 90) * 6;
  return WORLD.groundBase + wave + bump;
}

function placeBeerMugs() {
  beerMugs.forEach((mug) => {
    mug.y = groundHeight(mug.x) - 32;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#1e293b");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBuildings() {
  buildings.forEach((building, index) => {
    const screenX = building.x - CAMERA.x;
    const height = building.height;
    const top = WORLD.groundBase - height - 40;
    ctx.fillStyle = index % 2 === 0 ? "#1f2937" : "#0b1220";
    ctx.fillRect(screenX, top - CAMERA.y, building.width, height);

    ctx.fillStyle = "#334155";
    for (let i = 12; i < building.width - 12; i += 28) {
      for (let j = 20; j < height - 20; j += 34) {
        ctx.fillRect(screenX + i, top - CAMERA.y + j, 12, 18);
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

function drawBeerMug(mug) {
  if (mug.collected) return;
  const x = mug.x - CAMERA.x;
  const y = mug.y - CAMERA.y;
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(x - 10, y - 18, 20, 24);
  ctx.fillStyle = "#fde68a";
  ctx.fillRect(x - 10, y - 22, 20, 6);
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + 12, y - 8, 8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

function drawSkater() {
  const x = PLAYER.x - CAMERA.x;
  const y = PLAYER.y - CAMERA.y;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(x - 8, y - PLAYER.height + 8, 16, 16);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(x - 10, y - PLAYER.height + 24, 20, 18);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x - 12, y - 24, 24, 10);

  ctx.save();
  ctx.translate(x, y - 6);
  ctx.scale(PLAYER.direction, 1);
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.moveTo(-26, 2);
  ctx.quadraticCurveTo(0, 12, 26, 2);
  ctx.quadraticCurveTo(0, 16, -26, 2);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.beginPath();
  ctx.arc(-16, 10, 5, 0, Math.PI * 2);
  ctx.arc(16, 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function updatePlayer() {
  const moveLeft = keys.has("ArrowLeft") || keys.has("KeyA");
  const moveRight = keys.has("ArrowRight") || keys.has("KeyD");
  const jump =
    keys.has("ArrowUp") || keys.has("KeyW") || keys.has("Space");

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
  }

  PLAYER.vy += GRAVITY;
  PLAYER.x += PLAYER.vx;
  PLAYER.y += PLAYER.vy;

  const groundY = groundHeight(PLAYER.x);
  if (PLAYER.y >= groundY) {
    PLAYER.y = groundY;
    PLAYER.vy = 0;
    PLAYER.onGround = true;
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
  CAMERA.x = clamp(
    PLAYER.x - canvas.width * 0.4,
    0,
    WORLD.width - canvas.width
  );
  CAMERA.y = clamp(
    PLAYER.y - canvas.height * 0.6,
    0,
    WORLD.height - canvas.height
  );
}

function checkBeerCollection() {
  let collected = 0;
  beerMugs.forEach((mug) => {
    if (mug.collected) {
      collected += 1;
      return;
    }
    const dx = PLAYER.x - mug.x;
    const dy = PLAYER.y - 32 - mug.y;
    if (Math.hypot(dx, dy) < 36) {
      mug.collected = true;
      collected += 1;
    }
  });
  hudCollected.textContent = collected;
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

function render() {
  drawSky();
  drawBuildings();
  drawGround();
  drawRoadDetails();

  beerMugs.forEach(drawBeerMug);
  drawSkater();
}

function loop() {
  updatePlayer();
  updateCamera();
  checkBeerCollection();
  render();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
});

window.addEventListener("resize", () => {
  resize();
  updateCamera();
});

resize();
placeBeerMugs();
PLAYER.y = groundHeight(PLAYER.x);
hudTotal.textContent = beerMugs.length;
loop();
