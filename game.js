const moneyEl = document.getElementById("money");
const incomeEl = document.getElementById("income");
const activeParkName = document.getElementById("activeParkName");
const activeParkStatus = document.getElementById("activeParkStatus");
const activeParkSpectators = document.getElementById("activeParkSpectators");
const activeParkSkaters = document.getElementById("activeParkSkaters");
const activeParkBeer = document.getElementById("activeParkBeer");
const activeParkShowIncome = document.getElementById("activeParkShowIncome");
const activeParkBeerIncome = document.getElementById("activeParkBeerIncome");
const hireSkaterBtn = document.getElementById("hireSkaterBtn");
const hireSkaterCost = document.getElementById("hireSkaterCost");
const openBeerBtn = document.getElementById("openBeerBtn");
const openBeerCost = document.getElementById("openBeerCost");
const skaterSelect = document.getElementById("skaterSelect");
const parksList = document.getElementById("parksList");
const cityMap = document.getElementById("cityMap");
const parkModal = document.getElementById("parkModal");
const parkModalClose = document.getElementById("parkModalClose");
const parkModalTitle = document.getElementById("parkModalTitle");
const parkSceneSkaters = document.getElementById("parkSceneSkaters");
const parkSceneCrowd = document.getElementById("parkSceneCrowd");
const parkSceneBeer = document.getElementById("parkSceneBeer");

const SVG_NS = "http://www.w3.org/2000/svg";

const PARKS = [
  { id: 0, name: "Central Plaza", unlockCost: 0, spectators: 35 },
  { id: 1, name: "Riverside Deck", unlockCost: 800, spectators: 55 },
  { id: 2, name: "Neon Alley", unlockCost: 1600, spectators: 75 },
  { id: 3, name: "Skyline Bowl", unlockCost: 2600, spectators: 95 },
  { id: 4, name: "Harbor Yard", unlockCost: 3800, spectators: 120 },
];

const MAP_LAYOUT = [
  { id: 0, x: 18, y: 60 },
  { id: 1, x: 40, y: 30 },
  { id: 2, x: 62, y: 70 },
  { id: 3, x: 80, y: 40 },
  { id: 4, x: 88, y: 75 },
];

const SKATERS = [
  { id: "rookie", name: "Rookie", cost: 220, showMult: 0.6 },
  { id: "pro", name: "Pro", cost: 520, showMult: 1.1 },
  { id: "star", name: "Star", cost: 950, showMult: 1.8 },
];

const SHOW_RATE = 0.08;
const BEER_RATE = 0.06;
const HIRE_BASE = 300;
const HIRE_GROWTH = 1.35;
const BEER_COST = 850;

const state = {
  money: 250,
  activeParkId: 0,
  lastTime: 0,
  parks: PARKS.map((park, index) => ({
    ...park,
    unlocked: index === 0,
    hired: 0,
    skaters: [],
    beer: false,
  })),
};

function formatMoney(value) {
  return `₽${Math.floor(value).toLocaleString("ru-RU")}`;
}

function formatRate(value) {
  return `₽${value.toFixed(1)}/с`;
}

function getPark(id) {
  return state.parks.find((park) => park.id === id);
}

function getHireCost(park) {
  const selected = SKATERS.find((skater) => skater.id === skaterSelect.value);
  const base = selected ? selected.cost : HIRE_BASE;
  return Math.round(base * Math.pow(HIRE_GROWTH, park.hired));
}

function getParkIncome(park, isActive) {
  const hiredPower = park.skaters.reduce(
    (sum, skater) => sum + skater.showMult,
    0
  );
  const playerPower = isActive ? 1 : 0;
  const show = park.spectators * SHOW_RATE * (hiredPower + playerPower);
  const beer = park.beer ? park.spectators * BEER_RATE : 0;
  return { show, beer, total: show + beer };
}

function getTotalIncome() {
  return state.parks.reduce((sum, park) => {
    if (!park.unlocked) return sum;
    const income = getParkIncome(park, park.id === state.activeParkId);
    return sum + income.total;
  }, 0);
}

function renderActivePark() {
  const park = getPark(state.activeParkId);
  const income = getParkIncome(park, true);
  const skaters = park.skaters.length + 1;

  activeParkName.textContent = park.name;
  activeParkStatus.textContent = park.beer
    ? "Есть пивнуха"
    : "Пивнуха закрыта";
  activeParkSpectators.textContent = park.spectators;
  activeParkSkaters.textContent = skaters;
  activeParkBeer.textContent = park.beer ? "Открыта" : "Нет";
  activeParkShowIncome.textContent = formatRate(income.show);
  activeParkBeerIncome.textContent = formatRate(income.beer);

  const hireCost = getHireCost(park);
  hireSkaterCost.textContent = `Стоимость: ${formatMoney(hireCost)}`;
  hireSkaterBtn.disabled = state.money < hireCost;

  openBeerCost.textContent = `Стоимость: ${formatMoney(BEER_COST)}`;
  openBeerBtn.disabled = park.beer || state.money < BEER_COST;
}

function renderParks() {
  parksList.innerHTML = "";
  state.parks.forEach((park) => {
    const isActive = park.id === state.activeParkId;
    const income = getParkIncome(park, isActive);
    const card = document.createElement("div");
    card.className = `park-item${park.unlocked ? "" : " locked"}`;
    card.innerHTML = `
      <div class="park-row">
        <div>
          <div class="park-title">${park.name}</div>
          <div class="park-meta">
            Зрители: ${park.spectators} · Скейтеры: ${park.skaters.length}
            ${isActive ? '<span class="park-badge">Активный</span>' : ""}
          </div>
        </div>
        <div>${park.unlocked ? "Открыт" : "Закрыт"}</div>
      </div>
      <div class="park-row">
        <div>Доход: ${formatRate(income.total)}</div>
        <div class="park-actions">
          ${
            park.unlocked
              ? `<button class="primary" data-action="enter" data-id="${park.id}">
                  Войти в парк
                </button>`
              : `<button data-action="unlock" data-id="${park.id}">
                  Открыть за ${formatMoney(park.unlockCost)}
                </button>`
          }
        </div>
      </div>
    `;
    parksList.appendChild(card);
  });
}

function renderCityMap() {
  if (!cityMap) return;
  cityMap.innerHTML = "";
  for (let i = 0; i < MAP_LAYOUT.length - 1; i += 1) {
    const current = MAP_LAYOUT[i];
    const next = MAP_LAYOUT[i + 1];
    const line = document.createElement("div");
    line.className = "map-connector";
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    line.style.left = `${current.x}%`;
    line.style.top = `${current.y}%`;
    line.style.width = `${length}%`;
    line.style.transform = `rotate(${angle}rad)`;
    cityMap.appendChild(line);
  }

  MAP_LAYOUT.forEach((node) => {
    const park = getPark(node.id);
    const card = document.createElement("div");
    card.className = `map-node${park.unlocked ? " unlocked" : " locked"}${
      park.id === state.activeParkId ? " active" : ""
    }`;
    card.style.left = `${node.x}%`;
    card.style.top = `${node.y}%`;
    card.innerHTML = `<div class="dot"></div>${park.name}`;
    card.addEventListener("click", () => {
      if (park.unlocked) {
        enterPark(park.id);
      }
    });
    cityMap.appendChild(card);
  });
}

function renderSkaterSelect() {
  skaterSelect.innerHTML = "";
  SKATERS.forEach((skater) => {
    const option = document.createElement("option");
    option.value = skater.id;
    option.textContent = `${skater.name} (${formatMoney(skater.cost)})`;
    skaterSelect.appendChild(option);
  });
}

function clearGroup(group) {
  while (group.firstChild) {
    group.removeChild(group.firstChild);
  }
}

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

function renderParkScene(park) {
  clearGroup(parkSceneSkaters);
  clearGroup(parkSceneCrowd);
  clearGroup(parkSceneBeer);

  const showSkaters = park.skaters.length + 1;
  const skaterPalette = ["#1f2937", "#ef4444", "#0ea5e9", "#10b981"];
  const skaterPositions = [
    { x: 210, y: 210, scale: 1.1 },
    { x: 430, y: 190, scale: 1.0 },
    { x: 610, y: 220, scale: 0.95 },
    { x: 120, y: 260, scale: 0.9 },
  ];

  for (let i = 0; i < showSkaters; i += 1) {
    const pos = skaterPositions[i % skaterPositions.length];
    const outer = createSvgEl("g", {
      transform: `translate(${pos.x}, ${pos.y}) scale(${pos.scale})`,
    });
    const skater = createSvgEl("g", {
      class: `scene-skater${i % 2 === 0 ? " fast" : ""}`,
    });
    const head = createSvgEl("circle", {
      cx: 16,
      cy: -30,
      r: 8,
      fill: "#fcd34d",
      stroke: "#0f172a",
      "stroke-width": 2,
    });
    const torso = createSvgEl("rect", {
      x: 6,
      y: -20,
      width: 20,
      height: 26,
      rx: 8,
      fill: skaterPalette[i % skaterPalette.length],
      stroke: "#0f172a",
      "stroke-width": 2,
    });
    const legLeft = createSvgEl("rect", {
      x: 4,
      y: 6,
      width: 8,
      height: 20,
      rx: 4,
      fill: "#0f172a",
    });
    const legRight = createSvgEl("rect", {
      x: 20,
      y: 6,
      width: 8,
      height: 20,
      rx: 4,
      fill: "#0f172a",
    });
    const board = createSvgEl("rect", {
      x: -4,
      y: 24,
      width: 44,
      height: 8,
      rx: 6,
      fill: "#f59e0b",
      stroke: "#0f172a",
      "stroke-width": 2,
    });
    skater.append(head, torso, legLeft, legRight, board);
    outer.appendChild(skater);
    parkSceneSkaters.appendChild(outer);
  }

  const crowdCount = Math.min(park.spectators, 10);
  for (let i = 0; i < crowdCount; i += 1) {
    const x = 520 + i * 28;
    const y = 250 + (i % 2) * 6;
    const group = createSvgEl("g", { class: "scene-crowd" });
    const body = createSvgEl("rect", {
      x,
      y,
      width: 18,
      height: 28,
      rx: 8,
      fill: "#1f2937",
      stroke: "#0f172a",
      "stroke-width": 2,
    });
    const head = createSvgEl("circle", {
      cx: x + 9,
      cy: y - 6,
      r: 7,
      fill: "#fde68a",
      stroke: "#0f172a",
      "stroke-width": 2,
    });
    group.append(body, head);
    parkSceneCrowd.appendChild(group);
  }

  if (park.beer) {
    const cupsCount = Math.min(park.spectators, 6);
    for (let i = 0; i < cupsCount; i += 1) {
      const x = 540 + i * 30;
      const y = 300 + (i % 2) * 6;
      const cup = createSvgEl("rect", {
        x,
        y,
        width: 14,
        height: 20,
        rx: 4,
        fill: "#f59e0b",
        stroke: "#0f172a",
        "stroke-width": 2,
        class: "scene-cup",
      });
      parkSceneBeer.appendChild(cup);
    }
  }
}

function updateMoneyOnly() {
  moneyEl.textContent = formatMoney(state.money);
  incomeEl.textContent = formatRate(getTotalIncome());
}

function renderAll() {
  updateMoneyOnly();
  renderActivePark();
  renderCityMap();
  renderParks();
}

function unlockPark(parkId) {
  const park = getPark(parkId);
  if (!park || park.unlocked) return;
  if (state.money < park.unlockCost) return;
  state.money -= park.unlockCost;
  park.unlocked = true;
  state.activeParkId = park.id;
  renderAll();
}

function enterPark(parkId) {
  const park = getPark(parkId);
  if (!park || !park.unlocked) return;
  state.activeParkId = park.id;
  parkModalTitle.textContent = park.name;
  renderParkScene(park);
  parkModal.classList.remove("hidden");
  renderAll();
}

function hireSkater() {
  const park = getPark(state.activeParkId);
  const cost = getHireCost(park);
  if (state.money < cost) return;
  const skater = SKATERS.find((item) => item.id === skaterSelect.value);
  if (!skater) return;
  state.money -= cost;
  park.skaters.push(skater);
  renderAll();
}

function openBeer() {
  const park = getPark(state.activeParkId);
  if (park.beer || state.money < BEER_COST) return;
  state.money -= BEER_COST;
  park.beer = true;
  renderAll();
}

function loop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = Math.min(0.05, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;
  const income = getTotalIncome();
  state.money += income * delta;
  updateMoneyOnly();
  requestAnimationFrame(loop);
}

hireSkaterBtn.addEventListener("click", hireSkater);
openBeerBtn.addEventListener("click", openBeer);
skaterSelect.addEventListener("change", renderAll);

parksList.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  const parkId = Number(target.dataset.id);
  if (target.dataset.action === "unlock") unlockPark(parkId);
  if (target.dataset.action === "enter") enterPark(parkId);
});

parkModalClose.addEventListener("click", () => {
  parkModal.classList.add("hidden");
});

parkModal.addEventListener("click", (event) => {
  if (event.target === parkModal) {
    parkModal.classList.add("hidden");
  }
});

renderSkaterSelect();
renderAll();
requestAnimationFrame(loop);
