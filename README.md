# 🌾 AgriSight 2.0 - Intelligent IoT Crop Health & Environment Monitoring System

AgriSight 2.0 is a **smart precision agriculture system** that combines **IoT sensors (ESP32-CAM + DHT22 + Soil Moisture Sensor)**, **AI-powered disease detection**, and an interactive **Flask + Tailwind Dashboard**.

It's designed for **local offline-first operation**, with optional **AI integration** via **OpenRouter (Claude 3.5)** and **Crop.Health API** for real-time crop disease identification.

---

## 🚀 System Overview

```plaintext
   ┌──────────────┐        ┌───────────────┐        ┌─────────────────────┐        ┌──────────────────┐
   │ ESP32-CAM    │──────▶ │ Flask Server  │──────▶ │  AI via OpenRouter  │──────▶ │  Web Dashboard   │
   │ + Sensors    │  WiFi  │ (app.py)      │  REST  │  (Claude 3.5 Model) │        │  (Tailwind UI)   │
   │ (Soil, DHT22)│◀────── │ + SQLite DB   │◀────── │  + Crop.Health API  │        │  + Leaflet Map   │
   └──────────────┘        └───────────────┘        └─────────────────────┘        └──────────────────┘
```

---

## ⚙️ Core Features

### 1️⃣ Real-time Sensor Monitoring

* **Soil Moisture**, **Temperature**, and **Humidity** are fetched from ESP32 every 5 minutes.
* Displays **live readings** on the dashboard cards.
* Each reading is **persisted in SQLite** for analytics & graphs.

### 2️⃣ ESP32-CAM Image Capture

* Captures plant leaf images on demand.
* WiFi temporarily disabled during soil read (to prevent ADC noise interference).
* Each image is uploaded to Flask via `/upload` endpoint and auto-stored in `/static/uploads/`.

### 3️⃣ Crop Disease Detection (Crop.Health API)

* Flask encodes the captured image in Base64 and calls:

  ```
  POST https://crop.kindwise.com/api/v1/identification 
  ```
* Extracts **disease name**, **confidence score**, and **description**.
* Displays:

  * 🦠 Disease Name
  * 📈 Confidence Bar
  * 📃 Description

### 4️⃣ AI Chatbot — “AI Agronomist”

* Integrates **Claude 3.5 (via OpenRouter)**.
* Auto-prefills chat with detected **disease name** and **crop type**.
* Users can ask:

  > “How can I treat this disease?”
* AI responds with:

  * ✅ Organic treatments
  * 💊 Chemical options
  * 🧠 Prevention advice
  * ⚠️ Safety notes
* Chat history is stored locally in the SQLite DB (`chats` table).

### 5️⃣ Smart Relay Control (Water Pump)

* Control irrigation directly from the dashboard.
* Two buttons: **Pump ON** / **Pump OFF**.
* Flask sends command to ESP32 `/control/relay`.
* Actions logged under the `actions` table.

### 6️⃣ Weather Integration (OpenWeatherMap)

* Choose weather input method:

  * 📍 Auto-detect location (using Geolocation API)
  * 🌍 Manual entry (latitude/longitude input)
  * 🗺️ Map picker (via Leaflet integration)
* Fetches live weather and updates dashboard conditions.

### 7️⃣ Logs & Analytics

* `/logs` page visualizes:

  * Historical sensor trends via **Chart.js**.
  * Crop disease scan gallery with thumbnails.
* Option to **view**, **download**, or **delete** individual logs.

### 8️⃣ Gallery & File Upload

* Drag & drop file uploader for demo uploads.
* Preview before upload.
* Full-screen gallery viewer with:

  * ⬅️ / ➡️ Carousel navigation
  * 🗑️ Delete option
  * 📥 Download option
  * 🌡️ Confidence bar (color-coded: red = risky, green = healthy)

### 9️⃣ Offline + Local-First Architecture

* Works entirely offline for local servers.
* All data persisted in SQLite.
* No cloud dependencies required except optional APIs.

---

## 🧩 Project Structure

```bash
AgriSight_Full/
├── app.py                      # Flask backend
├── config.py                   # Loads API keys & paths
├── utils/
│   ├── db.py                   # SQLite handler
│   ├── ai_helper.py            # OpenRouter API (Claude)
│   ├── crop_health.py          # Crop.Health integration
│   ├── esp_helper.py           # Relay + ESP32 communication
│   ├── weather_helper.py       # Weather data fetcher
│
├── templates/
│   ├── dashboard.html          # Main UI
│   └── logs.html               # Analytics & Gallery
│
├── static/
│   ├── js/
│   │   ├── dashboard.js        # Live updates & UI logic
│   │   ├── upload.js           # Drag-drop upload
│   │   ├── chat.js             # AI chat UI
│   │   ├── relay.js            # Relay control
│   │   └── weather.js          # Weather map integration
│   ├── uploads/                # Stored captured images
│
├── database/agrisight.db       # SQLite storage
├── firmware/esp32_cam.ino      # ESP32 relay control firmware
├── requirements.txt
├── README.md
└── .env.example
```

---

## 🧠 AI Integration

### 🔹 Disease Detection

* API: [Crop.Health by Kindwise](https://crop.kindwise.com )
* Input: base64-encoded leaf image
* Output:

  ```json
  {
    "disease": "Tomato blight",
    "confidence": 0.92,
    "description": "Fungal infection. Use copper fungicide."
  }
  ```

### 🔹 AI Chat (OpenRouter)

* Model: `anthropic/claude-3.5-sonnet`
* Endpoint:

  ```
  POST https://openrouter.ai/api/v1/chat/completions 
  ```
* Example system prompt:

  > “You are an experienced agronomist and plant pathologist.
  > Provide safe, clear advice in steps with organic, chemical, and prevention methods.”

---

## 💾 Database Schema

| Table     | Purpose                          | Key Columns                         |
| --------- | -------------------------------- | ----------------------------------- |
| `sensors` | Stores periodic sensor data      | ts, moisture, temperature, humidity |
| `scans`   | Stores disease detection results | ts, image_path, disease, confidence |
| `chats`   | Stores AI chat interactions      | ts, scan_id, user_msg, ai_reply     |
| `actions` | Stores relay control history     | ts, action_type, data               |

---

## 🧰 Technology Stack

| Layer         | Tech                                      |
| ------------- | ----------------------------------------- |
| **Frontend**  | HTML5, Tailwind CSS, Chart.js, Leaflet.js |
| **Backend**   | Flask (Python), SQLite                    |
| **AI Layer**  | Claude 3.5 via OpenRouter                 |
| **IoT Layer** | ESP32-CAM + DHT22 + Soil Moisture + Relay |
| **APIs**      | Crop.Health, OpenWeatherMap               |
| **Database**  | SQLite (local persistence)                |

---

## 🧪 Local Setup

```bash
git clone AgriSight_Full
cd AgriSight_Full

# setup environment
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# copy keys
cp .env.example .env
# fill your API keys

# run server
python app.py
```

Open → [http://localhost:5000](http://localhost:5000)

---

## 🧱 ESP32 Firmware Summary

* Connects to WiFi.
* Hosts REST endpoint:

  ```
  POST /control/relay
  { "state": "on" }
  ```
* Toggles GPIO pin for pump relay.
* Logs actions in terminal (for debugging).
* Can be extended to include camera capture and sensor read endpoints:

  * `/capture` → returns Base64 image
  * `/read/soil`
  * `/read/dht`

---

## 🧭 Future Extensions

* 📦 Export reports as PDF
* 📡 MQTT support for real-time sensor streaming
* 📱 PWA (Progressive Web App) mode
* 🕵️‍♂️ Disease trend prediction using local ML model
* ☁️ Cloud sync (optional)

---

## 🏁 Summary

| Feature                 | Description                                     |
| ----------------------- | ----------------------------------------------- |
| 🌱 IoT Sensor Dashboard | Live soil & climate readings                    |
| 📸 ESP32-CAM Capture    | Real image uploads with timestamps              |
| 🧠 Disease AI           | Crop.Health image classification                |
| 💬 AI Agronomist        | Chat powered by Claude 3.5                      |
| 💧 Smart Pump           | ESP32 relay control from dashboard              |
| 🌦️ Weather Integration | Auto + manual geo weather data                  |
| 📊 Analytics            | Charts + history with image thumbnails          |
| 💾 Local Storage        | SQLite database persistence                     |
| 🧱 Modular Codebase     | Separated logic: utils/, static/js/, templates/ |
| 🔒 Offline Mode         | Works without cloud (optional APIs)             |

---

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Clone the repository
git clone <your-repo-url>
cd AgriSight_Full

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
```

### 2. Configure API Keys

Edit `.env` file with your API keys:

```env
# API Keys
CROP_HEALTH_API_KEY=your-crop-health-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
OPENWEATHER_API_KEY=your-openweather-api-key

# ESP32 Configuration
ESP32_IP=192.168.1.100
ESP32_PORT=80
```

### 3. Run the Application

```bash
python app.py
```

### 4. Setup ESP32

1. Install Arduino IDE
2. Install ESP32 board package
3. Upload `firmware/esp32_cam.ino` to your ESP32-CAM
4. Update WiFi credentials in the firmware

---

## 📖 API Documentation

### Sensor Data
- `GET /api/sensors` - Get latest sensor readings
- `POST /api/sensors` - Store sensor data from ESP32

### Image Upload & Analysis
- `POST /api/upload` - Upload plant image
- `POST /api/analyze` - Analyze image for diseases

### AI Chat
- `POST /api/chat` - Chat with AI agronomist

### Control Systems
- `POST /api/relay` - Control water pump relay
- `GET /api/weather` - Get weather data

### Data Management
- `GET /api/gallery` - Get all scanned images
- `GET /api/actions` - Get system action logs
- `DELETE /api/delete_scan/<id>` - Delete specific scan

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 🆘 Support

For support, please:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed description

---

## 🙏 Acknowledgments

- [Crop.Health API](https://crop.kindwise.com) for plant disease identification
- [OpenRouter](https://openrouter.ai) for AI model access
- [Tailwind CSS](https://tailwindcss.com) for styling
- [Chart.js](https://chartjs.org) for data visualization
- [Leaflet](https://leafletjs.com) for mapping functionality