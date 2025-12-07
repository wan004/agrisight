import os
import base64
import requests
from time import sleep
from datetime import datetime
from flask import Blueprint, request, jsonify

from config import Config
from utils.db import get_db_connection, add_scan
from utils.telegram_helper import tg_send, tg_send_photo
from utils.esp_helper import send_relay_command, capture_image
from utils.image_pipeline import process_image_pipeline
from utils.crop_health import identify_disease
from utils.router import classify as router_classify

telegram_bp = Blueprint("telegram", __name__)


# ---------------------------------------------------------
# TELEGRAM WEBHOOK
# ---------------------------------------------------------
@telegram_bp.route("/telegram/webhook", methods=["POST"])
def telegram_webhook():
    data = request.get_json()
    print("TELEGRAM UPDATE:", data)

    msg = data.get("message")
    if not msg:
        return jsonify({"status": "ignored"})

    chat_id = msg["chat"]["id"]
    text = msg.get("text", "")

    # Only allow your Telegram chat ID
    if str(chat_id) != str(Config.TELEGRAM_CHAT_ID):
        tg_send("⛔ Unauthorized user tried accessing AgriSight.")
        return jsonify({"status": "denied"})

    # If user uploads a photo
    if "photo" in msg:
        return process_telegram_photo(msg)

    # Commands
    if text.startswith("/start"):
        tg_send("🌱 AgriSight is online.\nUse /help for commands.")

    elif text.startswith("/help"):
        tg_send(
            "🌱 <b>AgriSight Commands</b>\n"
            "/status - latest sensor data\n"
            "/moisture - soil moisture\n"
            "/temp - temperature\n"
            "/humidity - humidity\n"
            "/pump_on - start pump\n"
            "/pump_off - stop pump\n"
            "/scan - capture + analyze leaf\n"
            "/ask &lt;question&gt; - ask AI",
            parse_mode="HTML"
        )


    elif text == "/status":
        send_sensor_status()

    elif text in ["/moisture"]:
        send_single_value("moisture", "🌱 Moisture")

    elif text in ["/temp", "/temperature"]:
        send_single_value("temperature", "🌡️ Temperature")

    elif text in ["/humidity"]:
        send_single_value("humidity", "💧 Humidity")

    elif text == "/pump_on":
        send_relay_command("on")
        tg_send("💧 Pump turned ON")

    elif text == "/pump_off":
        send_relay_command("off")
        tg_send("🛑 Pump turned OFF")

    elif text == "/scan":
        return process_full_scan()

    elif text.startswith("/ask"):
        return process_ai_chat(text)

    else:
        tg_send("❓ Unknown command. Use /help.")

    return jsonify({"status": "ok"})


# ---------------------------------------------------------
# AI Chat
# ---------------------------------------------------------
def process_ai_chat(text):
    try:
        parts = text.split(" ", 1)
        if len(parts) < 2:
            tg_send("❓ Usage: /ask <your question>")
            return jsonify({"error": "no question"})

        user_msg = parts[1].strip()
        tg_send("🤖 Thinking…")

        from utils.ai_helper import get_ai_response
        ai_reply = get_ai_response(user_msg)

        tg_send(f"💬 <b>AI Response</b>\n{ai_reply}", parse_mode="HTML")
        return jsonify({"ok": True})

    except Exception as e:
        tg_send("❌ AI error: " + str(e))
        return jsonify({"error": str(e)})


# ---------------------------------------------------------
# Helper: Single sensor value
# ---------------------------------------------------------
def send_single_value(col, label):
    conn = get_db_connection()
    row = conn.execute(f"SELECT {col} FROM sensors ORDER BY timestamp DESC LIMIT 1").fetchone()
    conn.close()

    if not row:
        tg_send("No data recorded yet.")
        return

    tg_send(f"{label}: {row[col]}")


# ---------------------------------------------------------
# Helper: Full sensor status
# ---------------------------------------------------------
def send_sensor_status():
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM sensors ORDER BY timestamp DESC LIMIT 1").fetchone()
    conn.close()

    if not row:
        tg_send("No sensor data yet.")
        return

    tg_send(
        f"🌱 <b>AgriSight Status</b>\n"
        f"Moisture: {row['moisture']}%\n"
        f"Temperature: {row['temperature']}°C\n"
        f"Humidity: {row['humidity']}%",
        parse_mode="HTML"
    )


# ---------------------------------------------------------
# /scan – Capture + Analyze (Unified)
# ---------------------------------------------------------
# ---------------------------------------------------------
# /scan – Trigger capture, wait, then analyze ONLY enhanced image
# ---------------------------------------------------------
def process_full_scan():
    tg_send("📸 Capturing image from ESP32…")

    # 1) Trigger ESP32 capture (does NOT enhance)
    ok = capture_image()
    if not ok:
        tg_send("❌ ESP32 failed to capture image.")
        return jsonify({"error": "capture_failed"})

    # 2) Wait for ESP32 → Flask /scan → SR → DB insert
    sleep(3)

    # 3) Fetch the last saved enhanced image from /api/gallery
    try:
        gallery = requests.get(f"{Config.TELEGRAM_SERVER_BASE}/api/gallery", timeout=5).json()

        if not gallery:
            tg_send("❌ No image found in gallery.")
            return jsonify({"error": "no_image"})

        latest = gallery[0]
        filename = latest["image_path"]
        enhanced_path = f"static/uploads/{filename}"

    except Exception as e:
        tg_send("❌ Could not load gallery.")
        return jsonify({"error": str(e)})

    # 🔥 4) Send the enhanced image to Telegram (JUST THIS, no re-enhance)
    tg_send_photo(enhanced_path, caption="📸 Enhanced image captured.")

    # 5) Router classification on enhanced image
    router_out = router_classify(enhanced_path)
    top_class = max(router_out, key=router_out.get)
    top_score = router_out[top_class]

    if top_class == "human" and top_score > 0.40:
        tg_send("🚫 Human detected. Please capture a leaf.")
        return jsonify({"status": "rejected"})

    plant_score = max(
        router_out.get("plant", 0),
        router_out.get("unhealthy_plant", 0),
        router_out.get("crop", 0),
    )

    if plant_score < 0.65:
        tg_send("⚠️ This does not appear to be a plant leaf.")
        return jsonify({"status": "not_plant"})

    # 6) Disease detection
    tg_send("🧠 Analyzing disease…")
    result = identify_disease(enhanced_path, "general")

    disease = result.get("disease", "Unknown")
    confidence = result.get("confidence", 0)

    # 7) DB save (scan already saved by Flask)
    scan_id = add_scan(os.path.basename(enhanced_path))

    # 8) Return final result to Telegram
    caption = (
        f"🌿 <b>Scan Result</b>\n"
        f"Disease: <b>{disease}</b>\n"
        f"Confidence: <b>{confidence*100:.1f}%</b>\n"
        f"Scan ID: <code>{scan_id}</code>"
    )

    tg_send_photo(enhanced_path, caption=caption, parse_mode="HTML")

    return jsonify({"success": True})


# ---------------------------------------------------------
# PROCESS USER TELEGRAM PHOTO (unchanged)
# ---------------------------------------------------------
def process_telegram_photo(msg):
    try:
        tg_send("📥 Image received. Processing…")

        file_id = msg["photo"][-1]["file_id"]
        tele_api = f"https://api.telegram.org/bot{Config.TELEGRAM_TOKEN}"

        file_info = requests.get(f"{tele_api}/getFile?file_id={file_id}").json()
        file_path = file_info["result"]["file_path"]

        file_bytes = requests.get(
            f"https://api.telegram.org/file/bot{Config.TELEGRAM_TOKEN}/{file_path}"
        ).content

        filename = f"tg_upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        upload_path = os.path.join("static/uploads", filename)

        with open(upload_path, "wb") as f:
            f.write(file_bytes)

        tg_send_photo(upload_path, caption="📸 Image received.")

        # Enhance
        tg_send("🔄 Enhancing image…")
        enhanced_path = process_image_pipeline(upload_path)

        # Router classification
        router_out = router_classify(enhanced_path)
        top_class = list(router_out.keys())[0]
        top_score = router_out[top_class]

        if top_class == "human" and top_score > 0.40:
            tg_send("🚫 Human detected.")
            tg_send_photo(enhanced_path, caption="⚠️ Human detected.")
            return jsonify({"status": "blocked"})

        plant_score = max(
            router_out.get("plant", 0),
            router_out.get("unhealthy_plant", 0),
            router_out.get("crop", 0)
        )

        if plant_score < 0.65:
            tg_send("⚠️ Not a plant.")
            tg_send_photo(enhanced_path, caption="⚠️ Not a plant.")
            return jsonify({"status": "blocked"})

        # Disease detection
        tg_send("🧠 Analyzing disease…")
        result = identify_disease(enhanced_path, "general")

        disease = result.get("disease", "Unknown")
        confidence = result.get("confidence", 0)

        scan_id = add_scan(os.path.basename(enhanced_path))

        caption = (
            f"🌿 <b>Analysis Result</b>\n"
            f"Disease: <b>{disease}</b>\n"
            f"Confidence: <b>{confidence*100:.1f}%</b>\n"
            f"Scan ID: <code>{scan_id}</code>"
        )

        tg_send_photo(enhanced_path, caption=caption, parse_mode="HTML")
        return jsonify({"success": True})

    except Exception as e:
        tg_send("❌ Error: " + str(e))
        return jsonify({"error": str(e)})
