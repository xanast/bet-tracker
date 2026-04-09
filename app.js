const STORAGE_KEY = "bet_tracker_entries_v3";

const BOOKMAKERS = [
  "Stoiximan",
  "Novibet",
  "PameStoixima",
  "Bet365",
  "Bwin",
  "Fonbet",
  "Superbet"
];

let entries = [];
let deferredPrompt = null;
let currentEditId = null;
let expandedEntryIds = new Set();

const navButtons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".page-section");
const pageTitle = document.getElementById("pageTitle");

const betForm = document.getElementById("betForm");
const matchDate = document.getElementById("matchDate");
const sport = document.getElementById("sport");
const market = document.getElementById("market");
const matchName = document.getElementById("matchName");
const result = document.getElementById("result");
const notes = document.getElementById("notes");
const bookmakersGrid = document.getElementById("bookmakersGrid");

const entryFormTitle = document.getElementById("entryFormTitle");
const editBanner = document.getElementById("editBanner");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const submitEntryBtn = document.getElementById("submitEntryBtn");

const previewStake = document.getElementById("previewStake");
const previewMargin = document.getElementById("previewMargin");
const previewReturn1 = document.getElementById("previewReturn1");
const previewReturnX = document.getElementById("previewReturnX");
const previewReturn2 = document.getElementById("previewReturn2");
const previewActualReturn = document.getElementById("previewActualReturn");
const previewPL1 = document.getElementById("previewPL1");
const previewPLX = document.getElementById("previewPLX");
const previewPL2 = document.getElementById("previewPL2");
const previewPL = document.getElementById("previewPL");

const historyTableBody = document.getElementById("historyTableBody");
const recentEntries = document.getElementById("recentEntries");

const totalMatches = document.getElementById("totalMatches");
const totalStake = document.getElementById("totalStake");
const totalReturn = document.getElementById("totalReturn");
const totalPL = document.getElementById("totalPL");
const avgMargin = document.getElementById("avgMargin");
const roiValue = document.getElementById("roiValue");

const filterSport = document.getElementById("filterSport");
const filterMarket = document.getElementById("filterMarket");
const searchMatch = document.getElementById("searchMatch");

const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const resetFormBtn = document.getElementById("resetFormBtn");
const installBtn = document.getElementById("installBtn");

const calcMarket = document.getElementById("calcMarket");
const calcOdd1 = document.getElementById("calcOdd1");
const calcOddX = document.getElementById("calcOddX");
const calcOdd2 = document.getElementById("calcOdd2");
const toolMarginOutput = document.getElementById("toolMarginOutput");

const goNewEntryBtn = document.getElementById("goNewEntryBtn");
const goHistoryBtn = document.getElementById("goHistoryBtn");

function formatCurrency(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function parseNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    entries = [];
    return;
  }
  try {
    entries = JSON.parse(raw);
  } catch {
    entries = [];
  }
}

function calculateMargin(marketType, o1, ox, o2) {
  if (marketType === "1X2") {
    if (!o1 || !ox || !o2) return 0;
    return ((1 / o1) + (1 / ox) + (1 / o2) - 1) * 100;
  }
  if (!o1 || !o2) return 0;
  return ((1 / o1) + (1 / o2) - 1) * 100;
}

function getSportLabel(value) {
  return value === "football" ? "Ποδόσφαιρο" : "Μπάσκετ";
}

function createBookmakerCards() {
  bookmakersGrid.innerHTML = BOOKMAKERS.map((name, index) => `
    <div class="bookmaker-card premium-card" data-bookmaker="${name}">
      <div class="bookmaker-card-head">
        <div>
          <span class="panel-kicker">Bookmaker ${index + 1}</span>
          <h4>${name}</h4>
        </div>
        <div class="bookmaker-badges">
          <span class="bookmaker-badge">
            Margin: <strong id="margin-${index}">0.00%</strong>
          </span>
          <span class="bookmaker-badge">
            Stake: <strong id="stake-total-${index}">€0.00</strong>
          </span>
        </div>
      </div>

      <div class="bookmaker-fields">
        <div class="field">
          <label>Απόδοση 1</label>
          <input type="number" step="0.01" data-bm-index="${index}" data-field="odd1" placeholder="0.00" />
        </div>

        <div class="field bm-x-field">
          <label>Απόδοση Χ</label>
          <input type="number" step="0.01" data-bm-index="${index}" data-field="oddX" placeholder="0.00" />
        </div>

        <div class="field">
          <label>Απόδοση 2</label>
          <input type="number" step="0.01" data-bm-index="${index}" data-field="odd2" placeholder="0.00" />
        </div>

        <div class="field">
          <label>Stake 1</label>
          <input type="number" step="0.01" value="0" data-bm-index="${index}" data-field="stake1" placeholder="0.00" />
        </div>

        <div class="field bm-x-field">
          <label>Stake Χ</label>
          <input type="number" step="0.01" value="0" data-bm-index="${index}" data-field="stakeX" placeholder="0.00" />
        </div>

        <div class="field">
          <label>Stake 2</label>
          <input type="number" step="0.01" value="0" data-bm-index="${index}" data-field="stake2" placeholder="0.00" />
        </div>
      </div>
    </div>
  `).join("");
}

function getBookmakerFormValues(index) {
  const q = (field) => document.querySelector(`[data-bm-index="${index}"][data-field="${field}"]`);
  return {
    name: BOOKMAKERS[index],
    odd1: parseNum(q("odd1")?.value),
    oddX: parseNum(q("oddX")?.value),
    odd2: parseNum(q("odd2")?.value),
    stake1: parseNum(q("stake1")?.value),
    stakeX: parseNum(q("stakeX")?.value),
    stake2: parseNum(q("stake2")?.value)
  };
}

function computeBookmakerMetrics(bookmaker, marketType) {
  const margin = calculateMargin(marketType, bookmaker.odd1, bookmaker.oddX, bookmaker.odd2);
  const totalStake = bookmaker.stake1 + bookmaker.stakeX + bookmaker.stake2;

  const return1 = bookmaker.stake1 * bookmaker.odd1;
  const returnX = marketType === "1X2" ? bookmaker.stakeX * bookmaker.oddX : 0;
  const return2 = bookmaker.stake2 * bookmaker.odd2;

  return {
    ...bookmaker,
    margin,
    totalStake,
    return1,
    returnX,
    return2
  };
}

function getAllBookmakersFromForm() {
  return BOOKMAKERS.map((_, index) => computeBookmakerMetrics(getBookmakerFormValues(index), market.value));
}

function updateBookmakerCardVisuals() {
  const marketType = market.value;
  const is1X2 = marketType === "1X2";

  document.querySelectorAll(".bm-x-field").forEach((el) => {
    el.style.display = is1X2 ? "flex" : "none";
  });

  document.querySelectorAll(".x-field-card").forEach((el) => {
    el.style.display = is1X2 ? "block" : "none";
  });

  if (!is1X2 && result.value === "X") {
    result.value = "";
  }

  BOOKMAKERS.forEach((_, index) => {
    const bookmaker = computeBookmakerMetrics(getBookmakerFormValues(index), marketType);
    const marginEl = document.getElementById(`margin-${index}`);
    const stakeEl = document.getElementById(`stake-total-${index}`);

    if (marginEl) marginEl.textContent = formatPercent(bookmaker.margin);
    if (stakeEl) stakeEl.textContent = formatCurrency(bookmaker.totalStake);
  });
}

function computeAggregate(bookmakers, marketType, selectedResult) {
  const totalStake = bookmakers.reduce((sum, bm) => sum + bm.totalStake, 0);

  const totalReturn1 = bookmakers.reduce((sum, bm) => sum + bm.return1, 0);
  const totalReturnX = marketType === "1X2"
    ? bookmakers.reduce((sum, bm) => sum + bm.returnX, 0)
    : 0;
  const totalReturn2 = bookmakers.reduce((sum, bm) => sum + bm.return2, 0);

  const weightedMargin = totalStake
    ? bookmakers.reduce((sum, bm) => sum + (bm.margin * bm.totalStake), 0) / totalStake
    : 0;

  const pl1 = totalReturn1 - totalStake;
  const plX = totalReturnX - totalStake;
  const pl2 = totalReturn2 - totalStake;

  let actualReturn = 0;
  if (selectedResult === "1") actualReturn = totalReturn1;
  if (selectedResult === "X" && marketType === "1X2") actualReturn = totalReturnX;
  if (selectedResult === "2") actualReturn = totalReturn2;

  const actualPL = actualReturn - totalStake;

  const usedBookmakers = bookmakers.filter((bm) => bm.totalStake > 0 || bm.odd1 || bm.oddX || bm.odd2);

  return {
    bookmakers,
    usedBookmakersCount: usedBookmakers.length,
    totalStake,
    totalReturn1,
    totalReturnX,
    totalReturn2,
    weightedMargin,
    pl1,
    plX,
    pl2,
    actualReturn,
    actualPL
  };
}

function setValueClass(el, value) {
  if (!el) return;
  el.classList.remove("positive", "negative", "neutral");
  if (value > 0) el.classList.add("positive");
  else if (value < 0) el.classList.add("negative");
  else el.classList.add("neutral");
}

function updatePreview() {
  updateBookmakerCardVisuals();

  const bookmakers = getAllBookmakersFromForm();
  const aggregate = computeAggregate(bookmakers, market.value, result.value);

  previewStake.textContent = formatCurrency(aggregate.totalStake);
  previewMargin.textContent = formatPercent(aggregate.weightedMargin);
  previewReturn1.textContent = formatCurrency(aggregate.totalReturn1);
  previewReturnX.textContent = formatCurrency(aggregate.totalReturnX);
  previewReturn2.textContent = formatCurrency(aggregate.totalReturn2);
  previewActualReturn.textContent = formatCurrency(aggregate.actualReturn);

  previewPL1.textContent = formatCurrency(aggregate.pl1);
  previewPLX.textContent = formatCurrency(aggregate.plX);
  previewPL2.textContent = formatCurrency(aggregate.pl2);
  previewPL.textContent = formatCurrency(aggregate.actualPL);

  setValueClass(previewPL1, aggregate.pl1);
  setValueClass(previewPLX, aggregate.plX);
  setValueClass(previewPL2, aggregate.pl2);
  setValueClass(previewPL, aggregate.actualPL);
}

function resetBookmakerInputs() {
  BOOKMAKERS.forEach((_, index) => {
    ["odd1", "oddX", "odd2"].forEach((field) => {
      const el = document.querySelector(`[data-bm-index="${index}"][data-field="${field}"]`);
      if (el) el.value = "";
    });

    ["stake1", "stakeX", "stake2"].forEach((field) => {
      const el = document.querySelector(`[data-bm-index="${index}"][data-field="${field}"]`);
      if (el) el.value = "0";
    });
  });
}

function enterCreateMode() {
  currentEditId = null;
  entryFormTitle.textContent = "Νέα Καταχώριση Αγώνα";
  submitEntryBtn.textContent = "Αποθήκευση";
  editBanner.classList.add("hidden");
}

function enterEditMode() {
  entryFormTitle.textContent = "Επεξεργασία Καταχώρισης";
  submitEntryBtn.textContent = "Update Entry";
  editBanner.classList.remove("hidden");
}

function resetForm() {
  betForm.reset();
  matchDate.value = new Date().toISOString().split("T")[0];
  sport.value = "football";
  market.value = "1X2";
  result.value = "";
  notes.value = "";
  resetBookmakerInputs();
  enterCreateMode();
  updatePreview();
}

function populateFormFromEntry(entry) {
  matchDate.value = entry.matchDate || "";
  sport.value = entry.sport || "football";
  market.value = entry.market || "1X2";
  matchName.value = entry.matchName || "";
  result.value = entry.result || "";
  notes.value = entry.notes || "";

  resetBookmakerInputs();

  BOOKMAKERS.forEach((name, index) => {
    const bm = (entry.bookmakers || []).find((x) => x.name === name);
    if (!bm) return;

    const setField = (field, value) => {
      const el = document.querySelector(`[data-bm-index="${index}"][data-field="${field}"]`);
      if (el) el.value = value ?? (field.startsWith("stake") ? "0" : "");
    };

    setField("odd1", bm.odd1 || "");
    setField("oddX", bm.oddX || "");
    setField("odd2", bm.odd2 || "");
    setField("stake1", bm.stake1 ?? 0);
    setField("stakeX", bm.stakeX ?? 0);
    setField("stake2", bm.stake2 ?? 0);
  });

  currentEditId = entry.id;
  enterEditMode();
  updatePreview();
  switchSection("new-entry");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStats() {
  const totalEntries = entries.length;
  const sumStake = entries.reduce((acc, item) => acc + Number(item.totalStake || 0), 0);
  const sumReturn = entries.reduce((acc, item) => acc + Number(item.actualReturn || 0), 0);
  const sumPL = entries.reduce((acc, item) => acc + Number(item.actualPL || 0), 0);
  const marginAverage = totalEntries
    ? entries.reduce((acc, item) => acc + Number(item.weightedMargin || 0), 0) / totalEntries
    : 0;
  const roi = sumStake ? (sumPL / sumStake) * 100 : 0;

  totalMatches.textContent = totalEntries;
  totalStake.textContent = formatCurrency(sumStake);
  totalReturn.textContent = formatCurrency(sumReturn);
  totalPL.textContent = formatCurrency(sumPL);
  avgMargin.textContent = formatPercent(marginAverage);
  roiValue.textContent = formatPercent(roi);

  setValueClass(totalPL, sumPL);
  setValueClass(roiValue, roi);
}

function renderRecentEntries() {
  if (!entries.length) {
    recentEntries.className = "recent-list empty-state";
    recentEntries.textContent = "Δεν υπάρχουν ακόμα καταχωρίσεις.";
    return;
  }

  recentEntries.className = "recent-list";
  const recent = [...entries].slice(-5).reverse();

  recentEntries.innerHTML = recent.map(item => `
    <div class="recent-item">
      <h4>${item.matchName}</h4>
      <p>${item.matchDate} • ${getSportLabel(item.sport)} • ${item.market}</p>
      <p>Bookmakers: ${item.usedBookmakersCount} | Stake: ${formatCurrency(item.totalStake)} | Weighted Margin: ${formatPercent(item.weightedMargin)}</p>
      <p>Actual P/L: <span class="${item.actualPL > 0 ? "positive" : item.actualPL < 0 ? "negative" : "neutral"}">${formatCurrency(item.actualPL)}</span></p>
    </div>
  `).join("");
}

function getFilteredEntries() {
  const selectedSport = filterSport.value;
  const selectedMarket = filterMarket.value;
  const query = searchMatch.value.trim().toLowerCase();

  return entries.filter(item => {
    const sportMatch = selectedSport === "all" || item.sport === selectedSport;
    const marketMatch = selectedMarket === "all" || item.market === selectedMarket;
    const textMatch =
      !query ||
      item.matchName.toLowerCase().includes(query) ||
      (item.notes || "").toLowerCase().includes(query);

    return sportMatch && marketMatch && textMatch;
  });
}

function toggleExpandEntry(id) {
  if (expandedEntryIds.has(id)) expandedEntryIds.delete(id);
  else expandedEntryIds.add(id);
  renderHistory();
}

window.toggleExpandEntry = toggleExpandEntry;

function editEntry(id) {
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  populateFormFromEntry(entry);
}

window.editEntry = editEntry;

function getBookmakerDetailHtml(item) {
  const rows = (item.bookmakers || [])
    .filter((bm) => bm.totalStake > 0 || bm.odd1 || bm.oddX || bm.odd2)
    .map((bm) => `
      <div class="history-detail-card">
        <div class="history-detail-top">
          <strong>${bm.name}</strong>
          <span>${formatPercent(bm.margin)}</span>
        </div>
        <div class="history-detail-grid">
          <div><label>Odds</label><p>${item.market === "1X2"
            ? `1: ${bm.odd1 || "-"} | X: ${bm.oddX || "-"} | 2: ${bm.odd2 || "-"}`
            : `1: ${bm.odd1 || "-"} | 2: ${bm.odd2 || "-"}`
          }</p></div>
          <div><label>Stakes</label><p>${item.market === "1X2"
            ? `1: ${formatCurrency(bm.stake1)} | X: ${formatCurrency(bm.stakeX)} | 2: ${formatCurrency(bm.stake2)}`
            : `1: ${formatCurrency(bm.stake1)} | 2: ${formatCurrency(bm.stake2)}`
          }</p></div>
          <div><label>Total Stake</label><p>${formatCurrency(bm.totalStake)}</p></div>
          <div><label>Returns</label><p>${item.market === "1X2"
            ? `1: ${formatCurrency(bm.return1)} | X: ${formatCurrency(bm.returnX)} | 2: ${formatCurrency(bm.return2)}`
            : `1: ${formatCurrency(bm.return1)} | 2: ${formatCurrency(bm.return2)}`
          }</p></div>
        </div>
      </div>
    `)
    .join("");

  return `
    <tr class="history-detail-row">
      <td colspan="12">
        <div class="history-detail-wrap">
          ${rows || `<div class="empty-state">Δεν υπάρχουν bookmaker details.</div>`}
        </div>
      </td>
    </tr>
  `;
}

function renderHistory() {
  const filtered = getFilteredEntries();

  if (!filtered.length) {
    historyTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-state">Δεν βρέθηκαν καταχωρίσεις.</td>
      </tr>
    `;
    return;
  }

  let html = "";

  filtered
    .slice()
    .reverse()
    .forEach(item => {
      const isExpanded = expandedEntryIds.has(item.id);

      html += `
        <tr>
          <td>${item.matchDate}</td>
          <td>${getSportLabel(item.sport)}</td>
          <td>
            <strong>${item.matchName}</strong>
            ${item.notes ? `<div class="muted">${item.notes}</div>` : ""}
          </td>
          <td>${item.market}</td>
          <td>${item.usedBookmakersCount}</td>
          <td>${formatCurrency(item.totalStake)}</td>
          <td>${formatPercent(item.weightedMargin)}</td>
          <td class="${item.pl1 > 0 ? "positive" : item.pl1 < 0 ? "negative" : "neutral"}">${formatCurrency(item.pl1)}</td>
          <td>${item.market === "1X2"
            ? `<span class="${item.plX > 0 ? "positive" : item.plX < 0 ? "negative" : "neutral"}">${formatCurrency(item.plX)}</span>`
            : "-"
          }</td>
          <td class="${item.pl2 > 0 ? "positive" : item.pl2 < 0 ? "negative" : "neutral"}">${formatCurrency(item.pl2)}</td>
          <td class="${item.actualPL > 0 ? "positive" : item.actualPL < 0 ? "negative" : "neutral"}">${formatCurrency(item.actualPL)}</td>
          <td>
            <div class="row-actions">
              <button class="small-btn" onclick="toggleExpandEntry('${item.id}')">${isExpanded ? "Hide" : "Details"}</button>
              <button class="small-btn" onclick="editEntry('${item.id}')">Edit</button>
              <button class="small-btn delete" onclick="deleteEntry('${item.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `;

      if (isExpanded) {
        html += getBookmakerDetailHtml(item);
      }
    });

  historyTableBody.innerHTML = html;
}

function renderAll() {
  renderStats();
  renderRecentEntries();
  renderHistory();
}

function buildEntryFromForm() {
  const bookmakers = getAllBookmakersFromForm();
  const aggregate = computeAggregate(bookmakers, market.value, result.value);

  return {
    id: currentEditId || crypto.randomUUID(),
    matchDate: matchDate.value,
    sport: sport.value,
    market: market.value,
    matchName: matchName.value.trim(),
    result: result.value,
    notes: notes.value.trim(),
    bookmakers,
    usedBookmakersCount: aggregate.usedBookmakersCount,
    totalStake: aggregate.totalStake,
    totalReturn1: aggregate.totalReturn1,
    totalReturnX: aggregate.totalReturnX,
    totalReturn2: aggregate.totalReturn2,
    weightedMargin: aggregate.weightedMargin,
    pl1: aggregate.pl1,
    plX: market.value === "1X2" ? aggregate.plX : 0,
    pl2: aggregate.pl2,
    actualReturn: aggregate.actualReturn,
    actualPL: aggregate.actualPL
  };
}

function addOrUpdateEntry(event) {
  event.preventDefault();

  if (!matchName.value.trim()) {
    alert("Συμπλήρωσε όνομα αγώνα.");
    return;
  }

  const candidate = buildEntryFromForm();

  if (!candidate.totalStake) {
    alert("Συμπλήρωσε τουλάχιστον ένα stake σε κάποια στοιχηματική.");
    return;
  }

  if (currentEditId) {
    entries = entries.map((item) => item.id === currentEditId ? candidate : item);
    expandedEntryIds.add(candidate.id);
  } else {
    entries.push(candidate);
  }

  saveEntries();
  renderAll();
  resetForm();
  switchSection("history");
}

function deleteEntry(id) {
  const confirmed = confirm("Να διαγραφεί αυτή η καταχώριση;");
  if (!confirmed) return;

  entries = entries.filter(item => item.id !== id);
  expandedEntryIds.delete(id);
  if (currentEditId === id) {
    resetForm();
  }
  saveEntries();
  renderAll();
}

window.deleteEntry = deleteEntry;

function exportCSV() {
  if (!entries.length) {
    alert("Δεν υπάρχουν δεδομένα για export.");
    return;
  }

  const headers = [
    "Date",
    "Sport",
    "Match",
    "Market",
    "Result",
    "Bookmaker",
    "Odd1",
    "OddX",
    "Odd2",
    "Stake1",
    "StakeX",
    "Stake2",
    "BookmakerTotalStake",
    "BookmakerMargin",
    "Return1",
    "ReturnX",
    "Return2",
    "MatchTotalStake",
    "MatchWeightedMargin",
    "MatchReturn1",
    "MatchReturnX",
    "MatchReturn2",
    "PL1",
    "PLX",
    "PL2",
    "ActualReturn",
    "ActualPL",
    "Notes"
  ];

  const rows = [];

  entries.forEach(entry => {
    entry.bookmakers.forEach(bm => {
      if (bm.totalStake > 0 || bm.odd1 > 0 || bm.oddX > 0 || bm.odd2 > 0) {
        rows.push([
          entry.matchDate,
          entry.sport,
          `"${entry.matchName.replace(/"/g, '""')}"`,
          entry.market,
          entry.result,
          bm.name,
          bm.odd1,
          bm.oddX,
          bm.odd2,
          bm.stake1,
          bm.stakeX,
          bm.stake2,
          bm.totalStake,
          bm.margin,
          bm.return1,
          bm.returnX,
          bm.return2,
          entry.totalStake,
          entry.weightedMargin,
          entry.totalReturn1,
          entry.totalReturnX,
          entry.totalReturn2,
          entry.pl1,
          entry.plX,
          entry.pl2,
          entry.actualReturn,
          entry.actualPL,
          `"${(entry.notes || "").replace(/"/g, '""')}"`
        ]);
      }
    });
  });

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "bet-tracker-export.csv";
  link.click();

  URL.revokeObjectURL(url);
}

function clearAllEntries() {
  const confirmed = confirm("Σίγουρα θέλεις να διαγράψεις όλες τις καταχωρίσεις;");
  if (!confirmed) return;

  entries = [];
  expandedEntryIds.clear();
  resetForm();
  saveEntries();
  renderAll();
}

function switchSection(sectionId) {
  sections.forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  navButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === sectionId);
  });

  const titles = {
    dashboard: "Dashboard",
    "new-entry": "Νέα Καταχώριση",
    history: "Ιστορικό",
    tools: "Εργαλεία"
  };

  pageTitle.textContent = titles[sectionId] || "Bet Tracker";
}

function updateToolCalculator() {
  const marketType = calcMarket.value;
  const o1 = parseNum(calcOdd1.value);
  const ox = parseNum(calcOddX.value);
  const o2 = parseNum(calcOdd2.value);

  const margin = calculateMargin(marketType, o1, ox, o2);
  toolMarginOutput.textContent = formatPercent(margin);

  document.querySelectorAll(".calc-x-field").forEach(el => {
    el.style.display = marketType === "1X2" ? "flex" : "none";
  });

  if (marketType !== "1X2") {
    calcOddX.value = "";
  }
}

function bindDynamicBookmakerInputs() {
  bookmakersGrid.addEventListener("input", updatePreview);
  bookmakersGrid.addEventListener("change", updatePreview);
}

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    switchSection(btn.dataset.section);
  });
});

market.addEventListener("change", updatePreview);
result.addEventListener("change", updatePreview);

betForm.addEventListener("submit", addOrUpdateEntry);
resetFormBtn.addEventListener("click", resetForm);
cancelEditBtn.addEventListener("click", resetForm);

filterSport.addEventListener("change", renderHistory);
filterMarket.addEventListener("change", renderHistory);
searchMatch.addEventListener("input", renderHistory);

exportCsvBtn.addEventListener("click", exportCSV);
clearAllBtn.addEventListener("click", clearAllEntries);

[calcMarket, calcOdd1, calcOddX, calcOdd2].forEach(el => {
  el.addEventListener("input", updateToolCalculator);
  el.addEventListener("change", updateToolCalculator);
});

if (goNewEntryBtn) {
  goNewEntryBtn.addEventListener("click", () => {
    switchSection("new-entry");
  });
}

if (goHistoryBtn) {
  goHistoryBtn.addEventListener("click", () => {
    switchSection("history");
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.classList.remove("hidden");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.classList.add("hidden");
});


function init() {
  createBookmakerCards();
  bindDynamicBookmakerInputs();
  loadEntries();
  resetForm();
  updateToolCalculator();
  renderAll();
}

init();
