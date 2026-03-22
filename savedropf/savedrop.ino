/* 
  =========================================================================
  SAVE-DROP: SMART WATER MONITORING SYSTEM (FINAL FIRMWARE)
  Project: IoT-based Water Consumption & Tank Level Monitor
  Developed by: Ansari Aamina
  
  TECHNICAL OVERVIEW:
  - Microcontroller: NodeMCU (ESP8266)
  - Database: Firebase Realtime Database
  - Sensors: YF-S201 (Flow), HC-SR04 (Ultrasonic)
  =========================================================================
*/

#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

/* ---------------- WIFI CONFIG ---------------- */
// Home WiFi credentials for internet connectivity
#define WIFI_SSID "Jasmine"
#define WIFI_PASSWORD "yaseen786"

/* ---------------- FIREBASE CONFIG ---------------- */
// Firebase Database secrets for secure data synchronization
#define API_KEY "AIzaSyCdcE6ASFSi8ZHn82q741xUWUO1cp7tK3g"
#define DATABASE_URL "https://save-drop-default-rtdb.firebaseio.com/"
#define DEVICE_SECRET "Savedrop_Secure"

/* ---------------- FIREBASE OBJECTS ---------------- */
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

/* ---------------- SENSOR PINS ---------------- */
#define FLOW_PIN D5    // Input from Flow Sensor (Yellow wire)
#define TRIG_PIN D1    // Trigger for Ultrasonic Sensor
#define ECHO_PIN D2    // Echo for Ultrasonic Sensor

/* ---------------- GLOBAL SYSTEM VARIABLES ---------------- */
volatile int pulseCount = 0; // Tracks sensor 'clicks' in real-time background
float flowRate = 0;          // Current speed of water (L/min)
float totalWater = 0;        // Cumulative water used (Litres)
float distance;              // Distance to water surface (cm)
float percentage;            // Calculated Tank Fill Level (0-100%)

/* ---------------- CALIBRATION SETTINGS ---------------- */
// Jar/Tank geometry in cm (Empty: sensor to bottom | Full: sensor to top water line)
float emptyDistance = 12.1;
float fullDistance  = 2.5; 

// Flow Calibration Factor (Specific to YF-S201 sensor datasheet)
float flowCalibration = 48.5;

/* ---------------- TIMING VARIABLES ---------------- */
// Using non-blocking timers instead of delay() to ensure high-speed sensor accuracy
unsigned long previousMillis = 0;
unsigned long lastLogMillis = 0;

/* ---------------- INTERRUPT SERVICE ROUTINE (ISR) ---------------- */
// Runs instantly every time a water pulse is detected (very high priority)
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

/* ---------------- SETUP FUNCTION (Initialization) ---------------- */
void setup() {
  Serial.begin(9600); // Start Serial Terminal for debugging

  /* A) CONNECT TO INTERNET */
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected ✅");

  /* B) SYNC GLOBAL TIME (NTP) */
  // Necessary for accurate data timestamps in Firebase Logs
  configTime(5.5 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Syncing Time");
  while (time(nullptr) < 100000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nTime Synced ✅");

  /* C) FIREBASE CORE CONFIG */
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  // Sign in anonymously to authenticate this hardware device
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth OK ✅");
  } else {
    Serial.printf("Auth Error: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  /* D) RESTORE PERISTENT STATE */
  // Fetch existing "Total Water" counter from cloud so it doesn't reset on restart
  delay(1000); 
  if (Firebase.RTDB.getFloat(&fbdo, "/sensors/totalWater")) {
    totalWater = fbdo.floatData();
    Serial.print("Restored Counter: "); Serial.println(totalWater);
  }

  /* E) HARDWARE SETUP */
  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

/* ---------------- MAIN LOOP (System Execution) ---------------- */
void loop() {
  unsigned long currentMillis = millis();

  // Run every 5 seconds (Sensor Update Cycle)
  if (currentMillis - previousMillis >= 5000) {
    unsigned long timeElapsed = currentMillis - previousMillis;
    previousMillis = currentMillis;

    /* 1. CALCULATE FLOW & VOLUME */
    // Convert rapid pulses into Liters per Minute
    flowRate = pulseCount / flowCalibration;
    if(flowRate < 0.02) flowRate = 0; // Remove electrical jitter

    // Accumulate total volume (math: rate x time)
    float litresThisCycle = (flowRate / 60000.0) * timeElapsed;
    totalWater += litresThisCycle;

    // Reset pulses for the next 5s counting window
    noInterrupts();
    pulseCount = 0;
    interrupts();

    /* 2. ULTRASONIC TANK MEASUREMENT */
    float totalDistance = 0;
    for(int i=0; i<5; i++){ // 5 Reading averaging for high stability
      digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
      digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
      digitalWrite(TRIG_PIN, LOW);
      long duration = pulseIn(ECHO_PIN, HIGH, 30000);
      totalDistance += (duration * 0.034 / 2); // cm conversion
      delay(40);
    }
    distance = totalDistance / 5;

    /* 3. MAPPING & STATUS LOGIC */
    // Map raw distance (cm) to human-readable % level
    percentage = ((emptyDistance - distance) / (emptyDistance - fullDistance)) * 100;
    percentage = constrain(percentage, 0, 100);

    String status = (percentage < 20) ? "LOW_LEVEL" : (percentage > 95) ? "OVERFLOW" : "NORMAL";

    /* 4. CLOUD SYNCHRONIZATION (Firebase) */
    if (Firebase.ready()) {
      FirebaseJson sensorJson;
      sensorJson.set("deviceKey", DEVICE_SECRET);
      sensorJson.set("flowRate", flowRate);
      sensorJson.set("tankLevel", percentage);
      sensorJson.set("totalWater", totalWater);
      sensorJson.set("status", status);

      // A) Update Real-time Dashboard Nodes
      Firebase.RTDB.updateNode(&fbdo, "/sensors", &sensorJson);

      // B) Smart Data Logging (Persistent History)
      // Save every 5 mins OR if water is actively flowing
      if (flowRate > 0 || (currentMillis - lastLogMillis >= 300000)) {
        FirebaseJson logJson;
        logJson.set("timestamp", (unsigned long)time(nullptr));
        logJson.set("flowRate", flowRate);
        logJson.set("tankLevel", percentage);
        logJson.set("totalWater", totalWater);
        Firebase.RTDB.pushJSON(&fbdo, "/logs", &logJson);
        lastLogMillis = currentMillis;
        Serial.println(">>> Historical Record Logged");
      }
    }
    Serial.printf("LIVE -> Flow: %.2f L/m | Level: %.1f%% | Total: %.2f L\n", flowRate, percentage, totalWater);
  }
}