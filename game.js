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
const parkModal = document.getElementById("parkModal");
const parkModalClose = document.getElementById("parkModalClose");
const parkModalTitle = document.getElementById("parkModalTitle");
const parkSceneSkaters = document.getElementById("parkSceneSkaters");
const parkSceneCrowd = document.getElementById("parkSceneCrowd");
const parkSceneBeer = document.getElementById("parkSceneBeer");

const PARKS = [
  { id: 0, name: "Central Plaza", unlockCost: 0, spectators: 35 },
  { id: 1, name: "Riverside Deck", unlockCost: 800, spectators: 55 },
  { id: 2, name: "Neon Alley", unlockCost: 1600, spectators: 75 },
  { id: 3, name: "Skyline Bowl", unlockCost: 2600, spectators: 95 },
  { id: 4, name: "Harbor Yard", unlockCost: 3800, spectators: 120 },
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
                  ${isActive ? "Активен" : "Войти"}
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

function renderSkaterSelect() {
  skaterSelect.innerHTML = "";
  SKATERS.forEach((skater) => {
    const option = document.createElement("option");
    option.value = skater.id;
    option.textContent = `${skater.name} (${formatMoney(skater.cost)})`;
    skaterSelect.appendChild(option);
  });
}

function renderParkScene(park) {
  parkSceneSkaters.innerHTML = "";
  parkSceneCrowd.innerHTML = "";
  parkSceneBeer.innerHTML = "";

  const showSkaters = park.skaters.length + 1;
  for (let i = 0; i < showSkaters; i += 1) {
    const skater = document.createElement("div");
    skater.className = "scene-skater";
    skater.style.left = `${i * 90}px`;
    skater.style.animationDelay = `${i * 0.6}s`;
    skater.innerHTML = `
      <span class="head"></span>
      <span class="torso"></span>
      <span class="leg left"></span>
      <span class="leg right"></span>
      <span class="board"></span>
    `;
    parkSceneSkaters.appendChild(skater);
  }

  const crowdCount = Math.min(park.spectators, 10);
  for (let i = 0; i < crowdCount; i += 1) {
    const spectator = document.createElement("div");
    spectator.className = "scene-spectator";
    spectator.style.opacity = `${0.7 + (i % 3) * 0.1}`;
    parkSceneCrowd.appendChild(spectator);
  }

  if (park.beer) {
    const beer = document.createElement("div");
    beer.className = "scene-beer-stand";
    beer.textContent = "BEER";
    parkSceneBeer.appendChild(beer);
    const seat = document.createElement("div");
    seat.className = "scene-beer-seat";
    parkSceneBeer.appendChild(seat);
  } else {
    const off = document.createElement("div");
    off.className = "scene-beer-off";
    off.textContent = "Пивнуха закрыта";
    parkSceneBeer.appendChild(off);
  }
}

function updateHUD() {
  moneyEl.textContent = formatMoney(state.money);
  incomeEl.textContent = formatRate(getTotalIncome());
  renderActivePark();
  renderParks();
}

function unlockPark(parkId) {
  const park = getPark(parkId);
  if (!park || park.unlocked) return;
  if (state.money < park.unlockCost) return;
  state.money -= park.unlockCost;
  park.unlocked = true;
  state.activeParkId = park.id;
  updateHUD();
}

function enterPark(parkId) {
  const park = getPark(parkId);
  if (!park || !park.unlocked) return;
  state.activeParkId = park.id;
  parkModalTitle.textContent = park.name;
  renderParkScene(park);
  parkModal.classList.remove("hidden");
  updateHUD();
}

function hireSkater() {
  const park = getPark(state.activeParkId);
  const cost = getHireCost(park);
  if (state.money < cost) return;
  const skater = SKATERS.find((item) => item.id === skaterSelect.value);
  if (!skater) return;
  state.money -= cost;
  park.skaters.push(skater);
  updateHUD();
}

function openBeer() {
  const park = getPark(state.activeParkId);
  if (park.beer || state.money < BEER_COST) return;
  state.money -= BEER_COST;
  park.beer = true;
  updateHUD();
}

function loop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const delta = Math.min(0.05, (timestamp - state.lastTime) / 1000);
  state.lastTime = timestamp;
  const income = getTotalIncome();
  state.money += income * delta;
  updateHUD();
  requestAnimationFrame(loop);
}

hireSkaterBtn.addEventListener("click", hireSkater);
openBeerBtn.addEventListener("click", openBeer);
skaterSelect.addEventListener("change", updateHUD);

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
updateHUD();
requestAnimationFrame(loop);
