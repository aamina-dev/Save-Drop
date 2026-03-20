# Save-Drop: Smart Water Monitoring System 💧

> **BSc IT Final Year Project**  
> Developed by: [Your Name]  
> University: Mumbai University

## 📖 Project Overview
Save-Drop is a cloud-integrated Internet of Things (IoT) application designed to monitor live water flow, track overhead tank levels, and maintain a historical database of water consumption. It aims to prevent water overflow and promote water conservation via a real-time smart dashboard.

## 🛠️ Tech Stack
* **Hardware:** NodeMCU ESP8266, YF-S201 Water Flow Sensor, HC-SR04 Ultrasonic Distance Sensor.
* **Firmware:** C++ (Arduino IDE)
* **Web Frontend:** HTML5, Vanilla CSS (Glassmorphism UI), Vanilla JavaScript
* **Database & Auth:** Firebase Realtime Database & Firebase Authentication
* **Hosting:** Vercel Environment

## 📁 Repository Structure
* `/Save-Drop/` - Contains the `Save-Drop.ino` C++ file for the ESP8266 microcontroller.
* `index.html` - The main live dashboard UI.
* `login.html` - The secure authentication gateway.
* `style.css` - Custom styling and responsive mobile design.
* `script.js` - The core frontend logic bridging the UI and Firebase Realtime Database.
* `auth.js` - Handles Firebase user login and security flow.

## 🔒 Security Architecture
This project utilizes a dual-layer security approach:
1. **Frontend:** Unauthenticated users are strictly blocked and redirected to `login.html` by `auth.js`.
2. **Backend (Firebase Rules):** The database requires an authenticated JWT token to read data. To write data, the ESP8266 must provide a secret `DEVICE_SECRET` hardware key, rendering the API completely immune to unauthorized data manipulation.

## 🚀 Key Features
* **Real-time Synchronization:** Total instantaneous synchronization between physical water flow and the web dashboard (Latency < 200ms).
* **Smart Edge-Logging:** The microcontroller employs an algorithmic approach to database logging; it pushes data *only* during active flow or as a 5-minute heartbeat, mathematically preventing unbounded cloud storage growth.
* **Drift-Free Calculations:** The hardware measures actual elapsed time (`millis()`) rather than utilizing processing-heavy `delay()` functions, guaranteeing calculation integrity.
* **Responsive Watchdog:** The JavaScript frontend continually monitors incoming data streams, activating an "Offline" visual indicator if the hardware network drops for more than 6 seconds.
