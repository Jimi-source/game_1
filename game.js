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
const chunkBoxesInput = document.getElementById("chunkBoxes");
const chunkVolumeInput = document.getElementById("chunkVolume");
const chunkCountInput = document.getElementById("chunkCount");
const btnPlan = document.getElementById("btnPlan");
const assignModal = document.getElementById("assignModal");
const assignModalClose = document.getElementById("assignModalClose");
const assignTasksBody = document.getElementById("assignTasksBody");
const btnMergeChunks = document.getElementById("btnMergeChunks");

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
const ZONES = ["BOX1", "BOX2", "BOX3", "BOX4", "BOX5", "BOX6"];
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
  actualTimes: {
    clustered: new Map(),
    baseline: new Map(),
  },
  assigned: {
    clustered: new Set(),
    baseline: new Set(),
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
  const orderSize = randInt(2000, 3000);
  const boxes = [];
  const uniqueSkuCount = randInt(4, Math.min(6, ZONES.length));
  const skuDefs = [];
  for (let i = 0; i < uniqueSkuCount; i += 1) {
    const skuGroup = randItem(SKU_GROUPS);
    const skuId = `${skuGroup}-${randInt(100, 999)}`;
    const baseZoneIndex = i;
    skuDefs.push({ skuId, skuGroup, baseZoneIndex });
  }

  const ratioMsk1 = 0.4 + Math.random() * 0.2; // 40–60%
  let prevSkuIndex = -1;

  for (let i = 0; i < orderSize; i += 1) {
    let sku;
    const repeatSame = Math.random() < 0.05 && prevSkuIndex >= 0;
    if (repeatSame) {
      sku = skuDefs[prevSkuIndex];
    } else {
      const otherIndices = skuDefs
        .map((_, idx) => idx)
        .filter((idx) => idx !== prevSkuIndex);
      const idx =
        otherIndices.length > 0
          ? otherIndices[Math.floor(Math.random() * otherIndices.length)]
          : Math.floor(Math.random() * skuDefs.length);
      prevSkuIndex = idx;
      sku = skuDefs[idx];
    }
    const zones = [ZONES[sku.baseZoneIndex]];
    const volume = randInt(5, 14);
    const warehouse = Math.random() < ratioMsk1 ? "MSK-1" : "MSK-2";
    const session = randItem(SESSIONS);

    boxes.push({
      id: `BOX-${i + 1}`,
      skuGroup: sku.skuGroup,
      skuId: sku.skuId,
      zones,
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
   state.actualTimes.clustered = new Map();
   state.actualTimes.baseline = new Map();
  state.assigned.clustered = new Set();
  state.assigned.baseline = new Set();
  renderBoxes();
  renderTasks();
  renderCityMap();
  renderKpi();
  renderTimelines();
}

function renderBoxes() {
  boxesTableBody.innerHTML = "";
  boxesSummary.textContent = `${state.boxes.length} коробок`;
  const byWhSession = groupByKey(
    state.boxes,
    (b) => `${b.warehouse}::${b.session}`
  );
  byWhSession.forEach((boxes, key) => {
    const [warehouse, session] = key.split("::");
    const boxCount = boxes.length;
    const totalVolume = boxes.reduce((sum, b) => sum + b.volume, 0);
    const avgVolume = totalVolume / boxCount;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${warehouse}</td>
      <td>${session}</td>
      <td>${boxCount}</td>
      <td>${totalVolume}</td>
      <td>${avgVolume.toFixed(1)}</td>
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

function getChunkSettings() {
  const boxes = Number(chunkBoxesInput.value);
  const volume = Number(chunkVolumeInput.value);
  const count = Number(chunkCountInput.value);
  return {
    boxesTarget: Number.isFinite(boxes) && boxes > 0 ? boxes : null,
    volumeTarget: Number.isFinite(volume) && volume > 0 ? volume : null,
    countTarget: Number.isFinite(count) && count > 0 ? count : null,
  };
}

function assignBaseline() {
  const tasks = [];
  let taskId = 1;
  const shuffled = [...state.boxes].sort(() => Math.random() - 0.5);
  const totalBoxes = shuffled.length;
  const totalVolume = shuffled.reduce(
    (sum, b) => sum + b.volume,
    0
  );
  const { boxesTarget, volumeTarget, countTarget } = getChunkSettings();
  let baseBoxes = 40;
  if (countTarget) {
    baseBoxes = Math.max(3, Math.round(totalBoxes / countTarget));
  } else if (boxesTarget) {
    baseBoxes = Math.max(3, boxesTarget);
  }
  let current = [];
  let currentVol = 0;
  for (let i = 0; i < shuffled.length; i += 1) {
    const box = shuffled[i];
    current.push(box);
    currentVol += box.volume;
    const remaining = totalBoxes - (i + 1);
    const enoughBoxes = boxesTarget
      ? current.length >= boxesTarget
      : current.length >= baseBoxes;
    const enoughVolume = volumeTarget
      ? currentVol >= volumeTarget
      : false;
    const mustClose =
      current.length >= 3 &&
      (enoughBoxes || enoughVolume || remaining === 0);
    if (mustClose) {
      const task = makeTask(`B-${taskId}`, current);
      task.jaccardAvg = 0;
      tasks.push(task);
      taskId += 1;
      current = [];
      currentVol = 0;
    }
  }
  state.tasksBaseline = tasks;
}

function assignClustered() {
  const tasks = [];
  const bySeg = groupByKey(
    state.boxes,
    (b) => `${b.warehouse}::${b.session}`
  );
  let taskId = 1;
  const { boxesTarget, volumeTarget, countTarget } = getChunkSettings();
  bySeg.forEach((boxes) => {
    const unassigned = new Set(boxes);
    const totalBoxesSeg = boxes.length;
    const totalVolumeSeg = boxes.reduce(
      (sum, b) => sum + b.volume,
      0
    );
    let maxBoxes = 10;
    if (countTarget) {
      maxBoxes = Math.max(
        3,
        Math.round(totalBoxesSeg / countTarget)
      );
    } else if (boxesTarget) {
      maxBoxes = Math.max(3, boxesTarget);
    }
    const volumeCap = volumeTarget
      ? Math.max(
          volumeTarget,
          Math.round(totalVolumeSeg / Math.max(1, countTarget || 1))
        )
      : null;
    while (unassigned.size > 0) {
      const seed = unassigned.values().next().value;
      unassigned.delete(seed);
      const cluster = [seed];
      const clusterZones = new Set(seed.zones);
      const clusterSkus = new Set([seed.skuId]);
      let clusterVol = seed.volume;
      const cand = Array.from(unassigned);
      cand.sort((a, b) => b.zones.length - a.zones.length);
      for (const box of cand) {
        if (cluster.length >= maxBoxes) break;
        if (volumeCap && clusterVol >= volumeCap) break;
        const boxZones = new Set(box.zones);
        const simZones = jaccard(clusterZones, boxZones);
        if (simZones < 0.4) continue;
        cluster.push(box);
        clusterVol += box.volume;
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
    const actualMap = state.actualTimes[scenario];
    const actual = actualMap.get(task.id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${task.id}</td>
      <td>${task.boxIds.length}</td>
      <td>${task.skuCount}</td>
      <td>${task.zones.length}</td>
      <td>${task.jaccardAvg ? task.jaccardAvg.toFixed(2) : "–"}</td>
      <td>${task.warehouse} / ${task.session}</td>
      <td>${task.complexity.toFixed(1)}</td>
      <td>${task.eta.toFixed(1)}</td>
      <td>${actual != null ? actual.toFixed(1) : "–"}</td>
    `;
    tasksTableBody.appendChild(tr);
  });
}

function openAssignModal() {
  if (!state.tasksClustered.length && !state.tasksBaseline.length) {
    assignTasks();
  }
  const scenario = state.activeScenario;
  const tasks =
    scenario === SCENARIOS.clustered
      ? state.tasksClustered
      : state.tasksBaseline;
  const assignedSet = state.assigned[scenario];
  assignTasksBody.innerHTML = "";
  tasks.forEach((task) => {
    const row = document.createElement("tr");
    const totalVolume = task.boxIds.reduce((sum, id) => {
      const box = state.boxes.find((b) => b.id === id);
      return sum + (box ? box.volume : 0);
    }, 0);
    const isAssigned = assignedSet.has(task.id);
    row.innerHTML = `
      <td>
        <input
          type="checkbox"
          class="assign-select"
          data-id="${task.id}"
        />
      </td>
      <td>${task.id}</td>
      <td>${task.boxIds.length}</td>
      <td>${totalVolume}</td>
      <td>${task.zones.length}</td>
      <td>${task.jaccardAvg ? task.jaccardAvg.toFixed(2) : "–"}</td>
      <td>${task.eta.toFixed(1)}</td>
      <td>
        <button
          class="btn ${isAssigned ? "success" : "outlined"} assign-btn"
          data-id="${task.id}"
        >
          ${isAssigned ? "Назначено" : "Назначить"}
        </button>
      </td>
    `;
    assignTasksBody.appendChild(row);
  });
  assignModal.classList.remove("hidden");
}

function mergeSelectedChunks() {
  const scenario = state.activeScenario;
  const tasksArr =
    scenario === SCENARIOS.clustered
      ? state.tasksClustered
      : state.tasksBaseline;
  const checkboxes = assignTasksBody.querySelectorAll(
    ".assign-select:checked"
  );
  const ids = Array.from(checkboxes).map((el) => el.dataset.id);
  if (ids.length < 2) return;
  const selected = tasksArr.filter((t) => ids.includes(t.id));
  const boxesById = new Map(
    state.boxes.map((b) => [b.id, b])
  );
  const mergedBoxes = [];
  selected.forEach((task) => {
    task.boxIds.forEach((id) => {
      const box = boxesById.get(id);
      if (box) mergedBoxes.push(box);
    });
  });
  const newIdPrefix = scenario === SCENARIOS.clustered ? "C" : "B";
  const newId = `${newIdPrefix}-M${Date.now().toString().slice(-4)}`;
  const newTask = makeTask(newId, mergedBoxes);
  newTask.jaccardAvg =
    selected.reduce((sum, t) => sum + (t.jaccardAvg || 0), 0) /
    Math.max(1, selected.length);
  const remaining = tasksArr.filter((t) => !ids.includes(t.id));
  remaining.push(newTask);
  if (scenario === SCENARIOS.clustered) {
    state.tasksClustered = remaining;
  } else {
    state.tasksBaseline = remaining;
  }
  state.assigned[scenario] = new Set();
  openAssignModal();
  renderTasks();
  renderKpi();
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
  const scenario = state.activeScenario;
  const tasks =
    scenario === SCENARIOS.clustered
      ? state.tasksClustered
      : state.tasksBaseline;
  if (tasks.length) {
    const avgJ =
      tasks.reduce((sum, t) => sum + (t.jaccardAvg || 0), 0) /
      tasks.length;
    kpiSimilarity.textContent = `Средний Jaccard: ${avgJ.toFixed(2)}`;
  } else {
    kpiSimilarity.textContent = "Средний Jaccard: –";
  }
  const totalByWh = {};
  const coveredByWh = {};
  state.boxes.forEach((b) => {
    totalByWh[b.warehouse] = (totalByWh[b.warehouse] || 0) + 1;
  });
  const coveredIds = new Set();
  const assignedSet = state.assigned[scenario];
  tasks.forEach((t) => {
    if (!assignedSet.size || !assignedSet.has(t.id)) return;
    t.boxIds.forEach((id) => coveredIds.add(id));
  });
  state.boxes.forEach((b) => {
    if (coveredIds.has(b.id)) {
      coveredByWh[b.warehouse] =
        (coveredByWh[b.warehouse] || 0) + 1;
    }
  });
  const covMsk1 = totalByWh["MSK-1"]
    ? ((coveredByWh["MSK-1"] || 0) / totalByWh["MSK-1"]) * 100
    : 0;
  const covMsk2 = totalByWh["MSK-2"]
    ? ((coveredByWh["MSK-2"] || 0) / totalByWh["MSK-2"]) * 100
    : 0;
  kpiPickers.textContent = `MSK-1: ${covMsk1.toFixed(
    0
  )}% · MSK-2: ${covMsk2.toFixed(0)}%`;
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
  state.actualTimes.clustered = new Map();
  clustered.schedule.forEach((s) => {
    state.actualTimes.clustered.set(s.taskId, s.end - s.start);
  });
  if (compareModeInput.checked && state.tasksBaseline.length) {
    const baseline = simulateShift(state.tasksBaseline, pickers);
    state.metrics.baseline = baseline;
    state.actualTimes.baseline = new Map();
    baseline.schedule.forEach((s) => {
      state.actualTimes.baseline.set(s.taskId, s.end - s.start);
    });
  }
  renderKpi();
  renderTasks();
  renderTimelines();
}

btnGenerate.addEventListener("click", generateBoxes);
btnAssign.addEventListener("click", () => {
  assignTasks();
  renderCityMap();
  renderKpi();
});
btnRun.addEventListener("click", runShift);

btnPlan.addEventListener("click", () => {
  openAssignModal();
});

assignModalClose.addEventListener("click", () => {
  assignModal.classList.add("hidden");
});

assignModal.addEventListener("click", (event) => {
  if (event.target === assignModal) {
    assignModal.classList.add("hidden");
  }
});

btnMergeChunks.addEventListener("click", mergeSelectedChunks);

assignTasksBody.addEventListener("click", (event) => {
  const btn = event.target.closest(".assign-btn");
  if (!btn) return;
  const id = btn.dataset.id;
  const scenario = state.activeScenario;
  const set = state.assigned[scenario];
  if (set.has(id)) {
    set.delete(id);
  } else {
    set.add(id);
  }
  openAssignModal();
  renderKpi();
});

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

