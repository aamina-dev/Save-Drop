#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

/* ---------------- WIFI CONFIG ---------------- */

#define WIFI_SSID "Jasmine"
#define WIFI_PASSWORD "yaseen786"

/* ---------------- FIREBASE CONFIG ---------------- */

#define API_KEY "AIzaSyCdcE6ASFSi8ZHn82q741xUWUO1cp7tK3g"
#define DATABASE_URL "https://save-drop-default-rtdb.firebaseio.com/"

/* ---------------- FIREBASE OBJECTS ---------------- */

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

/* ---------------- SENSOR PINS ---------------- */

#define FLOW_PIN D5
#define TRIG_PIN D1
#define ECHO_PIN D2

/* ---------------- FLOW SENSOR VARIABLES ---------------- */

volatile int pulseCount = 0;
float flowRate = 0;
float totalLitres = 0;

/* ---------------- TANK VARIABLES ---------------- */

long duration;
float distance;
float percentage;

/* ---------------- CALIBRATION VALUES ---------------- */

// calibrated from your measurements
float emptyDistance = 12.4;
float fullDistance  = 2.6;

// calibrated flow factor
float flowCalibration = 48.5;

/* ---------------- TIME VARIABLES ---------------- */

unsigned long previousMillis = 0;

/* ---------------- FLOW SENSOR INTERRUPT ---------------- */

void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

/* ---------------- SETUP ---------------- */

void setup() {

  Serial.begin(9600);

  /* ----- WIFI CONNECT ----- */

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");

  /* ----- TIME SYNC ----- */

  configTime(5.5 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Syncing time");

  while (time(nullptr) < 100000) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nTime Synced");

  /* ----- FIREBASE CONFIG ----- */

  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase SignUp OK");
  } 
  else {
    Serial.printf("Signup failed: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  /* ----- RESTORE TOTAL LITRES FROM FIREBASE ----- */

  delay(1000); // allow Firebase connection to stabilise

  if (Firebase.RTDB.getFloat(&fbdo, "/sensors/totalSavedWater")) {
    totalLitres = fbdo.floatData();
    Serial.print("Restored totalLitres from Firebase: ");
    Serial.println(totalLitres);
  } else {
    Serial.println("No previous totalSavedWater found, starting from 0");
  }

  /* ----- FLOW SENSOR SETUP ----- */

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);

  /* ----- ULTRASONIC SETUP ----- */

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

/* ---------------- LOOP ---------------- */

void loop() {

  if (millis() - previousMillis >= 5000) {

    previousMillis = millis();

    /* -------- FLOW SENSOR CALCULATION -------- */

    flowRate = pulseCount / flowCalibration;

    if(flowRate < 0.02) flowRate = 0;   // noise filter

    float litresThisCycle = flowRate / 60.0 * 5.0;
    totalLitres += litresThisCycle;

    pulseCount = 0;

    /* -------- ULTRASONIC AVERAGE (STABLE) -------- */

    float totalDistance = 0;

    for(int i=0;i<5;i++){

      digitalWrite(TRIG_PIN, LOW);
      delayMicroseconds(2);

      digitalWrite(TRIG_PIN, HIGH);
      delayMicroseconds(10);

      digitalWrite(TRIG_PIN, LOW);

      duration = pulseIn(ECHO_PIN, HIGH);

      float d = duration * 0.034 / 2;

      totalDistance += d;

      delay(40);
    }

    distance = totalDistance / 5;

    /* -------- TANK LEVEL CALCULATION -------- */

    percentage =
    ((emptyDistance - distance) /
    (emptyDistance - fullDistance)) * 100;

    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    /* -------- STATUS LOGIC -------- */

    String status;

    if (percentage < 20) {
      status = "LOW_LEVEL";
    } 
    else if (percentage > 95) {
      status = "OVERFLOW";
    } 
    else {
      status = "NORMAL";
    }

    /* -------- SERIAL MONITOR OUTPUT -------- */

    Serial.println("------ Sensor Data ------");

    Serial.print("Distance: ");
    Serial.print(distance);
    Serial.println(" cm");

    Serial.print("Flow Rate: ");
    Serial.print(flowRate);
    Serial.println(" L/min");

    Serial.print("Tank Level: ");
    Serial.print(percentage);
    Serial.println(" %");

    Serial.print("Total Water: ");
    Serial.print(totalLitres);
    Serial.println(" L");

    Serial.print("Status: ");
    Serial.println(status);

    /* -------- FIREBASE LIVE UPDATE -------- */

    if (Firebase.ready()) {

      Firebase.RTDB.setFloat(&fbdo, "/sensors/flowRate", flowRate);
      Firebase.RTDB.setFloat(&fbdo, "/sensors/tankLevel", percentage);
      Firebase.RTDB.setFloat(&fbdo, "/sensors/totalSavedWater", totalLitres);
      Firebase.RTDB.setString(&fbdo, "/sensors/status", status);

      /* -------- LOG ENTRY -------- */

      unsigned long timestamp = time(nullptr);

      FirebaseJson json;

      json.set("timestamp", timestamp);
      json.set("flowRate", flowRate);
      json.set("tankLevel", percentage);
      json.set("volume", totalLitres);

      Firebase.RTDB.pushJSON(&fbdo, "/logs", &json);

      Serial.println("Firebase Updated");
    }

    Serial.println("-------------------------");
  }
}