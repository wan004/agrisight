from flask import Blueprint, request, jsonify
from datetime import datetime
import requests

from utils.db import get_db_connection
from utils.esp_helper import send_relay_command
from utils.telegram_helper import tg_send
from config import Config

relay_bp = Blueprint('relay', __name__)


# ---------------------------------------------------------
# RELAY CONTROL ENDPOINT
# /api/relay → { action: "on" | "off" | "status" }
# ---------------------------------------------------------
@relay_bp.route('/api/relay', methods=['POST'])
def control_relay():
    try:
        data = request.get_json()
        action = data.get('action')  # 'on', 'off', or 'status'

        # -----------------------------------
        # 1️⃣ STATUS REQUEST (dashboard polling)
        # -----------------------------------
        if action == "status":
            try:
                esp_url = f"http://{Config.ESP32_IP}:{Config.ESP32_PORT}/relay/status"
                r = requests.get(esp_url, timeout=4)

                if r.status_code == 200:
                    state = r.json().get("state", "off")
                    return jsonify({"success": True, "state": state})
                else:
                    return jsonify({"success": False, "state": "off"})
            except Exception as e:
                print("Relay status error:", e)
                return jsonify({"success": False, "state": "off"})

        # -----------------------------------
        # 2️⃣ ON / OFF COMMAND TO ESP32
        # -----------------------------------
        esp_ok = send_relay_command(action)

        #  Log the action
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO actions (timestamp, action_type, data)
            VALUES (?, ?, ?)
        ''', (
            datetime.now(),
            'relay_control',
            f'pump_{action}'
        ))
        conn.commit()
        conn.close()

        # -----------------------------------
        # 3️⃣ Telegram Notifications
        # -----------------------------------
        try:
            if esp_ok:
                if action == "on":
                    tg_send("💧 Pump turned ON")
                elif action == "off":
                    tg_send("🛑 Pump turned OFF")
        except:
            pass

        return jsonify({"success": esp_ok})

    except Exception as e:
        return jsonify({"error": str(e), "success": False}), 500
