const STORAGE_KEY = "bet_tracker_entries_v1";

let entries = [];
let deferredPrompt = null;

const navButtons = document.querySelectorAll(".nav-btn");
const sections = document.querySelectorAll(".page-section");
const pageTitle = document.getElementById("pageTitle");

const betForm = document.getElementById("betForm");
const matchDate = document.getElementById("matchDate");
const sport = document.getElementById("sport");
const market = document.getElementById("market");
const matchName = document.getElementById("matchName");
const odd1 = document.getElementById("odd1");
const oddX = document.getElementById("oddX");
const odd2 = document.getElementById("odd2");
const stake1 = document.getElementById("stake1");
const stakeX = document.getElementById("stakeX");
const stake2 = document.getElementById("stake2");
const result = document.getElementById("result");
const notes = document.getElementById("notes");

const previewStake = document.getElementById("previewStake");
const previewMargin = document.getElementById("previewMargin");
const previewReturn1 = document.getElementById("previewReturn1");
const previewReturnX = document.getElementById("previewReturnX");
const previewReturn2 = document.getElementById("previewReturn2");
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

const exportCsvBtn = document.getElementById("exportCsvBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const resetFormBtn = document.getElementById("resetFormBtn");
const installBtn = document.getElementById("installBtn");

const calcMarket = document.getElementById("calcMarket");
const calcOdd1 = document.getElementById("calcOdd1");
const calcOddX = document.getElementById("calcOddX");
const calcOdd2 = document.getElementById("calcOdd2");
const toolMarginOutput = document.getElementById("toolMarginOutput");

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

function calculateReturns(marketType, s1, sx, s2, o1, ox, o2) {
  return {
    return1: s1 * o1,
    returnX: marketType === "1X2" ? sx * ox : 0,
    return2: s2 * o2
  };
}

function calculateActualReturn(marketType, selectedResult, returnsObj) {
  if (!selectedResult) return 0;
  if (selectedResult === "1") return returnsObj.return1;
  if (selectedResult === "X" && marketType === "1X2") return returnsObj.returnX;
  if (selectedResult === "2") return returnsObj.return2;
  return 0;
}

function getTotalStake(s1, sx, s2) {
  return s1 + sx + s2;
}

function getSportLabel(value) {
  return value === "football" ? "Ποδόσφαιρο" : "Μπάσκετ";
}

function getOddsLabel(entry) {
  if (entry.market === "1X2") {
    return `1: ${entry.odd1} | X: ${entry.oddX} | 2: ${entry.odd2}`;
  }
  return `1: ${entry.odd1} | 2: ${entry.odd2}`;
}

function getStakesLabel(entry) {
  if (entry.market === "1X2") {
    return `1: ${formatCurrency(entry.stake1)} | X: ${formatCurrency(entry.stakeX)} | 2: ${formatCurrency(entry.stake2)}`;
  }
  return `1: ${formatCurrency(entry.stake1)} | 2: ${formatCurrency(entry.stake2)}`;
}

function updateMarketFields() {
  const is1X2 = market.value === "1X2";

  document.querySelectorAll(".x-field").forEach(el => {
    el.style.display = is1X2 ? "flex" : "none";
  });

  document.querySelectorAll(".x-field-card").forEach(el => {
    el.style.display = is1X2 ? "block" : "none";
  });

  if (!is1X2) {
    oddX.value = "";
    stakeX.value = "0";
    if (result.value === "X") result.value = "";
  }
}

function updatePreview() {
  const marketType = market.value;
  const o1 = parseNum(odd1.value);
  const ox = parseNum(oddX.value);
  const o2 = parseNum(odd2.value);
  const s1 = parseNum(stake1.value);
  const sx = parseNum(stakeX.value);
  const s2 = parseNum(stake2.value);

  const total = getTotalStake(s1, sx, s2);
  const margin = calculateMargin(marketType, o1, ox, o2);
  const returnsObj = calculateReturns(marketType, s1, sx, s2, o1, ox, o2);
  const actualReturn = calculateActualReturn(marketType, result.value, returnsObj);
  const pl = actualReturn - total;

  previewStake.textContent = formatCurrency(total);
  previewMargin.textContent = formatPercent(margin);
  previewReturn1.textContent = formatCurrency(returnsObj.return1);
  previewReturnX.textContent = formatCurrency(returnsObj.returnX);
  previewReturn2.textContent = formatCurrency(returnsObj.return2);
  previewPL.textContent = formatCurrency(pl);

  previewPL.className = "";
  if (pl > 0) previewPL.classList.add("positive");
  else if (pl < 0) previewPL.classList.add("negative");
  else previewPL.classList.add("neutral");
}

function resetForm() {
  betForm.reset();
  matchDate.value = new Date().toISOString().split("T")[0];
  sport.value = "football";
  market.value = "1X2";
  stake1.value = "0";
  stakeX.value = "0";
  stake2.value = "0";
  updateMarketFields();
  updatePreview();
}

function renderStats() {
  const totalEntries = entries.length;
  const sumStake = entries.reduce((acc, item) => acc + Number(item.totalStake || 0), 0);
  const sumReturn = entries.reduce((acc, item) => acc + Number(item.actualReturn || 0), 0);
  const sumPL = entries.reduce((acc, item) => acc + Number(item.profitLoss || 0), 0);
  const marginAverage = totalEntries
    ? entries.reduce((acc, item) => acc + Number(item.margin || 0), 0) / totalEntries
    : 0;
  const roi = sumStake ? (sumPL / sumStake) * 100 : 0;

  totalMatches.textContent = totalEntries;
  totalStake.textContent = formatCurrency(sumStake);
  totalReturn.textContent = formatCurrency(sumReturn);
  totalPL.textContent = formatCurrency(sumPL);
  avgMargin.textContent = formatPercent(marginAverage);
  roiValue.textContent = formatPercent(roi);

  totalPL.className = "";
  roiValue.className = "";

  if (sumPL > 0) totalPL.classList.add("positive");
  else if (sumPL < 0) totalPL.classList.add("negative");
  else totalPL.classList.add("neutral");

  if (roi > 0) roiValue.classList.add("positive");
  else if (roi < 0) roiValue.classList.add("negative");
  else roiValue.classList.add("neutral");
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
      <p>Stake: ${formatCurrency(item.totalStake)} | Margin: ${formatPercent(item.margin)} | P/L: ${formatCurrency(item.profitLoss)}</p>
    </div>
  `).join("");
}

function getFilteredEntries() {
  const selectedSport = filterSport.value;
  const selectedMarket = filterMarket.value;

  return entries.filter(item => {
    const sportMatch = selectedSport === "all" || item.sport === selectedSport;
    const marketMatch = selectedMarket === "all" || item.market === selectedMarket;
    return sportMatch && marketMatch;
  });
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

  historyTableBody.innerHTML = filtered
    .slice()
    .reverse()
    .map(item => `
      <tr>
        <td>${item.matchDate}</td>
        <td>${getSportLabel(item.sport)}</td>
        <td>
          <strong>${item.matchName}</strong>
          ${item.notes ? `<div class="muted">${item.notes}</div>` : ""}
        </td>
        <td>${item.market}</td>
        <td>${getOddsLabel(item)}</td>
        <td>${getStakesLabel(item)}</td>
        <td>${formatCurrency(item.totalStake)}</td>
        <td>${formatPercent(item.margin)}</td>
        <td>${item.result || "-"}</td>
        <td>${formatCurrency(item.actualReturn)}</td>
        <td class="${item.profitLoss > 0 ? "positive" : item.profitLoss < 0 ? "negative" : "neutral"}">
          ${formatCurrency(item.profitLoss)}
        </td>
        <td>
          <div class="row-actions">
            <button class="small-btn delete" onclick="deleteEntry('${item.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `)
    .join("");
}

function renderAll() {
  renderStats();
  renderRecentEntries();
  renderHistory();
}

function addEntry(event) {
  event.preventDefault();

  const marketType = market.value;
  const o1 = parseNum(odd1.value);
  const ox = parseNum(oddX.value);
  const o2 = parseNum(odd2.value);
  const s1 = parseNum(stake1.value);
  const sx = parseNum(stakeX.value);
  const s2 = parseNum(stake2.value);

  if (!matchName.value.trim()) {
    alert("Συμπλήρωσε όνομα αγώνα.");
    return;
  }

  if (!o1 || !o2 || (marketType === "1X2" && !ox)) {
    alert("Συμπλήρωσε σωστά τις αποδόσεις.");
    return;
  }

  const total = getTotalStake(s1, sx, s2);
  const margin = calculateMargin(marketType, o1, ox, o2);
  const returnsObj = calculateReturns(marketType, s1, sx, s2, o1, ox, o2);
  const actualReturn = calculateActualReturn(marketType, result.value, returnsObj);
  const pl = actualReturn - total;

  const entry = {
    id: crypto.randomUUID(),
    matchDate: matchDate.value,
    sport: sport.value,
    market: marketType,
    matchName: matchName.value.trim(),
    odd1: o1,
    oddX: marketType === "1X2" ? ox : 0,
    odd2: o2,
    stake1: s1,
    stakeX: marketType === "1X2" ? sx : 0,
    stake2: s2,
    totalStake: total,
    margin,
    return1: returnsObj.return1,
    returnX: returnsObj.returnX,
    return2: returnsObj.return2,
    result: result.value,
    actualReturn,
    profitLoss: pl,
    notes: notes.value.trim()
  };

  entries.push(entry);
  saveEntries();
  renderAll();
  resetForm();
  switchSection("history");
}

function deleteEntry(id) {
  const confirmed = confirm("Να διαγραφεί αυτή η καταχώριση;");
  if (!confirmed) return;

  entries = entries.filter(item => item.id !== id);
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
    "Date", "Sport", "Match", "Market",
    "Odd1", "OddX", "Odd2",
    "Stake1", "StakeX", "Stake2",
    "TotalStake", "MarginPercent",
    "Return1", "ReturnX", "Return2",
    "Result", "ActualReturn", "ProfitLoss", "Notes"
  ];

  const rows = entries.map(item => [
    item.matchDate,
    item.sport,
    `"${item.matchName.replace(/"/g, '""')}"`,
    item.market,
    item.odd1,
    item.oddX,
    item.odd2,
    item.stake1,
    item.stakeX,
    item.stake2,
    item.totalStake,
    item.margin,
    item.return1,
    item.returnX,
    item.return2,
    item.result,
    item.actualReturn,
    item.profitLoss,
    `"${(item.notes || "").replace(/"/g, '""')}"`
  ]);

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

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    switchSection(btn.dataset.section);
  });
});

[
  market, odd1, oddX, odd2, stake1, stakeX, stake2, result
].forEach(el => {
  el.addEventListener("input", () => {
    updateMarketFields();
    updatePreview();
  });
  el.addEventListener("change", () => {
    updateMarketFields();
    updatePreview();
  });
});

betForm.addEventListener("submit", addEntry);
resetFormBtn.addEventListener("click", resetForm);
filterSport.addEventListener("change", renderHistory);
filterMarket.addEventListener("change", renderHistory);
exportCsvBtn.addEventListener("click", exportCSV);
clearAllBtn.addEventListener("click", clearAllEntries);

[calcMarket, calcOdd1, calcOddX, calcOdd2].forEach(el => {
  el.addEventListener("input", updateToolCalculator);
  el.addEventListener("change", updateToolCalculator);
});

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

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.error("Service Worker registration failed:", err);
      });
    });
  }

function init() {
  loadEntries();
  resetForm();
  updateToolCalculator();
  renderAll();
}

init();