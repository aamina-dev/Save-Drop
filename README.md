# Save-Drop: Water Monitoring System

**BSc IT Final Year Project**  
Developed by: Aamna Ansari  
University: Mumbai University

## Project Overview
Save-Drop is an Internet of Things (IoT) project built to monitor water flow and overhead tank levels in real time. The goal of this project is to create a simple, cloud-connected dashboard that helps users track their daily water consumption and prevent their tanks from overflowing.

## Technologies Used
* **Hardware:** NodeMCU ESP8266, YF-S201 Water Flow Sensor, HC-SR04 Ultrasonic Sensor
* **Microcontroller Code:** C++ (Arduino IDE)
* **Frontend:** HTML, CSS, Vanilla JavaScript
* **Backend & Database:** Firebase Realtime Database
* **User Authentication:** Firebase Auth
* **Deployment:** Vercel

## Folder Structure
* `Save-Drop/` - Contains the Arduino C++ code (`Save-Drop.ino`) that you need to flash to the NodeMCU.
* `index.html` - The main dashboard page that displays the live sensor data.
* `login.html` - The login page that secures the dashboard.
* `style.css` - The styling for the website.
* `script.js` - The JavaScript file that connects the dashboard to the Firebase Realtime Database.
* `auth.js` - The JavaScript file that handles user login and logout.

## How It Works
The system uses two main sensors. The ultrasonic sensor measures the distance to the water surface to calculate the tank percentage, and the flow sensor measures how many liters of water are passing through the pipe. 

The NodeMCU processes this data and sends it over WiFi to a Firebase database. To keep the database fast and save storage space, the code is optimized to only save a permanent log when water is actively flowing, or once every 5 minutes. 

On the software side, the web dashboard is secured using Firebase Authentication. When a valid user logs in, the JavaScript connects to the database and updates the UI charts and cards instantly without needing to refresh the page.
