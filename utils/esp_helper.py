import requests
from config import Config

# -------------------------------------------------------
# BASE URL FOR ESP32
# -------------------------------------------------------
ESP_BASE = f"http://{Config.ESP32_IP}:{Config.ESP32_PORT}"

FLASK_BASE = f"http://{Config.FLASK_IP}:{Config.FLASK_PORT}"


# -------------------------------------------------------
# RELAY CONTROL
# -------------------------------------------------------
def send_relay_command(action):
    """
    action = "on" or "off"
    """
    try:
        url = f"{ESP_BASE}/relay/{action}"
        r = requests.post(url, timeout=5)

        if r.status_code == 200:
            print(f"[ESP] Relay {action.upper()} OK")
            return True

        print(f"[ESP] Relay {action} failed → {r.status_code}")
        return False

    except Exception as e:
        print("[ESP] Relay error:", e)
        return False



# -------------------------------------------------------
# CAMERA CAPTURE (ESP uploads to /scan automatically)
# -------------------------------------------------------
def capture_image():
    """
    Trigger ESP32-CAM capture.
    Image will be uploaded directly to Flask via /scan.
    """
    try:
        url = f"{ESP_BASE}/capture"
        r = requests.post(url, timeout=12)

        if r.status_code == 200:
            print("[ESP] Camera capture triggered")
            return True

        print("[ESP] Capture failed →", r.status_code)
        return False

    except Exception as e:
        print("[ESP] Camera trigger error:", e)
        return False



# -------------------------------------------------------
# SENSOR READ (DHT + Soil)
# -------------------------------------------------------
def read_sensors():
    """
    Step 1 → Trigger DHT & Soil readings on ESP32  
    Step 2 → ESP sends results to Flask /sensor  
    Step 3 → Fetch newest values from Flask database
    """

    # ------ Trigger DHT ------
    try:
        requests.post(f"{ESP_BASE}/read/dht", timeout=5)
        print("[ESP] DHT triggered")
    except Exception as e:
        print("[ESP] DHT trigger error:", e)

    # ------ Trigger Soil ------
    try:
        requests.post(f"{ESP_BASE}/read/soil", timeout=5)
        print("[ESP] Soil triggered")
    except Exception as e:
        print("[ESP] Soil trigger error:", e)

    # ------ Fetch newest sensor record from Flask ------
    try:
        r = requests.get(f"{FLASK_BASE}/api/sensors", timeout=6)
        data = r.json()

        if isinstance(data, list) and len(data) > 0:
            newest = data[0]     # first row = latest
            print("[FLASK] Latest sensor data:", newest)
            return newest

        print("[FLASK] No sensor rows found")
        return None

    except Exception as e:
        print("[FLASK] Fetch DB error:", e)
        return None



# -------------------------------------------------------
# ESP HEALTH CHECK
# -------------------------------------------------------
def check_esp32_connection():
    try:
        r = requests.get(f"{ESP_BASE}/", timeout=3)
        return r.status_code == 200
    except:
        return False



# -------------------------------------------------------
# STATUS FOR UI
# -------------------------------------------------------
def get_esp32_status():
    status = {
        "connected": check_esp32_connection(),
        "relay_status": "unknown",
        "last_sensor_data": None
    }

    # If connected, also fetch latest reading
    if status["connected"]:
        try:
            data = requests.get(f"{FLASK_BASE}/api/sensors", timeout=6).json()
            if len(data) > 0:
                status["last_sensor_data"] = data[0]
        except:
            pass

    return status
