import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Profile slider
profileIcon.onclick = () => userSlider.classList.toggle("active");

// Tips rotation
const tips = [
  "💡 Tip: Reuse laundry water for floor cleaning.",
  "🌱 Tip: Use greywater for gardening.",
  "🚿 Tip: Collect shower warm-up water.",
];
let i = 0;
setInterval(() => {
  adviceBar.textContent = tips[i++ % tips.length];
}, 20000);

// FLOW RATE
onValue(ref(db, "sensors/flowRate"), snap => {
  const v = snap.val() || 0;
  flowRate.textContent = v + " L/sec";
  flowStatus.textContent = v > 5 ? "High" : "Normal";
  flowStatus.className = "badge " + (v > 5 ? "badge-high" : "badge-normal");
});

// TANK LEVEL
onValue(ref(db, "sensors/tankLevel"), snap => {
  const v = snap.val() || 0;
  tankLevel.textContent = v + "%";
  progressCircle.style.strokeDashoffset = 314 - (v / 100) * 314;

  if (v < 20) alertBar.classList.remove("hidden");
  else alertBar.classList.add("hidden");
});

// TOTAL SAVED WATER (✔ CORRECT KEY)
onValue(ref(db, "sensors/totalSavedWater"), snap => {
  const v = snap.val() || 0;
  waterSaved.textContent = v + " Litres";
  progressBar.style.width = Math.min((v / 500) * 100, 100) + "%";
});