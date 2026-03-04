const boxesTableBody = document.getElementById("boxesTableBody");
const boxesSummary = document.getElementById("boxesSummary");
const tasksTableBody = document.getElementById("tasksTableBody");
const btnGenerate = document.getElementById("btnGenerate");
const btnAssign = document.getElementById("btnAssign");
const btnRun = document.getElementById("btnRun");
const pickersInput = document.getElementById("pickers");
const compareModeInput = document.getElementById("compareMode");
const tabClustered = document.getElementById("tabClustered");
const tabBaseline = document.getElementById("tabBaseline");
const cityMap = document.getElementById("cityMap");

const kpiTimeClustered = document.getElementById("kpiTimeClustered");
const kpiTasksClustered = document.getElementById("kpiTasksClustered");
const kpiTimeBaseline = document.getElementById("kpiTimeBaseline");
const kpiTasksBaseline = document.getElementById("kpiTasksBaseline");
const kpiSavings = document.getElementById("kpiSavings");
const kpiSimilarity = document.getElementById("kpiSimilarity");
const kpiUtilization = document.getElementById("kpiUtilization");
const kpiPickers = document.getElementById("kpiPickers");

const timelineBarsClustered = document.getElementById("timelineBarsClustered");
const timelineBarsBaseline = document.getElementById("timelineBarsBaseline");

const SCENARIOS = {
  clustered: "clustered",
  baseline: "baseline",
};

const WAREHOUSES = ["MSK-1", "MSK-2"];
const SESSIONS = ["Утро", "День"];
const ZONES = ["A", "B", "C", "D", "E"];
const SKU_GROUPS = ["GROCERY", "TECH", "FASHION", "SPORT", "HOME"];

const MAP_LAYOUT = [
  { id: 0, x: 20, y: 65 },
  { id: 1, x: 42, y: 30 },
  { id: 2, x: 63, y: 70 },
  { id: 3, x: 80, y: 35 },
  { id: 4, x: 88, y: 72 },
];

const state = {
  boxes: [],
  tasksClustered: [],
  tasksBaseline: [],
  scheduleClustered: [],
  scheduleBaseline: [],
  metrics: {
    clustered: null,
    baseline: null,
  },
  activeScenario: SCENARIOS.clustered,
};

function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateBoxes() {
  const count = randInt(40, 70);
  const boxes = [];
  for (let i = 0; i < count; i += 1) {
    const skuGroup = randItem(SKU_GROUPS);
    const skuId = `${skuGroup}-${randInt(100, 999)}`;
    const zoneCount = randInt(1, 3);
    const zones = new Set();
    while (zones.size < zoneCount) {
      zones.add(randItem(ZONES));
    }
    const warehouse = randItem(WAREHOUSES);
    const session = randItem(SESSIONS);
    const volume = randInt(1, 4);

    boxes.push({
      id: `BOX-${i + 1}`,
      skuGroup,
      skuId,
      zones: Array.from(zones).sort(),
      warehouse,
      session,
      volume,
    });
  }
  state.boxes = boxes;
  state.tasksClustered = [];
  state.tasksBaseline = [];
  state.scheduleClustered = [];
  state.scheduleBaseline = [];
  state.metrics.clustered = null;
  state.metrics.baseline = null;
  renderBoxes();
  renderTasks();
  renderCityMap();
  renderKpi();
  renderTimelines();
}

function renderBoxes() {
  boxesTableBody.innerHTML = "";
  boxesSummary.textContent = `${state.boxes.length} коробок`;
  state.boxes.forEach((box) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${box.id}</td>
      <td><span class="badge sku">${box.skuId}</span></td>
      <td>${box.zones.map((z) => `<span class="badge zone">${z}</span>`).join(" ")}</td>
      <td>${box.warehouse}</td>
      <td>${box.session}</td>
      <td>${box.volume}</td>
    `;
    boxesTableBody.appendChild(tr);
  });
}

function jaccard(aSet, bSet) {
  let inter = 0;
  aSet.forEach((v) => {
    if (bSet.has(v)) inter += 1;
  });
  const union = aSet.size + bSet.size - inter;
  return union === 0 ? 1 : inter / union;
}

function groupByKey(items, keyFn) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function makeTask(id, boxes) {
  const skuSet = new Set();
  const zoneSet = new Set();
  let volume = 0;
  boxes.forEach((b) => {
    skuSet.add(b.skuId);
    b.zones.forEach((z) => zoneSet.add(z));
    volume += b.volume;
  });
  const zonesArray = Array.from(zoneSet).sort();
  const complexity =
    zonesArray.length * Math.sqrt(boxes.length) + volume * 0.4;
  const eta = 1 + complexity * 0.9;
  return {
    id,
    boxIds: boxes.map((b) => b.id),
    skuCount: skuSet.size,
    zones: zonesArray,
    warehouse: boxes[0].warehouse,
    session: boxes[0].session,
    complexity,
    eta,
    jaccardAvg: 0,
  };
}

function assignBaseline() {
  const tasks = [];
  const bySeg = groupByKey(
    state.boxes,
    (b) => `${b.warehouse}::${b.session}`
  );
  let taskId = 1;
  bySeg.forEach((boxes, seg) => {
    const sorted = [...boxes].sort((a, b) =>
      a.zones.join("").localeCompare(b.zones.join(""))
    );
    for (let i = 0; i < sorted.length; i += 5) {
      const slice = sorted.slice(i, i + 5);
      const task = makeTask(`B-${taskId}`, slice);
      task.jaccardAvg = 0;
      tasks.push(task);
      taskId += 1;
    }
  });
  state.tasksBaseline = tasks;
}

function assignClustered() {
  const tasks = [];
  const bySeg = groupByKey(
    state.boxes,
    (b) => `${b.warehouse}::${b.session}`
  );
  let taskId = 1;
  bySeg.forEach((boxes) => {
    const unassigned = new Set(boxes);
    while (unassigned.size > 0) {
      const seed = unassigned.values().next().value;
      unassigned.delete(seed);
      const cluster = [seed];
      const clusterZones = new Set(seed.zones);
      const clusterSkus = new Set([seed.skuId]);
      const cand = Array.from(unassigned);
      cand.sort((a, b) => b.zones.length - a.zones.length);
      for (const box of cand) {
        if (cluster.length >= 10) break;
        const boxZones = new Set(box.zones);
        const simZones = jaccard(clusterZones, boxZones);
        if (simZones < 0.4) continue;
        cluster.push(box);
        box.zones.forEach((z) => clusterZones.add(z));
        clusterSkus.add(box.skuId);
        unassigned.delete(box);
      }
      const task = makeTask(`C-${taskId}`, cluster);
      const sims = cluster.map((b) => {
        const z = new Set(b.zones);
        return jaccard(clusterZones, z);
      });
      task.jaccardAvg =
        sims.reduce((sum, v) => sum + v, 0) / Math.max(1, sims.length);
      tasks.push(task);
      taskId += 1;
    }
  });
  state.tasksClustered = tasks;
}

function renderTasks() {
  const scenario = state.activeScenario;
  const tasks =
    scenario === SCENARIOS.clustered
      ? state.tasksClustered
      : state.tasksBaseline;
  tasksTableBody.innerHTML = "";
  tasks.forEach((task) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${task.id}</td>
      <td>${task.boxIds.length}</td>
      <td>${task.skuCount}</td>
      <td>${task.zones
        .map((z) => `<span class="badge zone">${z}</span>`)
        .join(" ")}</td>
      <td>${task.jaccardAvg ? task.jaccardAvg.toFixed(2) : "–"}</td>
      <td>${task.warehouse} / ${task.session}</td>
      <td>${task.complexity.toFixed(1)}</td>
      <td>${task.eta.toFixed(1)}</td>
    `;
    tasksTableBody.appendChild(tr);
  });
}

function renderCityMap() {
  cityMap.innerHTML = "";
  for (let i = 0; i < MAP_LAYOUT.length - 1; i += 1) {
    const a = MAP_LAYOUT[i];
    const b = MAP_LAYOUT[i + 1];
    const line = document.createElement("div");
    line.className = "map-connector";
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    line.style.left = `${a.x}%`;
    line.style.top = `${a.y}%`;
    line.style.width = `${len}%`;
    line.style.transform = `rotate(${ang}rad)`;
    cityMap.appendChild(line);
  }
  MAP_LAYOUT.forEach((node) => {
    const park = { id: node.id, unlocked: true }; // all active in this model
    const card = document.createElement("div");
    card.className = `map-node unlocked${
      node.id === 0 ? " active" : ""
    }`;
    card.style.left = `${node.x}%`;
    card.style.top = `${node.y}%`;
    card.innerHTML = `<div class="dot"></div>Парк ${node.id + 1}`;
    cityMap.appendChild(card);
  });
}

function simulateShift(tasks, pickers) {
  const pickerStates = [];
  for (let i = 0; i < pickers; i += 1) {
    pickerStates.push({ id: i + 1, availableAt: 0, busy: 0 });
  }
  const schedule = [];
  const sorted = [...tasks].sort((a, b) => b.complexity - a.complexity);
  sorted.forEach((task) => {
    pickerStates.sort((a, b) => a.availableAt - b.availableAt);
    const picker = pickerStates[0];
    const start = picker.availableAt;
    const end = start + task.eta;
    picker.availableAt = end;
    picker.busy += task.eta;
    schedule.push({
      pickerId: picker.id,
      taskId: task.id,
      start,
      end,
    });
  });
  const makespan = schedule.reduce(
    (max, s) => Math.max(max, s.end),
    0
  );
  const totalBusy = pickerStates.reduce((sum, p) => sum + p.busy, 0);
  const utilization =
    makespan === 0 ? 0 : (totalBusy / (makespan * pickers)) * 100;
  return { schedule, makespan, utilization };
}

function renderTimelineForScenario(
  scenario,
  schedule,
  makespan,
  container
) {
  container.innerHTML = "";
  if (!schedule.length || makespan === 0) return;
  const pickers = new Set(schedule.map((s) => s.pickerId));
  pickers.forEach((id) => {
    const row = document.createElement("div");
    row.className = "timeline-row";
    const label = document.createElement("div");
    label.className = "timeline-row-label";
    label.textContent = `#${id}`;
    row.appendChild(label);
    const tasks = schedule.filter((s) => s.pickerId === id);
    tasks.forEach((t) => {
      const div = document.createElement("div");
      div.className = `timeline-task ${scenario}`;
      const left = (t.start / makespan) * 100;
      const width = ((t.end - t.start) / makespan) * 100;
      div.style.left = `${left}%`;
      div.style.width = `${width}%`;
      div.innerHTML = `<span>${t.taskId}</span>`;
      row.appendChild(div);
    });
    container.appendChild(row);
  });
}

function renderTimelines() {
  const compare = compareModeInput.checked;
  const mClustered = state.metrics.clustered;
  const mBaseline = state.metrics.baseline;
  timelineBarsClustered.innerHTML = "";
  timelineBarsBaseline.innerHTML = "";
  if (mClustered) {
    renderTimelineForScenario(
      "clustered",
      mClustered.schedule,
      mClustered.makespan,
      timelineBarsClustered
    );
  }
  if (compare && mBaseline) {
    renderTimelineForScenario(
      "baseline",
      mBaseline.schedule,
      mBaseline.makespan,
      timelineBarsBaseline
    );
  }
}

function renderKpi() {
  const mC = state.metrics.clustered;
  const mB = state.metrics.baseline;
  if (mC) {
    kpiTimeClustered.textContent = `${mC.makespan.toFixed(1)} мин`;
    kpiTasksClustered.textContent = `${state.tasksClustered.length} заданий`;
    kpiUtilization.textContent = `${mC.utilization.toFixed(0)} %`;
  } else {
    kpiTimeClustered.textContent = "–";
    kpiTasksClustered.textContent = "–";
    kpiUtilization.textContent = "–";
  }
  if (mB) {
    kpiTimeBaseline.textContent = `${mB.makespan.toFixed(1)} мин`;
    kpiTasksBaseline.textContent = `${state.tasksBaseline.length} заданий`;
  } else {
    kpiTimeBaseline.textContent = "–";
    kpiTasksBaseline.textContent = "–";
  }
  if (mC && mB) {
    const diff = ((mB.makespan - mC.makespan) / mB.makespan) * 100;
    kpiSavings.textContent = `${diff.toFixed(1)} %`;
  } else {
    kpiSavings.textContent = "–";
  }
  if (state.tasksClustered.length) {
    const avgJ =
      state.tasksClustered.reduce(
        (sum, t) => sum + (t.jaccardAvg || 0),
        0
      ) / state.tasksClustered.length;
    kpiSimilarity.textContent = `Средний Jaccard: ${avgJ.toFixed(2)}`;
  } else {
    kpiSimilarity.textContent = "Средний Jaccard: –";
  }
  kpiPickers.textContent = `${Number(
    pickersInput.value || 0
  )} сборщиков`;
}

function assignTasks() {
  if (!state.boxes.length) return;
  assignBaseline();
  assignClustered();
  renderTasks();
}

function runShift() {
  if (!state.tasksClustered.length) return;
  const pickers = Math.max(1, Number(pickersInput.value) || 1);
  const clustered = simulateShift(state.tasksClustered, pickers);
  state.metrics.clustered = clustered;
  if (compareModeInput.checked && state.tasksBaseline.length) {
    const baseline = simulateShift(state.tasksBaseline, pickers);
    state.metrics.baseline = baseline;
  }
  renderKpi();
  renderTimelines();
}

btnGenerate.addEventListener("click", generateBoxes);
btnAssign.addEventListener("click", () => {
  assignTasks();
  renderCityMap();
  renderKpi();
});
btnRun.addEventListener("click", runShift);

pickersInput.addEventListener("change", () => {
  renderKpi();
  renderTimelines();
});

compareModeInput.addEventListener("change", () => {
  renderKpi();
  renderTimelines();
});

tabClustered.addEventListener("click", () => {
  state.activeScenario = SCENARIOS.clustered;
  tabClustered.classList.add("active");
  tabBaseline.classList.remove("active");
  renderTasks();
});

tabBaseline.addEventListener("click", () => {
  state.activeScenario = SCENARIOS.baseline;
  tabBaseline.classList.add("active");
  tabClustered.classList.remove("active");
  renderTasks();
});

renderCityMap();

