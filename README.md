# SaveDrop! 💧 Smart Water Monitoring System
**Final Year BSc IT Project**  
*Developed by: Ansari Aamina*  

---

## 🌟 Project Overview
**SaveDrop!** is an advanced Internet of Things (IoT) solution designed to provide real-time visibility into water consumption and storage. Beyond simple monitoring, the system integrates a **financial layer** to track estimated water costs and promote economic conservation. With a sleek Glassmorphism-style dashboard and a robust Firebase backend, SaveDrop! transforms raw sensor data into actionable insights for the modern home.

## 🚀 Key Features
*   **Real-Time Consumption Tracking**: Live monitoring of water flow rate (L/min) using the YF-S201 sensor.
*   **Tank Level Management**: High-precision ultrasonic tracking of overhead tank levels with automated safety alerts.
*   **Estimated Water Costing**: Built-in financial engine that calculates real-time spending based on consumption volume.
*   **Dynamic Budgeting Alerts**: Intelligent color-coded status badges (Within Budget, Moderate, High Expense) for financial awareness.
*   **Interactive Analytics Hub**: Graphical visualization of daily and weekly usage patterns with "Dual-Data" cost tooltips.
*   **Excel-Ready Reporting**: Professional CSV data export with dedicated cost columns and a structured usage summary section.
*   **Cloud-Synced Firmware**: ESP8266-based firmware with smart logging logic to optimize database storage and performance.

## 🛠️ Technological Stack
*   **Hardware Core**: NodeMCU (ESP8266), YF-S201 Flow Sensor, HC-SR04 Ultrasonic Sensor.
*   **Firmware Architecture**: Non-blocking C++ (Arduino IDE) with Firebase-ESP-Client integration.
*   **Frontend UI**: Modern Glassmorphism Design using HTML5, Vanilla CSS3, and JavaScript (ES6+).
*   **Backend & Security**: Firebase Realtime Database with robust Security Rules and Anonymous Authentication.
*   **Data Visualization**: Custom-built SVG-based animated charting engine.

## 📂 Folder Structure
*   `savedropf/` — The production-ready ESP8266 firmware (`savedrop.ino`).
*   `index.html` — The core analytical dashboard.
*   `login.html` — Secure gateway for authenticated access.
*   `style.css` — Modern UI/UX design system and glass components.
*   `script.js` — The "Brain" of the dashboard, handling Firebase sync and cost calculations.
*   `auth.js` — Secure user session management via Firebase Auth.

---

### 🛡️ How It Works
1.  **Sensing**: The ESP8266 collects data pulses from the flow sensor and measures tank depth via ultrasonic waves.
2.  **Processing**: The firmware calculates hourly/daily totals and ensures data is only logged to the cloud when changes occur (Smart Logging).
3.  **Visualization**: The web dashboard retrieves this data in real-time, instantly updating gauges, budget badges, and historical charts without page reloads.
4.  **Reporting**: Users can export their usage history into a clean, formatted CSV report compatible with Excel for billing or auditing purposes.

---
*Every Drop Matters. Save Water, Save Money.* ✌️🎓🏆
