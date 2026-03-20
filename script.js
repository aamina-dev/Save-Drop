import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdcE6ASFSi8ZHn82q741xUWUO1cp7tK3g",
  authDomain: "save-drop.firebaseapp.com",
  databaseURL: "https://save-drop-default-rtdb.firebaseio.com",
  projectId: "save-drop",
  storageBucket: "save-drop.firebasestorage.app",
  messagingSenderId: "1051331432686",
  appId: "1:1051331432686:web:7f97c526d655b37419e3ff"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);
const auth = getAuth(app);

// ── DOM elements ───────────────────────────────────────────────
const profileIcon    = document.getElementById("profileIcon");
const userSlider     = document.getElementById("userSlider");
const sliderClose    = document.getElementById("sliderClose");
const flowRateEl     = document.getElementById("flowRate");
const flowStatusEl   = document.getElementById("flowStatus");
const tankLevelEl    = document.getElementById("tankLevel");
const tankStatusEl   = document.getElementById("tankStatus");
const progressCircle = document.getElementById("progressCircle");
const waterSavedEl   = document.getElementById("waterSaved");
const progressBar    = document.getElementById("progressBar");
const alertLow       = document.getElementById("alertLow");
const alertFull      = document.getElementById("alertFull");
const lastUpdatedEl  = document.getElementById("lastUpdated");
const historyBody    = document.getElementById("historyBody");
const resetWaterBtn  = document.getElementById("resetWaterBtn");

// Profile slider
profileIcon.onclick = () => userSlider.classList.toggle("active");
sliderClose.onclick  = () => userSlider.classList.remove("active");

// Reset Total Water Saved
if (resetWaterBtn) {
  resetWaterBtn.onclick = async () => {
    if (!confirm("Reset Total Water Saved to 0?")) return;
    try {
      await set(ref(db, "sensors/totalSavedWater"), 0);
      waterSavedEl.textContent = "0 Litres";
      userSlider.classList.remove("active");
    } catch (err) {
      alert("Reset failed: " + err.message);
    }
  };
}
// Close on backdrop click
document.addEventListener("click", e => {
  if (userSlider.classList.contains("active") &&
      !userSlider.contains(e.target) &&
      !profileIcon.contains(e.target)) {
    userSlider.classList.remove("active");
  }
});

// ── Chart helpers ──────────────────────────────────────────────
const MAX_BARS     = 8;
const savedHistory = [];

function timeLabel() {
  const d = new Date();
  return d.getHours().toString().padStart(2,"0") + ":" +
         d.getMinutes().toString().padStart(2,"0") + ":" +
         d.getSeconds().toString().padStart(2,"0");
}

function renderChart(history, chartId, xAxisId, yAxisId, liveValId, unit, barClass) {
  const chart  = document.getElementById(chartId);
  const xAxis  = document.getElementById(xAxisId);
  const yAxis  = document.getElementById(yAxisId);
  const liveEl = document.getElementById(liveValId);
  if (!chart) return;

  const vals = history.map(h => h.v);
  const maxV = Math.max(...vals, 1);
  const latest = history[history.length - 1];
  if (liveEl && latest) liveEl.textContent = latest.v + " " + unit;

  // Y-axis ticks (4 gridlines: 0, 25%, 50%, 75%, 100%)
  yAxis.innerHTML = "";
  for (let t = 4; t >= 0; t--) {
    const tick = document.createElement("span");
    tick.className = "y-tick";
    tick.textContent = Math.round((maxV * t) / 4 * 10) / 10;
    yAxis.appendChild(tick);
  }

  // Bars
  chart.innerHTML = "";
  history.forEach(item => {
    const pct    = maxV > 0 ? (item.v / maxV) * 100 : 0;
    const col    = document.createElement("div");
    col.className = "bar-col";

    const bar    = document.createElement("div");
    bar.className = "bar " + barClass;
    bar.style.height = "0%";

    const tip    = document.createElement("span");
    tip.className = "bar-tooltip";
    tip.textContent = item.v + " " + unit;
    bar.appendChild(tip);
    col.appendChild(bar);
    chart.appendChild(col);

    // Animate grow-in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { bar.style.height = pct + "%"; });
    });
  });

  // X-axis labels
  xAxis.innerHTML = "";
  history.forEach(item => {
    const tick = document.createElement("span");
    tick.className = "x-tick";
    tick.textContent = item.t;
    xAxis.appendChild(tick);
  });
}

// ── FIREBASE LISTENERS (Only attach when logged in) ────────────
let listenersAttached = false;
onAuthStateChanged(auth, user => {
  if (!user || listenersAttached) return;
  listenersAttached = true;

// ── FLOW RATE ──────────────────────────────────────────────────
const liveDot = document.querySelector(".live-dot");
let connectionTimeout;

function updateConnectionStatus() {
  if (liveDot) {
    liveDot.classList.remove("offline");
    liveDot.title = "Device is online";
  }
  
  clearTimeout(connectionTimeout);
  
  // ESP code updates every 5 seconds. If no update for 6s, mark offline.
  connectionTimeout = setTimeout(() => {
    if (liveDot) {
      liveDot.classList.add("offline");
      liveDot.title = "Device is offline";
    }
  }, 6000);
}

onValue(ref(db, "sensors/flowRate"), snap => {
  updateConnectionStatus();
  const v = parseFloat((snap.val() || 0).toFixed(2));
  flowRateEl.textContent   = v + " L/min";
  const isHigh             = v > 5;
  flowStatusEl.textContent = isHigh ? "High" : "Normal";
  flowStatusEl.className   = "badge " + (isHigh ? "badge-high" : "badge-normal");
});

// ── TANK LEVEL ─────────────────────────────────────────────────
onValue(ref(db, "sensors/tankLevel"), snap => {
  const v = parseFloat((snap.val() || 0).toFixed(2));
  tankLevelEl.textContent = v + "%";
  progressCircle.style.strokeDashoffset = 326.7 - (v / 100) * 326.7;

  // Tank status badge
  let statusLabel, statusClass;
  if      (v < 10)  { statusLabel = "Critical";    statusClass = "badge-high";    }
  else if (v < 30)  { statusLabel = "Low";          statusClass = "badge-high";    }
  else if (v < 60)  { statusLabel = "Medium";       statusClass = "badge-medium";  }
  else if (v < 90)  { statusLabel = "Good";         statusClass = "badge-normal";  }
  else              { statusLabel = "Almost Full";  statusClass = "badge-full";    }
  tankStatusEl.textContent = statusLabel;
  tankStatusEl.className   = "badge " + statusClass;

  // Alerts
  if (v < 10) alertLow.classList.remove("hidden");
  else        alertLow.classList.add("hidden");
  if (v >= 90) alertFull.classList.remove("hidden");
  else         alertFull.classList.add("hidden");
});

// ── TOTAL SAVED WATER ──────────────────────────────────────────
const TANK_CAPACITY_L = 0.75; // 750 ml tanker

// Stores all log entries for re-filtering by time frame
let allLogEntries    = [];
let currentTimeFrame = 'today';
let liveWaterSaved   = 0; // cached from sensors/totalSavedWater

window.setTimeFrame = function(tf, btn) {
  currentTimeFrame = tf;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyTimeFrame();
};

function getWaterSaved(e) {
  const v = e.volume || e.totalLitres || e.totalSavedWater ||
            e.waterSaved || e.savedWater || e.total_saved ||
            e.water_saved || e.saved || 0;
  // Strictly use the value stored in the log entry — never fall back to live sensor
  return parseFloat(Number(v).toFixed(2));
}

function applyTimeFrame() {
  const now  = new Date();
  const todayKey = now.getFullYear() + "-" +
                   String(now.getMonth() + 1).padStart(2, "0") + "-" +
                   String(now.getDate()).padStart(2, "0");
  const weekAgoTs = (Date.now() / 1000) - 7 * 86400;

  let filtered = allLogEntries;
  if (currentTimeFrame === 'today') {
    filtered = allLogEntries.filter(e => {
      if (!e.timestamp) return false;
      const d = new Date(e.timestamp * 1000);
      const k = d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0");
      return k === todayKey;
    });
  } else if (currentTimeFrame === 'week') {
    filtered = allLogEntries.filter(e => e.timestamp && e.timestamp >= weekAgoTs);
  }

  // ── Rebuild chart only — card is updated by sensors/totalSavedWater listener ──
  const dayMap = {};
  filtered.forEach(e => {
    if (!e.timestamp) return;
    const d   = new Date(e.timestamp * 1000);
    const key = d.getFullYear() + "-" +
                String(d.getMonth() + 1).padStart(2, "0") + "-" +
                String(d.getDate()).padStart(2, "0");
    const val = getWaterSaved(e);
    if (!dayMap[key] || val > dayMap[key].v) {
      dayMap[key] = {
        v: val,
        t: currentTimeFrame === 'today'
          ? new Date(e.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
          : d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
      };
    }
  });
  const chartData = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([, v]) => v);
  renderChart(chartData, "savedChart", "savedXAxis", "savedYAxis", "savedChartVal", "L", "bar-saved");
}

onValue(ref(db, "sensors/totalSavedWater"), snap => {
  liveWaterSaved = parseFloat((snap.val() || 0).toFixed(2));
  waterSavedEl.textContent = liveWaterSaved + " Litres";
  progressBar.style.width  = Math.min((liveWaterSaved / TANK_CAPACITY_L) * 100, 100) + "%";
  // Do NOT re-render chart here — chart must use only stored log values
});

// ── LOGS: history table (last 10 individual readings) ─────────
onValue(query(ref(db, "logs"), limitToLast(10)), snap => {
  const data = snap.val();
  if (!data) {
    if (historyBody) historyBody.innerHTML = '<tr><td colspan="4" class="history-empty">No data yet.</td></tr>';
    return;
  }
  const entries = Object.values(data).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // ── Update "Last updated" from the most recent log entry ──
  const latest = entries[entries.length - 1];
  if (lastUpdatedEl && latest && latest.timestamp) {
    lastUpdatedEl.textContent = "Last updated: " + new Date(latest.timestamp * 1000).toLocaleString();
  }
  if (historyBody) {
    historyBody.innerHTML = [...entries].reverse().map(e => {
      const ts = e.timestamp ? new Date(e.timestamp * 1000).toLocaleString() : "—";
      const fr = (e.flowRate   || e.flow_rate  || e.flow        || 0).toFixed(2);
      const tl = (e.tankLevel  || e.tank_level || e.level       || 0).toFixed(2);
      // Strictly use the value stored in the log entry
      const wsRaw = e.volume || e.totalLitres || e.totalSavedWater ||
                    e.waterSaved || e.savedWater || e.total_saved ||
                    e.water_saved || e.saved || 0;
      const ws = Number(wsRaw).toFixed(2);
      return `<tr>
        <td>${ts}</td>
        <td>${fr} <span class="unit">L/min</span></td>
        <td>${tl} <span class="unit">%</span></td>
        <td>${ws} <span class="unit">L</span></td>
      </tr>`;
    }).join("");
  }
});

// ── LOGS: chart + card value — full history for time-frame filter ─
onValue(query(ref(db, "logs"), limitToLast(3000)), snap => {
  const data = snap.val();
  if (!data) return;
  allLogEntries = Object.values(data).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  applyTimeFrame();
});

}); // End of onAuthStateChanged

// ── LOGS: daily bar chart ─── driven by applyTimeFrame() above ─