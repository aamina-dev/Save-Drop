// =========================================================================
// SAVE-DROP: DASHBOARD CORE LOGIC (script.js)
// Project: IoT-based Water Consumption & Tank Level Monitor
// Author: Ansari Aamina
// 
// This script handles:
// 1. Real-time Firebase Synchronization
// 2. Dynamic UI Updates (Sensors, Badges, Charts)
// 3. Historical Data Filtering & CSV Export
// =========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, query, limitToLast, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- Cloud Configuration ---
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
const db = getDatabase(app);
const auth = getAuth(app);

// --- Dashboard UI Selectors ---
const profileIcon = document.getElementById("profileIcon");
const userSlider = document.getElementById("userSlider");
const sliderClose = document.getElementById("sliderClose");
const flowRateEl = document.getElementById("flowRate");
const flowStatusEl = document.getElementById("flowStatus");
const tankLevelEl = document.getElementById("tankLevel");
const tankStatusEl = document.getElementById("tankStatus");
const progressCircle = document.getElementById("progressCircle");
const totalWaterEl = document.getElementById("totalWater");
const usageInsightEl = document.getElementById("usageInsight");
const alertLow = document.getElementById("alertLow");
const alertFull = document.getElementById("alertFull");
const lastUpdatedEl = document.getElementById("lastUpdated");
const historyBody = document.getElementById("historyBody");
const resetWaterBtn = document.getElementById("resetWaterBtn");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const estimatedCostEl = document.getElementById("estimatedCost");
const costStatusEl = document.getElementById("costStatus");

// --- System State ---
let allLogEntries = [];        // Stores permanent historical records from cloud
let currentTimeFrame = 'today'; // Controls current chart view (Today/Week/All)
let liveWaterUsed = 0;         // Latest consumption value from live sensor

const WATER_RATE_PER_LITRE = 0.15; // Set your water rate here (e.g. 0.15 Rs per Litre)

/**
 * HELPER: Extracts water consumption from any valid data key
 * (Supports legacy keys like 'waterSaved' for full backward compatibility)
 */
function getWaterUsed(e) {
  const v = e.totalWater || e.volume || e.totalLitres || e.totalSavedWater ||
    e.waterSaved || e.savedWater || e.total_saved ||
    e.water_saved || e.saved || 0;
  return parseFloat(Number(v).toFixed(2));
}

// --- Navigation & Profile Logic ---
profileIcon.onclick = () => userSlider.classList.toggle("active");
sliderClose.onclick = () => userSlider.classList.remove("active");

/* DASHBOARD: Reset Consumption Counter */
if (resetWaterBtn) {
  resetWaterBtn.onclick = async () => {
    if (!confirm("Are you sure you want to reset the Total Water meter to 0?")) return;
    try {
      await set(ref(db, "sensors/totalWater"), 0);
      totalWaterEl.textContent = "0 Litres";
      userSlider.classList.remove("active");
    } catch (err) {
      alert("Error resetting meter: " + err.message);
    }
  };
}

/* ANALYTICS: Export History to CSV */
if (downloadCsvBtn) {
  downloadCsvBtn.onclick = () => {
    // A) Define column headers
    let csvContent = "Date/Time,Flow Rate (L/min),Tank Level (%),Total Water (L)\n";

    // B) Respect the current UI filter (Today/Week/All)
    const now = new Date();
    const todayKey = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");
    const weekAgoTs = (Date.now() / 1000) - 7 * 86400;

    let exportData = allLogEntries;
    if (currentTimeFrame === 'today') {
      exportData = allLogEntries.filter(e => {
        if (!e.timestamp) return false;
        const d = new Date(e.timestamp * 1000);
        const k = d.getFullYear() + "-" +
          String(d.getMonth() + 1).padStart(2, "0") + "-" +
          String(d.getDate()).padStart(2, "0");
        return k === todayKey;
      });
    } else if (currentTimeFrame === 'week') {
      exportData = allLogEntries.filter(e => e.timestamp && e.timestamp >= weekAgoTs);
    }

    // C) Format data rows (Reverse order: Newest First)
    [...exportData].reverse().forEach(e => {
      const ts = e.timestamp ? new Date(e.timestamp * 1000).toLocaleString().replace(/,/g, "") : "—";
      const fr = (e.flowRate || 0).toFixed(2);
      const tl = (e.tankLevel || 0).toFixed(2);
      const ws = getWaterUsed(e).toFixed(2);
      csvContent += `${ts},${fr},${tl},${ws}\n`;
    });

    // D) Execute browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `SaveDrop_Report_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
}

/**
 * UI ENGINE: Renders the custom Animated Bar Chart
 */
function renderChart(history, chartId, xAxisId, yAxisId, liveValId, unit, barClass) {
  const chart = document.getElementById(chartId);
  const xAxis = document.getElementById(xAxisId);
  const yAxis = document.getElementById(yAxisId);
  if (!chart) return;

  const vals = history.map(h => h.v);
  const maxV = Math.max(...vals, 1);

  // 1. Generate Y-Axis Ticks (Scale: 0 to Max)
  yAxis.innerHTML = "";
  for (let t = 4; t >= 0; t--) {
    const tick = document.createElement("span");
    tick.className = "y-tick";
    tick.textContent = (maxV * t / 4).toFixed(1);
    yAxis.appendChild(tick);
  }

  // 2. Generate Bars with Tooltips
  chart.innerHTML = "";
  history.forEach(item => {
    const pct = (item.v / maxV) * 100;
    const col = document.createElement("div");
    col.className = "bar-col";

    const bar = document.createElement("div");
    bar.className = "bar " + barClass;
    bar.style.height = "0%"; // Start at 0 for animation

    const tip = document.createElement("span");
    tip.className = "bar-tooltip";
    tip.textContent = item.v.toFixed(2) + " " + unit;
    
    bar.appendChild(tip);
    col.appendChild(bar);
    chart.appendChild(col);

    // Trigger growth animation
    requestAnimationFrame(() => {
      setTimeout(() => { bar.style.height = pct + "%"; }, 50);
    });
  });

  // 3. Generate X-Axis Labels (Timeline)
  xAxis.innerHTML = "";
  history.forEach(item => {
    const tick = document.createElement("span");
    tick.className = "x-tick";
    tick.textContent = item.t;
    xAxis.appendChild(tick);
  });
}

// --- CLOUD EVENT LISTENERS ---
let listenersAttached = false;
onAuthStateChanged(auth, user => {
  if (!user || listenersAttached) return;
  listenersAttached = true;

  const liveDot = document.querySelector(".live-dot");
  let connectionTimeout;

  // Watchdog timer: If no data arrives for 6s, Mark system as "Offline"
  function updateConnectionStatus() {
    if (liveDot) liveDot.classList.remove("offline");
    clearTimeout(connectionTimeout);
    connectionTimeout = setTimeout(() => {
      if (liveDot) liveDot.classList.add("offline");
    }, 6000);
  }

  /* CLOUD: Listen for Flow Rate changes */
  onValue(ref(db, "sensors/flowRate"), snap => {
    updateConnectionStatus();
    const v = (snap.val() || 0).toFixed(2);
    flowRateEl.innerHTML = `${v}<span class="unit">L/min</span>`;
    const isHigh = v > 5;
    flowStatusEl.textContent = isHigh ? "High" : "Normal";
    flowStatusEl.className = "badge " + (isHigh ? "badge-high" : "badge-normal");
  });

  /* CLOUD: Listen for Tank Level changes */
  onValue(ref(db, "sensors/tankLevel"), snap => {
    const v = parseFloat((snap.val() || 0).toFixed(1));
    tankLevelEl.textContent = v + "%";

    // Update SVG Circular Gauge
    progressCircle.style.strokeDashoffset = 326.7 - (v / 100) * 326.7;

    // Dynamic Level Badges & Safety Alerts
    let label, pClass;
    if (v < 10) { label = "Critical"; pClass = "badge-high"; alertLow.classList.remove("hidden"); }
    else if (v < 30) { label = "Low"; pClass = "badge-high"; alertLow.classList.add("hidden"); }
    else if (v < 60) { label = "Medium"; pClass = "badge-medium"; alertLow.classList.add("hidden"); }
    else if (v < 90) { label = "Good"; pClass = "badge-normal"; alertFull.classList.add("hidden"); }
    else { label = "Almost Full"; pClass = "badge-full"; alertFull.classList.remove("hidden"); }
    
    tankStatusEl.textContent = label;
    tankStatusEl.className = "badge " + pClass;
  });

  /* UI: Change Analytics Timeframe (Today/Week/All) */
  window.setTimeFrame = (tf, btn) => {
    currentTimeFrame = tf;
    document.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyTimeFrameFilter();
  };

  /**
   * DATA ENGINE: Groups and filters cloud logs based on selected timeframe
   */
  function applyTimeFrameFilter() {
    const now = new Date();
    const todayKey = now.toLocaleDateString();
    const weekAgoMs = Date.now() - 7 * 86400000;

    let filtered = allLogEntries;
    if (currentTimeFrame === 'today') {
      filtered = allLogEntries.filter(e => e.timestamp && (new Date(e.timestamp * 1000).toLocaleDateString() === todayKey));
    } else if (currentTimeFrame === 'week') {
      filtered = allLogEntries.filter(e => e.timestamp && (e.timestamp * 1000 >= weekAgoMs));
    }

    // Aggregate data for Chart Mapping
    const dayMap = {};
    filtered.forEach(e => {
      const d = new Date(e.timestamp * 1000);
      let label = (currentTimeFrame === 'today') ? "Today" : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const val = getWaterUsed(e);
      if (!dayMap[label] || val > dayMap[label]) dayMap[label] = val; // Latest total usage
    });

    const chartData = Object.entries(dayMap).map(([t, v]) => ({ t, v }));
    renderChart(chartData, "totalWaterChart", "totalWaterXAxis", "totalWaterYAxis", "totalWaterChartVal", "L", "bar-total");
  }

  /* CLOUD: Listen for Total Water Counter */
  onValue(ref(db, "sensors/totalWater"), snap => {
    const v = snap.val() || 0;
    liveWaterUsed = v;
    totalWaterEl.innerHTML = `${parseFloat(v).toFixed(2)}<span class="unit">L</span>`;

    // 1. Calculate Estimated Cost
    const cost = v * WATER_RATE_PER_LITRE;
    if (estimatedCostEl) {
      estimatedCostEl.innerHTML = `<span class="unit">₹</span>${cost.toFixed(2)}`;
    }

    // 2. Cost Budgeting Status
    if (costStatusEl) {
      if (cost < 5) {
        costStatusEl.innerHTML = "Within Budget";
        costStatusEl.className = "badge badge-normal";
      } else if (cost < 15) {
        costStatusEl.innerHTML = "Moderate Cost";
        costStatusEl.className = "badge badge-medium";
      } else {
        costStatusEl.innerHTML = "High Expense 💸";
        costStatusEl.className = "badge badge-high";
      }
    }

    // 3. Dynamic Consumption Insights (Professional Grade Feedback)
    if (usageInsightEl) {
      if (v < 2.0) { usageInsightEl.innerHTML = "Low usage 💧"; usageInsightEl.className = "badge badge-normal"; }
      else if (v < 5.0) { usageInsightEl.innerHTML = "Moderate usage 💧"; usageInsightEl.className = "badge badge-medium"; }
      else { usageInsightEl.innerHTML = "High usage ⚠️"; usageInsightEl.className = "badge badge-high"; }
    }
  });

  /* CLOUD: Listen for Entry History (Table View) */
  onValue(query(ref(db, "logs"), limitToLast(10)), snap => {
    const data = snap.val();
    if (!data) return;
    const entries = Object.values(data).sort((a, b) => b.timestamp - a.timestamp); // Sort Newest First

    if (lastUpdatedEl && entries[0]?.timestamp) {
      lastUpdatedEl.textContent = "Last sync: " + new Date(entries[0].timestamp * 1000).toLocaleString();
    }

    if (historyBody) {
      historyBody.innerHTML = entries.map(e => `
        <tr>
          <td>${new Date(e.timestamp * 1000).toLocaleTimeString()}</td>
          <td>${(e.flowRate || 0).toFixed(2)} <span class="unit">L/min</span></td>
          <td>${(e.tankLevel || 0).toFixed(1)} <span class="unit">%</span></td>
          <td>${getWaterUsed(e).toFixed(2)} <span class="unit">L</span></td>
        </tr>
      `).join("");
    }
  });

  /* CLOUD: Fetch Master Logs (Analytics Hub) */
  onValue(query(ref(db, "logs"), limitToLast(3000)), snap => {
    const data = snap.val();
    if (!data) return;
    allLogEntries = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
    applyTimeFrameFilter();
  });

}); // End Cloud Listener Scope