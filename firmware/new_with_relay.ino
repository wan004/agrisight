/************************************************************
 * AgriSight – Unified Final Firmware
 *  - DHT22 (GPIO13)
 *  - Soil (ADC2 GPIO14)  -- WiFi OFF while reading
 *  - Relay control (GPIO15) with status endpoint
 *  - Camera init only on capture (init -> capture -> deinit)
 *  - Sends sensor JSON to Flask: /sensor and images to /scan
 *  - Robust serial logging
 ************************************************************/

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <DHT.h>
#include "mbedtls/base64.h"

// ---------------- CONFIG ----------------
const char* WIFI_SSID     = "xenixo";
const char* WIFI_PASSWORD = "okname10";

const char* SERVER_IP   = "10.235.21.235"; // Flask host
const int   SERVER_PORT = 5000;

// ---------------- PINS ----------------
#define DHTPIN   13
#define DHTTYPE  DHT22
DHT dht(DHTPIN, DHTTYPE);

#define SOIL_PIN   14    // ADC2
#define RELAY_PIN  15    // SAFE pin for relay control

// Camera pins (AI-Thinker)
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y2_GPIO_NUM        5
#define Y3_GPIO_NUM       18
#define Y4_GPIO_NUM       19
#define Y5_GPIO_NUM       21
#define Y6_GPIO_NUM       36
#define Y7_GPIO_NUM       39
#define Y8_GPIO_NUM       34
#define Y9_GPIO_NUM       35
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// --------------- Calibration & timings ---------------
const int SOIL_RAW_DRY = 4095;
const int SOIL_RAW_WET = 2350;
const int SOIL_SAMPLES = 12;
const unsigned long DHT_INTERVAL_MS  = 5UL * 60UL * 1000UL; // 5m
const unsigned long SOIL_INTERVAL_MS = 12UL * 60UL * 60UL * 1000UL; // 12h

unsigned long lastDhtSend  = 0;
unsigned long lastSoilSend = 0;

// --------------- HTTP server ----------------
WebServer server(80);

// --------------- Helpers --------------------
bool ensureWiFi(uint16_t timeout_ms = 12000) {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < timeout_ms) {
    Serial.print(".");
    delay(300);
  }
  Serial.println();
  return WiFi.status() == WL_CONNECTED;
}

String httpPostJSONLocal(const String &path, const String &json, uint16_t timeout_ms=15000) {
  if (!ensureWiFi(timeout_ms)) {
    Serial.println("❌ HTTP: WiFi not connected");
    return "-1";
  }
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + path;
  HTTPClient http;
  http.setTimeout(timeout_ms);
  http.setConnectTimeout(timeout_ms);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  Serial.println("📤 POST " + url + " -> " + json);
  int code = http.POST(json);
  String body = http.getString();
  Serial.printf("🖥 Flask %s response: %d\n", path.c_str(), code);
  if (body.length()) {
    size_t clip = body.length() > 300 ? 300 : body.length();
    Serial.print("↪ Body: "); Serial.println(body.substring(0, clip));
  }
  http.end();
  return String(code);
}

String base64Encode(const uint8_t* data, size_t len) {
  size_t out_len = (len + 2) / 3 * 4 + 4;
  unsigned char* out = (unsigned char*)malloc(out_len);
  if (!out) return "";
  size_t written = 0;
  int rc = mbedtls_base64_encode(out, out_len, &written, data, len);
  if (rc != 0) { free(out); return ""; }
  String s = String((char*)out);
  free(out);
  return s;
}

// --------------- Sensor actions ------------------
void sendSensorData(float moisture, float temp, float hum) {
  String json = String("{\"moisture\":") + String(moisture,1) +
                ",\"temperature\":" + String(temp,1) +
                ",\"humidity\":" + String(hum,1) + "}";
  httpPostJSONLocal("/sensor", json);
}

void actionReadDHT_once_and_send() {
  Serial.println("\n🌡️ Reading DHT22…");
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("❌ DHT22 read failed");
    return;
  }
  Serial.printf("✅ DHT22 → Temp=%.1f°C  Humidity=%.1f%%\n", t, h);
  sendSensorData(-1, t, h);
}

float readSoilAndReturnPercent() {
  Serial.println("\n🌱 Reading Soil Moisture… (safe ADC2 sequence)");
  // Safe shutdown of WiFi for ADC2
  WiFi.disconnect(true, true);
  WiFi.mode(WIFI_MODE_NULL);
  delay(350); // give ADC2 time to be usable

  long sum = 0;
  for (int i = 0; i < SOIL_SAMPLES; ++i) {
    int raw = analogRead(SOIL_PIN);
    sum += raw;
    Serial.printf("  sample %d = %d\n", i, raw);
    delay(30);
  }
  int rawAvg = sum / SOIL_SAMPLES;
  Serial.printf("➡️ Raw avg = %d\n", rawAvg);

  float moisture;
  if (rawAvg >= SOIL_RAW_DRY) moisture = 0.0;
  else if (rawAvg <= SOIL_RAW_WET) moisture = 100.0;
  else moisture = (float)(SOIL_RAW_DRY - rawAvg) * 100.0 / (SOIL_RAW_DRY - SOIL_RAW_WET);
  moisture = constrain(moisture, 0.0, 100.0);
  Serial.printf("🌡 Moisture = %.1f%%\n", moisture);

  // Restore WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  ensureWiFi(8000);
  return moisture;
}

// --------------- Camera helpers ------------------
// Initialize camera only when needed (returns true if ok)
bool cameraSafeInit() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk  = XCLK_GPIO_NUM;
  config.pin_pclk  = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href  = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count     = 1;
  }

  Serial.println("📸 Initializing camera...");
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init error 0x%x\n", err);
    return false;
  }
  Serial.println("✅ Camera ready");
  sensor_t * s = esp_camera_sensor_get();
  if (s) {
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
  }
  return true;
}

void cameraSafeDeinit() {
  esp_camera_deinit();
  Serial.println("🛑 Camera deinitialized to save power");
}

// Capture image, return base64 string or "" on error
String captureImageBase64(bool tryInitCamera=true) {
  bool inited = false;
  if (tryInitCamera) {
    inited = cameraSafeInit();
    if (!inited) return "";
  }
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture failed (fb null)");
    if (inited) cameraSafeDeinit();
    return "";
  }
  Serial.printf("✅ Image captured (%u bytes)\n", fb->len);
  String b64 = base64Encode(fb->buf, fb->len);
  esp_camera_fb_return(fb);

  if (inited) {
    cameraSafeDeinit();
  }
  return b64;
}

// --------------- Relay ------------------
void relayOn()  { digitalWrite(RELAY_PIN, LOW);  /* active low modules often */ Serial.println("🔌 Relay ON (LOW)"); }
void relayOff() { digitalWrite(RELAY_PIN, HIGH); Serial.println("🔌 Relay OFF (HIGH)"); }

String relayStatus() {
  int v = digitalRead(RELAY_PIN);
  // if active low: LOW = ON
  if (v == LOW) return "on";
  return "off";
}

// --------------- HTTP handlers ----------------
void handleRoot() { server.send(200, "text/plain", "AgriSight ESP32-CAM OK"); }

void handleCaptureEndpoint() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  String b64 = captureImageBase64(true);
  if (b64.length() == 0) {
    server.send(500, "application/json", "{\"error\":\"capture_failed\"}");
    return;
  }
  // send to Flask
  String json = "{\"imageBase64\":\"" + b64 + "\"}";
  String resp = httpPostJSONLocal("/scan", json);
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleReadDhtEndpoint() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  actionReadDHT_once_and_send();
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleReadSoilEndpoint() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  float m = readSoilAndReturnPercent();
  sendSensorData(m, -1, -1);
  server.send(200, "application/json", "{\"moisture\":" + String(m,1) + "}");
}

void handleRelayOnEndpoint() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  relayOn();
  // log to server optionally
  server.send(200, "application/json", "{\"relay\":\"on\"}");
}

void handleRelayOffEndpoint() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  relayOff();
  server.send(200, "application/json", "{\"relay\":\"off\"}");
}

void handleRelayStatusEndpoint() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", "{\"state\":\"" + relayStatus() + "\"}");
}

// --------------- Setup ----------------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n🚀 AgriSight ESP32-CAM Booting…");

  // Relay pin
  pinMode(RELAY_PIN, OUTPUT);
  relayOff(); // safe default HIGH = off

  // DHT
  dht.begin();

  // Important: do NOT init camera on boot to save current/power.
  // We'll init only when capture is requested.

  // Connect WiFi
  Serial.println("🔌 Connecting Wi-Fi…");
  if (ensureWiFi(12000)) {
    Serial.print("✅ Wi-Fi OK, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("❌ Wi-Fi connect failed (continue offline)");
  }

  // HTTP endpoints
  server.on("/", HTTP_GET, handleRoot);
  server.on("/capture", HTTP_POST, handleCaptureEndpoint);
  server.on("/read/dht", HTTP_POST, handleReadDhtEndpoint);
  server.on("/read/soil", HTTP_POST, handleReadSoilEndpoint);
  server.on("/relay/on", HTTP_POST, handleRelayOnEndpoint);
  server.on("/relay/off", HTTP_POST, handleRelayOffEndpoint);
  server.on("/relay/status", HTTP_GET, handleRelayStatusEndpoint);

  // CORS preflight
  server.onNotFound([](){
    if (server.method() == HTTP_OPTIONS) {
      server.sendHeader("Access-Control-Allow-Origin", "*");
      server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
      server.send(200);
    } else {
      server.send(404, "text/plain", "Not Found");
    }
  });

  server.begin();
  Serial.println("✅ Local control server started");
  Serial.println("• /capture  (POST)");
  Serial.println("• /read/dht (POST)");
  Serial.println("• /read/soil (POST)");
  Serial.println("• /relay/on (POST)");
  Serial.println("• /relay/off (POST)");
  Serial.println("• /relay/status (GET)");

  lastDhtSend = millis();
  lastSoilSend = millis();
}

// --------------- Loop ----------------
void loop() {
  server.handleClient();

  unsigned long now = millis();

  if (now - lastDhtSend >= DHT_INTERVAL_MS) {
    lastDhtSend = now;
    actionReadDHT_once_and_send();
  }

  if (now - lastSoilSend >= SOIL_INTERVAL_MS) {
    lastSoilSend = now;
    float m = readSoilAndReturnPercent();
    sendSensorData(m, -1, -1);
  }
}
