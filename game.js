const boxesTableBody = document.getElementById("boxesTableBody");
const boxesSummary = document.getElementById("boxesSummary");
const tasksTableBody = document.getElementById("tasksTableBody");
const btnGenerate = document.getElementById("btnGenerate");
const btnAssign = document.getElementById("btnAssign");
const btnRun = document.getElementById("btnRun");
const pickersInput = document.getElementById("pickers");
const cityMap = document.getElementById("cityMap");
const segmentBarMsk1 = document.getElementById("segmentBarMsk1");
const segmentBarMsk2 = document.getElementById("segmentBarMsk2");
const segmentValueMsk1 = document.getElementById("segmentValueMsk1");
const segmentValueMsk2 = document.getElementById("segmentValueMsk2");
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
const kpiSimilarity = document.getElementById("kpiSimilarity");
const kpiPickers = document.getElementById("kpiPickers");
const kpiUtilization = document.getElementById("kpiUtilization");

const timelineBarsClustered = document.getElementById("timelineBarsClustered");

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
  trays: [],
  boxCells: [],
  tasksClustered: [],
  metrics: { clustered: null },
  actualTimes: { clustered: new Map() },
  assigned: new Set(),
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
  const uniqueSkuCount = randInt(25, 40);
  const skuDefs = [];
  for (let i = 0; i < uniqueSkuCount; i += 1) {
    const skuGroup = randItem(SKU_GROUPS);
    const skuId = `${skuGroup}-${randInt(100, 999)}`;
    const baseZoneIndex = randInt(0, ZONES.length - 1);
    skuDefs.push({ skuId, skuGroup, baseZoneIndex });
  }

  const ratioMsk1 = 0.4 + Math.random() * 0.2; // 40–60%
  const trays = [];
  const boxCells = [];
  const cellsByZone = new Map();

  const MAX_TRAYS_PER_CELL = 40;

  function getCellForZone(zone) {
    let cells = cellsByZone.get(zone);
    if (!cells) {
      cells = [];
      cellsByZone.set(zone, cells);
    }
    let cell = cells.find((c) => c.trayIds.length < MAX_TRAYS_PER_CELL);
    if (!cell) {
      cell = {
        id: `CELL-${zone}-${cells.length + 1}`,
        zone,
        trayIds: [],
      };
      cells.push(cell);
      boxCells.push(cell);
    }
    return cell;
  }

  function createTrayForSku(def) {
    const zone = ZONES[def.baseZoneIndex];
    const cell = getCellForZone(zone);
    const trayId = `TRAY-${trays.length + 1}`;
    const tray = {
      trayId,
      skuId: def.skuId,
      skuGroup: def.skuGroup,
      zone,
      cellId: cell.id,
    };
    trays.push(tray);
    cell.trayIds.push(trayId);
    return tray;
  }

  for (let i = 0; i < orderSize; i += 1) {
    const volume = randInt(5, 14);
    const hasDuplicate = Math.random() < 0.05 && volume >= 2;
    const items = [];
    const zoneSet = new Set();

    if (hasDuplicate) {
      // volume - 1 разных SKU, один из них дублируется
      const indices = [];
      for (let idx = 0; idx < skuDefs.length; idx += 1) {
        indices.push(idx);
      }
      for (let p = 0; p < volume - 1; p += 1) {
        const pickIdx = Math.floor(Math.random() * indices.length);
        const skuIndex = indices.splice(pickIdx, 1)[0];
        const def = skuDefs[skuIndex];
        const tray = createTrayForSku(def);
        items.push({
          trayId: tray.trayId,
          skuId: tray.skuId,
          skuGroup: tray.skuGroup,
          zone: tray.zone,
          cellId: tray.cellId,
        });
        zoneSet.add(tray.zone);
      }
      const dupItem = randItem(items);
      const dupDef = skuDefs.find((d) => d.skuId === dupItem.skuId) || skuDefs[0];
      const dupTray = createTrayForSku(dupDef);
      items.push({
        trayId: dupTray.trayId,
        skuId: dupTray.skuId,
        skuGroup: dupTray.skuGroup,
        zone: dupTray.zone,
        cellId: dupTray.cellId,
      });
      zoneSet.add(dupTray.zone);
    } else {
      const indices = [];
      for (let idx = 0; idx < skuDefs.length; idx += 1) {
        indices.push(idx);
      }
      for (let p = 0; p < volume; p += 1) {
        const pickIdx = Math.floor(Math.random() * indices.length);
        const skuIndex = indices.splice(pickIdx, 1)[0];
        const def = skuDefs[skuIndex];
        const tray = createTrayForSku(def);
        items.push({
          trayId: tray.trayId,
          skuId: tray.skuId,
          skuGroup: tray.skuGroup,
          zone: tray.zone,
          cellId: tray.cellId,
        });
        zoneSet.add(tray.zone);
      }
    }

    const zones = Array.from(zoneSet).sort();
    const warehouse = Math.random() < ratioMsk1 ? "MSK-1" : "MSK-2";
    const session = randItem(SESSIONS);

    boxes.push({
      id: `BOX-${i + 1}`,
      items,
      zones,
      warehouse,
      session,
      volume: items.length,
    });
  }
  state.boxes = boxes;
  state.trays = trays;
  state.boxCells = boxCells;
  state.tasksClustered = [];
  state.metrics.clustered = null;
  state.actualTimes.clustered = new Map();
  state.assigned = new Set();
  renderBoxes();
  renderTasks();
  renderCityMap();
  renderSegmentBars();
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
    if (Array.isArray(b.items)) {
      b.items.forEach((item) => {
        skuSet.add(item.skuId);
        zoneSet.add(item.zone);
      });
    } else {
      b.zones.forEach((z) => zoneSet.add(z));
    }
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

function assignClustered() {
  const tasks = [];
  const bySeg = groupByKey(
    state.boxes,
    (b) => `${b.warehouse}::${b.session}`
  );
  let taskId = 1;
  const { boxesTarget, volumeTarget, countTarget } = getChunkSettings();
  const defaultChunksPerSegment = 20;
  const effectiveCount = countTarget || (boxesTarget && volumeTarget ? null : defaultChunksPerSegment);

  bySeg.forEach((boxes) => {
    const unassigned = new Set(boxes);
    const totalBoxesSeg = boxes.length;
    const totalVolumeSeg = boxes.reduce(
      (sum, b) => sum + b.volume,
      0
    );
    let maxBoxes = 40;
    if (effectiveCount) {
      maxBoxes = Math.max(
        3,
        Math.round(totalBoxesSeg / effectiveCount)
      );
    } else if (boxesTarget) {
      maxBoxes = Math.max(3, boxesTarget);
    }
    const volumeCap = volumeTarget
      ? Math.max(
          volumeTarget,
          Math.round(totalVolumeSeg / Math.max(1, effectiveCount || 1))
        )
      : null;
    while (unassigned.size > 0) {
      const seed = unassigned.values().next().value;
      unassigned.delete(seed);
      const cluster = [seed];
      const clusterZones = new Set(seed.zones);
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
  const assignedIds = state.assigned;
  const tasksToShow = state.tasksClustered.filter((t) => assignedIds.has(t.id));
  tasksTableBody.innerHTML = "";
  tasksToShow.forEach((task) => {
    const actual = state.actualTimes.clustered.get(task.id);
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

function renderSegmentBars() {
  const tasks = state.tasksClustered;
  const assigned = state.assigned;
  const byWh = { "MSK-1": { total: 0, assigned: 0 }, "MSK-2": { total: 0, assigned: 0 } };
  tasks.forEach((t) => {
    if (byWh[t.warehouse]) {
      byWh[t.warehouse].total += 1;
      if (assigned.has(t.id)) byWh[t.warehouse].assigned += 1;
    }
  });
  const pct1 = byWh["MSK-1"].total
    ? (byWh["MSK-1"].assigned / byWh["MSK-1"].total) * 100
    : 0;
  const pct2 = byWh["MSK-2"].total
    ? (byWh["MSK-2"].assigned / byWh["MSK-2"].total) * 100
    : 0;
  if (segmentBarMsk1) {
    segmentBarMsk1.style.width = `${pct1}%`;
    segmentValueMsk1.textContent = `${byWh["MSK-1"].assigned} / ${byWh["MSK-1"].total}`;
  }
  if (segmentBarMsk2) {
    segmentBarMsk2.style.width = `${pct2}%`;
    segmentValueMsk2.textContent = `${byWh["MSK-2"].assigned} / ${byWh["MSK-2"].total}`;
  }
}

function openAssignModal() {
  if (!state.tasksClustered.length) {
    assignTasks();
  }
  const tasks = state.tasksClustered;
  const assignedSet = state.assigned;
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
  const tasksArr = state.tasksClustered;
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
  const newId = `C-M${Date.now().toString().slice(-4)}`;
  const newTask = makeTask(newId, mergedBoxes);
  newTask.jaccardAvg =
    selected.reduce((sum, t) => sum + (t.jaccardAvg || 0), 0) /
    Math.max(1, selected.length);
  const remaining = tasksArr.filter((t) => !ids.includes(t.id));
  remaining.push(newTask);
  state.tasksClustered = remaining;
  state.assigned = new Set();
  openAssignModal();
  renderTasks();
  renderSegmentBars();
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
  const m = state.metrics.clustered;
  timelineBarsClustered.innerHTML = "";
  if (m && m.schedule && m.schedule.length) {
    renderTimelineForScenario(
      "clustered",
      m.schedule,
      m.makespan,
      timelineBarsClustered
    );
  }
}

function renderKpi() {
  const m = state.metrics.clustered;
  const assignedTasks = state.tasksClustered.filter((t) =>
    state.assigned.has(t.id)
  );
  if (m) {
    kpiTimeClustered.textContent = `${m.makespan.toFixed(1)} мин`;
    kpiTasksClustered.textContent = `${assignedTasks.length} заданий`;
    kpiUtilization.textContent = `${m.utilization.toFixed(0)} %`;
  } else {
    kpiTimeClustered.textContent = "–";
    kpiTasksClustered.textContent = `${assignedTasks.length} заданий`;
    kpiUtilization.textContent = "–";
  }
  if (assignedTasks.length) {
    const avgJ =
      assignedTasks.reduce((sum, t) => sum + (t.jaccardAvg || 0), 0) /
      assignedTasks.length;
    kpiSimilarity.textContent = avgJ.toFixed(2);
    kpiPickers.textContent = "назначено";
  } else {
    kpiSimilarity.textContent = "–";
    kpiPickers.textContent = "—";
  }
}

function assignTasks() {
  if (!state.boxes.length) return;
  assignClustered();
  renderTasks();
  renderSegmentBars();
}

function runShift() {
  const assignedTasks = state.tasksClustered.filter((t) =>
    state.assigned.has(t.id)
  );
  if (!assignedTasks.length) return;
  const pickers = Math.max(1, Number(pickersInput.value) || 1);
  const result = simulateShift(assignedTasks, pickers);
  state.metrics.clustered = result;
  state.actualTimes.clustered = new Map();
  result.schedule.forEach((s) => {
    state.actualTimes.clustered.set(s.taskId, s.end - s.start);
  });
  renderKpi();
  renderTasks();
  renderTimelines();
}

btnGenerate.addEventListener("click", generateBoxes);
btnAssign.addEventListener("click", () => {
  assignTasks();
  renderCityMap();
  renderSegmentBars();
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
  if (state.assigned.has(id)) {
    state.assigned.delete(id);
  } else {
    state.assigned.add(id);
  }
  openAssignModal();
  renderTasks();
  renderSegmentBars();
  renderKpi();
});

pickersInput.addEventListener("change", () => {
  renderKpi();
  renderTimelines();
});

renderCityMap();
renderSegmentBars();

