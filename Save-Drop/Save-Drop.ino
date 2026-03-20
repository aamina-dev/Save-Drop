#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <time.h>

/* ---------------- WIFI CONFIG ---------------- */
// Put your home WiFi name and password here so the NodeMCU can connect to the internet.
#define WIFI_SSID "Jasmine"
#define WIFI_PASSWORD "yaseen786"

/* ---------------- FIREBASE CONFIG ---------------- */
// Your Firebase database credentials and the secret key to prevent hackers from writing fake data.
#define API_KEY "AIzaSyCdcE6ASFSi8ZHn82q741xUWUO1cp7tK3g"
#define DATABASE_URL "https://save-drop-default-rtdb.firebaseio.com/"
#define DEVICE_SECRET "Savedrop_Secure"

/* ---------------- FIREBASE OBJECTS ---------------- */
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

/* ---------------- SENSOR PINS ---------------- */
// D5 is for the YF-S201 Water Flow Sensor (Yellow Wire)
#define FLOW_PIN D5
// D1 and D2 are for the HC-SR04 Ultrasonic Distance Sensor
#define TRIG_PIN D1
#define ECHO_PIN D2

/* ---------------- FLOW SENSOR VARIABLES ---------------- */
// pulseCount counts how many times the little wheel inside the flow sensor spins.
// It is marked 'volatile' because it changes rapidly in the background interrupt function.
volatile int pulseCount = 0;
float flowRate = 0;       // Liters per minute
float totalLitres = 0;    // Total water that has passed through the pipe

/* ---------------- TANK VARIABLES ---------------- */
long duration;            // Time it takes for the ultrasonic sound to bounce back
float distance;           // Distance to the water surface in centimeters
float percentage;         // How full the tank is (0% to 100%)

/* ---------------- CALIBRATION VALUES ---------------- */
// emptyDistance is depth of your empty jar (cm). fullDistance is the blind-spot at the top.
float emptyDistance = 12.1;
float fullDistance  = 2.5; 

// Flow factor provided by the sensor datasheet (YF-S201 is usually around 7.5 or 48.5 depending on pipe size)
float flowCalibration = 48.5;

/* ---------------- TIME VARIABLES ---------------- */
// We use these to track time using the ESP's internal stopwatch (millis) instead of using delay().
// Using delay() makes the ESP freeze, which means we might miss a water pulse!
unsigned long previousMillis = 0;
unsigned long lastLogMillis = 0;

/* ---------------- FLOW SENSOR INTERRUPT ---------------- */
// This function runs automatically in the background every time the flow sensor wheel clicks.
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

/* ---------------- SETUP FUNCTION (Runs Once) ---------------- */
void setup() {
  Serial.begin(9600); // Start the serial monitor for debugging

  /* ----- WIFI CONNECT ----- */
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  /* ----- TIME SYNC ----- */
  // We need to fetch the real-world time from the internet so our Firebase logs have timestamps.
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

  // Sign in completely anonymously since the NodeMCU is just a hardware device, not a user.
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase SignUp OK");
  } else {
    Serial.printf("Signup failed: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  /* ----- RESTORE PREVIOUS WATER SAVED ----- */
  // If the NodeMCU loses power and restarts, we fetch the last known totalLitres from Firebase so we don't start at 0 again.
  delay(1000); 
  if (Firebase.RTDB.getFloat(&fbdo, "/sensors/totalSavedWater")) {
    totalLitres = fbdo.floatData();
    Serial.print("Restored totalLitres from Firebase: ");
    Serial.println(totalLitres);
  } else {
    Serial.println("No previous totalSavedWater found, starting from 0");
  }

  /* ----- SENSOR PIN SETUP ----- */
  pinMode(FLOW_PIN, INPUT_PULLUP);
  // Tell the ESP to trigger the pulseCounter() function whenever FLOW_PIN goes from LOW to HIGH (RISING).
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), pulseCounter, RISING);

  pinMode(TRIG_PIN, OUTPUT); // Sends the sound wave
  pinMode(ECHO_PIN, INPUT);  // Listens for the echo
}

/* ---------------- MAIN LOOP (Runs Forever) ---------------- */
void loop() {

  // Get the current millisecond time of the ESP8266 stopwatch.
  unsigned long currentMillis = millis();

  // Wait until it has been 5000 milliseconds (5 seconds) since the last time this ran.
  // This is better than delay(5000) because the flow sensor can still run in the background.
  if (currentMillis - previousMillis >= 5000) {

    // Calculate EXACTLY how many milliseconds have passed to ensure pure mathematical accuracy.
    unsigned long timeElapsed = currentMillis - previousMillis;
    previousMillis = currentMillis;

    /* -------- 1. FLOW SENSOR CALCULATION -------- */
    // Divide pulses by the calibration factor to get Liters per Minute.
    flowRate = pulseCount / flowCalibration;

    // Ignore tiny accidental sloshing or electrical noise.
    if(flowRate < 0.02) flowRate = 0;   

    // Convert Flow Rate (Liters/Min) into the exact amount of Liters that fell in the last 5 seconds.
    // L/ms = flowRate / 60000.0. Multiply by timeElapsed to get the volume for this exact cycle.
    float litresThisCycle = (flowRate / 60000.0) * timeElapsed;
    
    // Add it to the grand total
    totalLitres += litresThisCycle;

    // Safely pause the background interrupts for a split second while we reset the count to 0, 
    // to guarantee we don't delete a pulse while the CPU is doing math.
    noInterrupts();
    pulseCount = 0;
    interrupts();

    /* -------- 2. ULTRASONIC SENSOR CALCULATION -------- */
    float totalDistance = 0;

    // Take 5 quick readings and average them out to prevent wild jumping/glitching numbers.
    for(int i=0; i<5; i++){
      digitalWrite(TRIG_PIN, LOW);
      delayMicroseconds(2);
      
      // Shoot a 10 microsecond sound wave pulse
      digitalWrite(TRIG_PIN, HIGH);
      delayMicroseconds(10);
      digitalWrite(TRIG_PIN, LOW);

      // Listen for the echo. If the echo doesn't come back in 30ms (30000us), assume it's lost and move on!
      duration = pulseIn(ECHO_PIN, HIGH, 30000);

      // Math: Distance = (Time x Speed of Sound in Air) / 2 (because sound goes there AND back)
      float d = duration * 0.034 / 2;
      totalDistance += d;

      delay(40); // Wait 40ms before next pulse to let old echoes fade away
    }

    // Calculate the average distance
    distance = totalDistance / 5;

    /* -------- 3. TANK PERCENTAGE CALCULATION -------- */
    // Map the distance to a 0-100% scale based on our calibration numbers.
    percentage = ((emptyDistance - distance) / (emptyDistance - fullDistance)) * 100;

    // Keep the percentage locked between 0 and 100 (so it doesn't say -5% or 110%)
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;

    /* -------- 4. TANK STATUS LOGIC -------- */
    // Set a text-based status alert depending on the water level
    String status;
    if (percentage < 20) {
      status = "LOW_LEVEL";
    } else if (percentage > 95) {
      status = "OVERFLOW";
    } else {
      status = "NORMAL";
    }

    /* -------- 5. SERIAL MONITOR LOGGING -------- */
    // Print all the calculated values to your computer screen just so you can debug it via USB.
    Serial.println("------ Sensor Data ------");
    Serial.print("Distance: "); Serial.print(distance); Serial.println(" cm");
    Serial.print("Flow Rate: "); Serial.print(flowRate); Serial.println(" L/min");
    Serial.print("Tank Level: "); Serial.print(percentage); Serial.println(" %");
    Serial.print("Total Water: "); Serial.print(totalLitres); Serial.println(" L");
    Serial.print("Status: "); Serial.println(status);

    /* -------- 6. UPLOAD TO FIREBASE -------- */
    if (Firebase.ready()) {

      // A) LIVE DASHBOARD UPDATE
      // Pack all the live sensor values AND the secret device key into a single JSON object.
      FirebaseJson sensorJson;
      sensorJson.set("deviceKey", DEVICE_SECRET);
      sensorJson.set("flowRate", flowRate);
      sensorJson.set("tankLevel", percentage);
      sensorJson.set("totalSavedWater", totalLitres);
      sensorJson.set("status", status);

      // Blast it to the "/sensors" folder in one go (very fast and uses less internet).
      Firebase.RTDB.updateNode(&fbdo, "/sensors", &sensorJson);

      // B) HISTORICAL LOG (SMART LOGGING)
      // Only record a permanent database log if water is actively flowing, OR if 5 whole minutes (300,000 ms) have passed.
      // This stops your database from exploding with millions of useless rows!
      if (flowRate > 0 || (currentMillis - lastLogMillis >= 300000)) {
        
        unsigned long timestamp = time(nullptr); // Grab real-world time

        FirebaseJson logJson;
        logJson.set("deviceKey", DEVICE_SECRET);
        logJson.set("timestamp", timestamp);
        logJson.set("flowRate", flowRate);
        logJson.set("tankLevel", percentage);
        logJson.set("volume", totalLitres);

        // 'pushJSON' creates a new unique folder (like /logs/-Oxy123) to permanently save this moment in history.
        Firebase.RTDB.pushJSON(&fbdo, "/logs", &logJson);
        
        lastLogMillis = currentMillis;
        Serial.println("Historical Log Pushed");
      }

      Serial.println("Firebase Sensors Updated");
    }

    Serial.println("-------------------------");
  }
}