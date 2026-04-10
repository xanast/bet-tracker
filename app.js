const STORAGE_KEY = "bet_tracker_entries";

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
let supabaseClient = null;
let currentUser = null;
let authReady = false;
let isSyncing = false;

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

const authPanel = document.getElementById("authPanel");
const authToggleBtn = document.getElementById("authToggleBtn");
const authCloseBtn = document.getElementById("authCloseBtn");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authStatusText = document.getElementById("authStatusText");
const authLoginBtn = document.getElementById("authLoginBtn");
const authSignupBtn = document.getElementById("authSignupBtn");
const authLogoutBtn = document.getElementById("authLogoutBtn");
const authSyncBtn = document.getElementById("authSyncBtn");

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
  const possibleKeys = [
    "bet_tracker_entries",
    "bet_tracker_entries_v3",
    "bet_tracker_entries_v2",
    "bet_tracker_entries_v1"
  ];

  let loaded = null;

  for (const key of possibleKeys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        loaded = parsed;
        break;
      }
    } catch {
      // ignore invalid old storage
    }
  }

  entries = (loaded || []).map(normalizeEntry);
  saveEntries();
}

function sortEntriesByDateDesc(list) {
  return [...list].sort((a, b) => {
    const dateA = new Date(a.matchDate || 0).getTime();
    const dateB = new Date(b.matchDate || 0).getTime();

    if (dateB !== dateA) return dateB - dateA;

    const updatedA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const updatedB = new Date(b.updatedAt || b.createdAt || 0).getTime();

    return updatedB - updatedA;
  });
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

function getOutcomeLabel(marketType, outcome) {
  if (marketType === "1-2") {
    if (outcome === "1") return "1";
    if (outcome === "2") return "2";
    return "-";
  }
  return outcome;
}

function setAuthStatus(message) {
  if (authStatusText) authStatusText.textContent = message;
}

function updateAuthUI() {
  if (!authReady) {
    setAuthStatus("Supabase config δεν φορτώθηκε σωστά.");
    return;
  }

  if (currentUser) {
    setAuthStatus(`Logged in as ${currentUser.email || "user"}. Το ιστορικό συγχρονίζεται στο cloud.`);
  } else {
    setAuthStatus("Local mode. Συνδέσου για sync σε κινητό και PC.");
  }
}

function toggleAuthPanel(forceOpen = null) {
  if (!authPanel) return;

  const shouldOpen =
    forceOpen === null
      ? authPanel.classList.contains("hidden")
      : forceOpen;

  authPanel.classList.toggle("hidden", !shouldOpen);

  if (authToggleBtn) {
    authToggleBtn.textContent = shouldOpen ? "Close Sync" : "Cloud Sync";
  }
}

function createBookmakerCards() {
  if (!bookmakersGrid) return;

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
  const totalStake = Number(bookmaker.stake1 || 0) + Number(bookmaker.stakeX || 0) + Number(bookmaker.stake2 || 0);

  const return1 = Number(bookmaker.stake1 || 0) * Number(bookmaker.odd1 || 0);
  const returnX = marketType === "1X2" ? Number(bookmaker.stakeX || 0) * Number(bookmaker.oddX || 0) : 0;
  const return2 = Number(bookmaker.stake2 || 0) * Number(bookmaker.odd2 || 0);

  return {
    ...bookmaker,
    margin,
    totalStake,
    return1,
    returnX,
    return2
  };
}

function computeAggregate(bookmakers, marketType, selectedResult) {
  const totalStake = bookmakers.reduce((sum, bm) => sum + Number(bm.totalStake || 0), 0);

  const totalReturn1 = bookmakers.reduce((sum, bm) => sum + Number(bm.return1 || 0), 0);
  const totalReturnX = marketType === "1X2"
    ? bookmakers.reduce((sum, bm) => sum + Number(bm.returnX || 0), 0)
    : 0;
  const totalReturn2 = bookmakers.reduce((sum, bm) => sum + Number(bm.return2 || 0), 0);

  const weightedMargin = totalStake
    ? bookmakers.reduce((sum, bm) => sum + (Number(bm.margin || 0) * Number(bm.totalStake || 0)), 0) / totalStake
    : 0;

  const pl1 = totalReturn1 - totalStake;
  const plX = totalReturnX - totalStake;
  const pl2 = totalReturn2 - totalStake;

  let actualReturn = 0;
  if (selectedResult === "1") actualReturn = totalReturn1;
  if (selectedResult === "X" && marketType === "1X2") actualReturn = totalReturnX;
  if (selectedResult === "2") actualReturn = totalReturn2;

  const actualPL = selectedResult ? actualReturn - totalStake : 0;

  const candidates = marketType === "1X2"
    ? [
        { outcome: "1", pl: pl1 },
        { outcome: "X", pl: plX },
        { outcome: "2", pl: pl2 }
      ]
    : [
        { outcome: "1", pl: pl1 },
        { outcome: "2", pl: pl2 }
      ];

  const bestCase = candidates.reduce((best, cur) => cur.pl > best.pl ? cur : best, candidates[0] || { outcome: "-", pl: 0 });
  const worstCase = candidates.reduce((worst, cur) => cur.pl < worst.pl ? cur : worst, candidates[0] || { outcome: "-", pl: 0 });

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
    actualPL,
    bestCase,
    worstCase
  };
}

function normalizeEntry(rawEntry) {
  const entry = {
    ...rawEntry,
    bookmakers: Array.isArray(rawEntry.bookmakers) ? rawEntry.bookmakers : []
  };

  const computedBookmakers = entry.bookmakers.map((bm) =>
    computeBookmakerMetrics(
      {
        name: bm.name,
        odd1: Number(bm.odd1 || 0),
        oddX: Number(bm.oddX || 0),
        odd2: Number(bm.odd2 || 0),
        stake1: Number(bm.stake1 || 0),
        stakeX: Number(bm.stakeX || 0),
        stake2: Number(bm.stake2 || 0)
      },
      entry.market || "1X2"
    )
  );

  const aggregate = computeAggregate(computedBookmakers, entry.market || "1X2", entry.result || "");

  return {
    ...entry,
    bookmakers: computedBookmakers,
    usedBookmakersCount: aggregate.usedBookmakersCount,
    totalStake: aggregate.totalStake,
    totalReturn1: aggregate.totalReturn1,
    totalReturnX: aggregate.totalReturnX,
    totalReturn2: aggregate.totalReturn2,
    weightedMargin: aggregate.weightedMargin,
    pl1: aggregate.pl1,
    plX: (entry.market || "1X2") === "1X2" ? aggregate.plX : 0,
    pl2: aggregate.pl2,
    actualReturn: aggregate.actualReturn,
    actualPL: aggregate.actualPL,
    bestCase: aggregate.bestCase,
    worstCase: aggregate.worstCase
  };
}

function getAllBookmakersFromForm() {
  if (!market) return [];
  return BOOKMAKERS.map((_, index) => computeBookmakerMetrics(getBookmakerFormValues(index), market.value));
}

function updateBookmakerCardVisuals() {
  if (!market) return;

  const marketType = market.value;
  const is1X2 = marketType === "1X2";

  document.querySelectorAll(".bm-x-field").forEach((el) => {
    el.style.display = is1X2 ? "flex" : "none";
  });

  document.querySelectorAll(".x-field-card").forEach((el) => {
    el.style.display = is1X2 ? "block" : "none";
  });

  if (!is1X2 && result && result.value === "X") {
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

function setValueClass(el, value) {
  if (!el) return;
  el.classList.remove("positive", "negative", "neutral");
  if (value > 0) el.classList.add("positive");
  else if (value < 0) el.classList.add("negative");
  else el.classList.add("neutral");
}

function updatePreview() {
  if (!previewStake) return;

  updateBookmakerCardVisuals();

  const bookmakers = getAllBookmakersFromForm();
  const aggregate = computeAggregate(bookmakers, market?.value || "1X2", result?.value || "");

  previewStake.textContent = formatCurrency(aggregate.totalStake);
  previewMargin.textContent = formatPercent(aggregate.weightedMargin);
  previewReturn1.textContent = formatCurrency(aggregate.totalReturn1);
  previewReturnX.textContent = formatCurrency(aggregate.totalReturnX);
  previewReturn2.textContent = formatCurrency(aggregate.totalReturn2);
  previewActualReturn.textContent = formatCurrency(aggregate.actualReturn);

  previewPL1.textContent = formatCurrency(aggregate.pl1);
  previewPLX.textContent = formatCurrency(aggregate.plX);
  previewPL2.textContent = formatCurrency(aggregate.pl2);
  previewPL.textContent = result?.value ? formatCurrency(aggregate.actualPL) : "—";

  setValueClass(previewPL1, aggregate.pl1);
  setValueClass(previewPLX, aggregate.plX);
  setValueClass(previewPL2, aggregate.pl2);
  if (result?.value) setValueClass(previewPL, aggregate.actualPL);
  else previewPL.classList.remove("positive", "negative", "neutral");
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
  if (entryFormTitle) entryFormTitle.textContent = "Νέα Καταχώριση Αγώνα";
  if (submitEntryBtn) submitEntryBtn.textContent = "Αποθήκευση";
  if (editBanner) editBanner.classList.add("hidden");
}

function enterEditMode() {
  if (entryFormTitle) entryFormTitle.textContent = "Επεξεργασία Καταχώρισης";
  if (submitEntryBtn) submitEntryBtn.textContent = "Update Entry";
  if (editBanner) editBanner.classList.remove("hidden");
}

function resetForm() {
  if (betForm) betForm.reset();
  if (matchDate) matchDate.value = new Date().toISOString().split("T")[0];
  if (sport) sport.value = "football";
  if (market) market.value = "1X2";
  if (result) result.value = "";
  if (notes) notes.value = "";
  resetBookmakerInputs();
  enterCreateMode();
  updatePreview();
}

function populateFormFromEntry(entry) {
  if (matchDate) matchDate.value = entry.matchDate || "";
  if (sport) sport.value = entry.sport || "football";
  if (market) market.value = entry.market || "1X2";
  if (matchName) matchName.value = entry.matchName || "";
  if (result) result.value = entry.result || "";
  if (notes) notes.value = entry.notes || "";

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
  if (!totalMatches) return;

  const normalizedEntries = entries.map(normalizeEntry);
  const totalEntries = normalizedEntries.length;
  const sumStake = normalizedEntries.reduce((acc, item) => acc + Number(item.totalStake || 0), 0);
  const sumReturn = normalizedEntries.reduce((acc, item) => acc + Number(item.actualReturn || 0), 0);
  const sumPL = normalizedEntries.reduce((acc, item) => acc + Number(item.actualPL || 0), 0);
  const marginAverage = totalEntries
    ? normalizedEntries.reduce((acc, item) => acc + Number(item.weightedMargin || 0), 0) / totalEntries
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
  if (!recentEntries) return;

  const normalizedEntries = sortEntriesByDateDesc(entries.map(normalizeEntry));

  if (!normalizedEntries.length) {
    recentEntries.className = "recent-list empty-state";
    recentEntries.textContent = "Δεν υπάρχουν ακόμα καταχωρίσεις.";
    return;
  }

  recentEntries.className = "recent-list";
  const recent = normalizedEntries.slice(0, 5);

  recentEntries.innerHTML = recent.map(item => {
    const finalState = item.result
      ? `${item.result} • ${item.actualPL > 0 ? "Κέρδος" : item.actualPL < 0 ? "Χασούρα" : "Breakeven"} ${formatCurrency(item.actualPL)}`
      : `Best: ${getOutcomeLabel(item.market, item.bestCase.outcome)} ${formatCurrency(item.bestCase.pl)} | Worst: ${getOutcomeLabel(item.market, item.worstCase.outcome)} ${formatCurrency(item.worstCase.pl)}`;

    return `
      <div class="recent-item">
        <h4>${item.matchName}</h4>
        <p>${item.matchDate} • ${getSportLabel(item.sport)} • ${item.market}</p>
        <p>Bookmakers: ${item.usedBookmakersCount} | Stake: ${formatCurrency(item.totalStake)} | Γκανιότα: ${formatPercent(item.weightedMargin)}</p>
        <p>${finalState}</p>
      </div>
    `;
  }).join("");
}

function getFilteredEntries() {
  const selectedSport = filterSport?.value || "all";
  const selectedMarket = filterMarket?.value || "all";
  const query = searchMatch?.value.trim().toLowerCase() || "";

  return sortEntriesByDateDesc(entries.map(normalizeEntry)).filter(item => {
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
  const entry = entries.map(normalizeEntry).find((item) => item.id === id);
  if (!entry) return;
  populateFormFromEntry(entry);
}

window.editEntry = editEntry;

function getSettledLabel(item) {
  if (!item.result) return "Δεν έχει λήξει / δεν έχει οριστεί αποτέλεσμα";
  if (item.actualPL > 0) return `Τελικό: ${item.result} • Κέρδος ${formatCurrency(item.actualPL)}`;
  if (item.actualPL < 0) return `Τελικό: ${item.result} • Χασούρα ${formatCurrency(item.actualPL)}`;
  return `Τελικό: ${item.result} • Breakeven`;
}

function getBookmakerDetailHtml(item) {
  const rows = (item.bookmakers || [])
    .filter((bm) => bm.totalStake > 0 || bm.odd1 || bm.oddX || bm.odd2)
    .map((bm) => `
      <div class="history-detail-card">
        <div class="history-detail-top">
          <strong>${bm.name}</strong>
          <span>Γκανιότα ${formatPercent(bm.margin)}</span>
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

  const summary = `
    <div class="history-detail-card" style="margin-bottom:12px;">
      <div class="history-detail-top">
        <strong>Match Summary</strong>
        <span>Γκανιότα ${formatPercent(item.weightedMargin)}</span>
      </div>
      <div class="history-detail-grid">
        <div><label>Best Case</label><p>${getOutcomeLabel(item.market, item.bestCase.outcome)} → ${formatCurrency(item.bestCase.pl)}</p></div>
        <div><label>Worst Case</label><p>${getOutcomeLabel(item.market, item.worstCase.outcome)} → ${formatCurrency(item.worstCase.pl)}</p></div>
        <div><label>Settlement</label><p>${getSettledLabel(item)}</p></div>
        <div><label>Stake</label><p>${formatCurrency(item.totalStake)}</p></div>
      </div>
    </div>
  `;

  return `
    <tr class="history-detail-row">
      <td colspan="12">
        <div class="history-detail-wrap">
          ${summary}
          ${rows || `<div class="empty-state">Δεν υπάρχουν bookmaker details.</div>`}
        </div>
      </td>
    </tr>
  `;
}

function renderHistory() {
  if (!historyTableBody) return;

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

  filtered.forEach(item => {
    const isExpanded = expandedEntryIds.has(item.id);

    const settledBadge = item.result
      ? `<div class="muted">${getSettledLabel(item)}</div>`
      : `<div class="muted">Best: ${getOutcomeLabel(item.market, item.bestCase.outcome)} ${formatCurrency(item.bestCase.pl)} | Worst: ${getOutcomeLabel(item.market, item.worstCase.outcome)} ${formatCurrency(item.worstCase.pl)}</div>`;

    html += `
      <tr>
        <td>${item.matchDate}</td>
        <td>${getSportLabel(item.sport)}</td>
        <td>
          <strong>${item.matchName}</strong>
          ${settledBadge}
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
        <td>${item.result
          ? `<span class="${item.actualPL > 0 ? "positive" : item.actualPL < 0 ? "negative" : "neutral"}">${formatCurrency(item.actualPL)}</span>`
          : "—"
        }</td>
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
  const aggregate = computeAggregate(bookmakers, market?.value || "1X2", result?.value || "");
  const nowIso = new Date().toISOString();

  let createdAt = nowIso;
  if (currentEditId) {
    const existing = entries.find((item) => item.id === currentEditId);
    createdAt = existing?.createdAt || nowIso;
  }

  return normalizeEntry({
    id: currentEditId || crypto.randomUUID(),
    matchDate: matchDate?.value || "",
    sport: sport?.value || "football",
    market: market?.value || "1X2",
    matchName: matchName?.value.trim() || "",
    result: result?.value || "",
    notes: notes?.value.trim() || "",
    bookmakers,
    usedBookmakersCount: aggregate.usedBookmakersCount,
    totalStake: aggregate.totalStake,
    totalReturn1: aggregate.totalReturn1,
    totalReturnX: aggregate.totalReturnX,
    totalReturn2: aggregate.totalReturn2,
    weightedMargin: aggregate.weightedMargin,
    pl1: aggregate.pl1,
    plX: (market?.value || "1X2") === "1X2" ? aggregate.plX : 0,
    pl2: aggregate.pl2,
    actualReturn: aggregate.actualReturn,
    actualPL: aggregate.actualPL,
    updatedAt: nowIso,
    createdAt
  });
}

function mergeEntries(remoteEntries, localEntries) {
  const map = new Map();

  remoteEntries.forEach((item) => {
    map.set(item.id, normalizeEntry(item));
  });

  localEntries.forEach((item) => {
    const normalizedLocal = normalizeEntry(item);
    const existing = map.get(normalizedLocal.id);

    if (!existing) {
      map.set(normalizedLocal.id, normalizedLocal);
      return;
    }

    const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const localUpdated = new Date(normalizedLocal.updatedAt || normalizedLocal.createdAt || 0).getTime();

    if (localUpdated > existingUpdated) {
      map.set(normalizedLocal.id, normalizedLocal);
    }
  });

  return sortEntriesByDateDesc(Array.from(map.values()));
}

function entryToDbRow(entry, userId) {
  const normalized = normalizeEntry(entry);

  return {
    id: normalized.id,
    user_id: userId,
    match_date: normalized.matchDate,
    sport: normalized.sport,
    market: normalized.market,
    match_name: normalized.matchName,
    result: normalized.result || null,
    notes: normalized.notes || null,
    payload: normalized,
    total_stake: normalized.totalStake || 0,
    weighted_margin: normalized.weightedMargin || 0,
    actual_return: normalized.actualReturn || 0,
    actual_pl: normalized.actualPL || 0,
    used_bookmakers_count: normalized.usedBookmakersCount || 0
  };
}

function dbRowToEntry(row) {
  const payload = row.payload || {};
  return normalizeEntry({
    ...payload,
    id: row.id,
    matchDate: row.match_date,
    sport: row.sport,
    market: row.market,
    matchName: row.match_name,
    result: row.result || "",
    notes: row.notes || "",
    totalStake: Number(row.total_stake || payload.totalStake || 0),
    weightedMargin: Number(row.weighted_margin || payload.weightedMargin || 0),
    actualReturn: Number(row.actual_return || payload.actualReturn || 0),
    actualPL: Number(row.actual_pl || payload.actualPL || 0),
    usedBookmakersCount: Number(row.used_bookmakers_count || payload.usedBookmakersCount || 0),
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  });
}

async function initSupabase() {
  try {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      setAuthStatus("Supabase config δεν βρέθηκε. Το app τρέχει local only.");
      return;
    }

    supabaseClient = window.supabase.createClient(
      window.SUPABASE_URL,
      window.SUPABASE_ANON_KEY
    );

    authReady = true;

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error(error);
      setAuthStatus("Αποτυχία φόρτωσης auth session.");
      return;
    }

    currentUser = data.session?.user || null;
    updateAuthUI();

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      updateAuthUI();

      if (currentUser) {
        await syncFromCloud();
      }
    });
  } catch (err) {
    console.error(err);
    setAuthStatus("Αποτυχία αρχικοποίησης Supabase.");
  }
}

async function signUpWithEmail() {
  if (!supabaseClient) {
    alert("Supabase not ready.");
    return;
  }

  const email = authEmailInput?.value.trim();
  const password = authPasswordInput?.value.trim();

  if (!email || !password) {
    alert("Βάλε email και password.");
    return;
  }

  setAuthStatus("Creating account...");

  const { error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    alert(error.message);
    updateAuthUI();
    return;
  }

  setAuthStatus("Το account δημιουργήθηκε. Αν έχει email confirmation ενεργό, επιβεβαίωσέ το και μετά κάνε login.");
}

async function loginWithEmail() {
  if (!supabaseClient) {
    alert("Supabase not ready.");
    return;
  }

  const email = authEmailInput?.value.trim();
  const password = authPasswordInput?.value.trim();

  if (!email || !password) {
    alert("Βάλε email και password.");
    return;
  }

  setAuthStatus("Logging in...");

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert(error.message);
    updateAuthUI();
    return;
  }

  setAuthStatus("Login successful. Syncing...");
  await syncFromCloud();
  toggleAuthPanel(false);
}

async function logoutUser() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    alert(error.message);
    return;
  }

  currentUser = null;
  updateAuthUI();
}

async function pushAllLocalEntriesToCloud() {
  if (!supabaseClient || !currentUser) return;

  const rows = entries.map((entry) => entryToDbRow(entry, currentUser.id));

  if (!rows.length) return;

  const { error } = await supabaseClient
    .from("bet_entries")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error(error);
    throw error;
  }
}

async function fetchCloudEntries() {
  if (!supabaseClient || !currentUser) return [];

  const { data, error } = await supabaseClient
    .from("bet_entries")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("match_date", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []).map(dbRowToEntry);
}

async function syncFromCloud() {
  if (!supabaseClient || !currentUser || isSyncing) return;

  try {
    isSyncing = true;
    setAuthStatus("Syncing with cloud...");

    const remoteEntries = await fetchCloudEntries();
    const merged = mergeEntries(remoteEntries, entries);

    entries = merged;
    saveEntries();
    renderAll();

    await pushAllLocalEntriesToCloud();

    const freshRemote = await fetchCloudEntries();
    entries = sortEntriesByDateDesc(freshRemote);
    saveEntries();
    renderAll();

    setAuthStatus(`Synced successfully. Logged in as ${currentUser.email || "user"}.`);
  } catch (err) {
    console.error(err);
    setAuthStatus("Cloud sync failed. Το local ιστορικό παραμένει ασφαλές στη συσκευή.");
  } finally {
    isSyncing = false;
  }
}

async function saveEntryToCloud(entry) {
  if (!supabaseClient || !currentUser) return;

  const row = entryToDbRow(entry, currentUser.id);

  const { error } = await supabaseClient
    .from("bet_entries")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error(error);
    throw error;
  }
}

async function deleteEntryFromCloud(id) {
  if (!supabaseClient || !currentUser) return;

  const { error } = await supabaseClient
    .from("bet_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) {
    console.error(error);
    throw error;
  }
}

async function addOrUpdateEntry(event) {
  event.preventDefault();

  if (!matchName?.value.trim()) {
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

  entries = sortEntriesByDateDesc(entries.map(normalizeEntry));
  saveEntries();
  renderAll();

  try {
    if (currentUser) {
      await saveEntryToCloud(candidate);
      await syncFromCloud();
    }
  } catch {
    alert("Η καταχώριση σώθηκε τοπικά, αλλά απέτυχε το cloud sync.");
  }

  resetForm();
  switchSection("history");
}

async function deleteEntry(id) {
  const confirmed = confirm("Να διαγραφεί αυτή η καταχώριση;");
  if (!confirmed) return;

  entries = entries.filter(item => item.id !== id);
  expandedEntryIds.delete(id);

  if (currentEditId === id) {
    resetForm();
  }

  saveEntries();
  renderAll();

  try {
    if (currentUser) {
      await deleteEntryFromCloud(id);
      await syncFromCloud();
    }
  } catch {
    alert("Η διαγραφή έγινε τοπικά, αλλά απέτυχε το cloud sync.");
  }
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
    "BestCaseOutcome",
    "BestCasePL",
    "WorstCaseOutcome",
    "WorstCasePL",
    "Notes"
  ];

  const rows = [];

  entries.map(normalizeEntry).forEach(entry => {
    (entry.bookmakers || []).forEach(bm => {
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
          entry.bestCase?.outcome || "",
          entry.bestCase?.pl || 0,
          entry.worstCase?.outcome || "",
          entry.worstCase?.pl || 0,
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

async function clearAllEntries() {
  const confirmed = confirm("Σίγουρα θέλεις να διαγράψεις όλες τις καταχωρίσεις;");
  if (!confirmed) return;

  const ids = entries.map((item) => item.id);

  entries = [];
  expandedEntryIds.clear();
  resetForm();
  saveEntries();
  renderAll();

  if (!currentUser || !supabaseClient || !ids.length) return;

  try {
    const { error } = await supabaseClient
      .from("bet_entries")
      .delete()
      .eq("user_id", currentUser.id)
      .in("id", ids);

    if (error) {
      console.error(error);
      alert("Το local clear έγινε, αλλά το cloud clear απέτυχε.");
      return;
    }

    await syncFromCloud();
  } catch {
    alert("Το local clear έγινε, αλλά το cloud clear απέτυχε.");
  }
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

  if (pageTitle) {
    pageTitle.textContent = titles[sectionId] || "Bet Tracker";
  }
}

function updateToolCalculator() {
  if (!calcMarket || !toolMarginOutput) return;

  const marketType = calcMarket.value;
  const o1 = parseNum(calcOdd1?.value);
  const ox = parseNum(calcOddX?.value);
  const o2 = parseNum(calcOdd2?.value);

  const margin = calculateMargin(marketType, o1, ox, o2);
  toolMarginOutput.textContent = formatPercent(margin);

  document.querySelectorAll(".calc-x-field").forEach(el => {
    el.style.display = marketType === "1X2" ? "flex" : "none";
  });

  if (marketType !== "1X2" && calcOddX) {
    calcOddX.value = "";
  }
}

function bindDynamicBookmakerInputs() {
  if (!bookmakersGrid) return;
  bookmakersGrid.addEventListener("input", updatePreview);
  bookmakersGrid.addEventListener("change", updatePreview);
}

navButtons.forEach((btn) => {
  if (!btn) return;
  btn.addEventListener("click", () => {
    switchSection(btn.dataset.section);
  });
});

if (market) {
  market.addEventListener("change", updatePreview);
}

if (result) {
  result.addEventListener("change", updatePreview);
}

if (betForm) {
  betForm.addEventListener("submit", addOrUpdateEntry);
}

if (resetFormBtn) {
  resetFormBtn.addEventListener("click", resetForm);
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", resetForm);
}

if (filterSport) {
  filterSport.addEventListener("change", renderHistory);
}

if (filterMarket) {
  filterMarket.addEventListener("change", renderHistory);
}

if (searchMatch) {
  searchMatch.addEventListener("input", renderHistory);
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", exportCSV);
}

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", clearAllEntries);
}

[calcMarket, calcOdd1, calcOddX, calcOdd2].forEach((el) => {
  if (!el) return;
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

if (authToggleBtn) {
  authToggleBtn.addEventListener("click", () => {
    toggleAuthPanel();
  });
}

if (authCloseBtn) {
  authCloseBtn.addEventListener("click", () => {
    toggleAuthPanel(false);
  });
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.classList.remove("hidden");
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add("hidden");
  });
}

function initAuthActions() {
  if (authLoginBtn) {
    authLoginBtn.addEventListener("click", loginWithEmail);
  }

  if (authSignupBtn) {
    authSignupBtn.addEventListener("click", signUpWithEmail);
  }

  if (authLogoutBtn) {
    authLogoutBtn.addEventListener("click", logoutUser);
  }

  if (authSyncBtn) {
    authSyncBtn.addEventListener("click", async () => {
      if (!currentUser) {
        alert("Κάνε login πρώτα.");
        return;
      }
      await syncFromCloud();
    });
  }
}

async function init() {
  try {
    createBookmakerCards();
    bindDynamicBookmakerInputs();
    loadEntries();
    resetForm();
    updateToolCalculator();
    renderAll();
    initAuthActions();
    await initSupabase();
    updateAuthUI();
  } catch (err) {
    console.error("APP INIT ERROR:", err);
    alert("Υπάρχει JavaScript error στο app. Άνοιξε console και δες το APP INIT ERROR.");
  }
}

init();
