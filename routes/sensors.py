from flask import Blueprint, request, jsonify
from datetime import datetime
from utils.db import get_db_connection
from utils.telegram_helper import tg_send
from config import Config

sensors_bp = Blueprint('sensors', __name__)

# -----------------------------
# ESP32 → SENSOR PUSH ENDPOINT
# -----------------------------
@sensors_bp.route('/sensor', methods=['POST'])
def esp32_sensor_data():
    """Endpoint for ESP32 to send sensor data continuously."""
    try:
        data = request.get_json()
        moisture = data.get('moisture')
        temperature = data.get('temperature')
        humidity = data.get('humidity')

        # Get last recorded values
        conn = get_db_connection()
        last_row = conn.execute(
            'SELECT moisture, temperature, humidity FROM sensors '
            'ORDER BY timestamp DESC LIMIT 1'
        ).fetchone()

        last_data = dict(last_row) if last_row else {
            "moisture": None,
            "temperature": None,
            "humidity": None
        }

        # Merge new + old readings — keep old if new = None or -1
        merged_data = {
            "moisture": moisture if moisture not in [None, -1] else last_data["moisture"],
            "temperature": temperature if temperature not in [None, -1] else last_data["temperature"],
            "humidity": humidity if humidity not in [None, -1] else last_data["humidity"]
        }

        # Insert merged data
        conn.execute('''
            INSERT INTO sensors (timestamp, moisture, temperature, humidity)
            VALUES (?, ?, ?, ?)
        ''', (
            datetime.now(),
            merged_data["moisture"],
            merged_data["temperature"],
            merged_data["humidity"]
        ))
        conn.commit()
        conn.close()

        # Moisture alert via Telegram
        try:
            if merged_data["moisture"] is not None and merged_data["moisture"] < 20:
                tg_send(
                    f"⚠️ LOW MOISTURE ALERT\n"
                    f"Moisture: {merged_data['moisture']}%\n"
                    f"Your plant may need watering."
                )
        except:
            pass

        return jsonify({"status": "success", "data": merged_data})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# WEB UI — SENSOR API
# -----------------------------
@sensors_bp.route('/api/sensors', methods=['GET', 'POST'])
def sensor_data():
    if request.method == 'POST':
        data = request.get_json()

        conn = get_db_connection()
        conn.execute('''
            INSERT INTO sensors (timestamp, moisture, temperature, humidity)
            VALUES (?, ?, ?, ?)
        ''', (
            datetime.now(),
            data.get('moisture'),
            data.get('temperature'),
            data.get('humidity')
        ))
        conn.commit()
        conn.close()

        return jsonify({'status': 'success'})

    else:
        conn = get_db_connection()
        sensors = conn.execute('''
            SELECT * FROM sensors 
            ORDER BY timestamp DESC 
            LIMIT 100
        ''').fetchall()
        conn.close()

        return jsonify([dict(row) for row in sensors])


# -----------------------------
# MANUAL SENSOR READ — SOIL
# -----------------------------
@sensors_bp.route('/api/sensors/manual/soil', methods=['POST'])
def read_soil_manual():
    try:
        from utils.esp_helper import read_sensors
        sensor_data = read_sensors()

        if sensor_data and sensor_data.get('moisture') is not None:
            conn = get_db_connection()
            conn.execute('''
                INSERT INTO sensors (timestamp, moisture, temperature, humidity)
                VALUES (?, ?, ?, ?)
            ''', (
                datetime.now(),
                sensor_data['moisture'],
                sensor_data.get('temperature'),
                sensor_data.get('humidity')
            ))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'moisture': sensor_data['moisture'],
                    'temperature': sensor_data.get('temperature'),
                    'humidity': sensor_data.get('humidity'),
                    'timestamp': datetime.now()
                }
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to read from ESP32'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# -----------------------------
# MANUAL SENSOR READ — DHT (Temp + Humidity)
# -----------------------------
@sensors_bp.route('/api/sensors/manual/dht', methods=['POST'])
def read_dht_manual():
    try:
        from utils.esp_helper import read_sensors
        sensor_data = read_sensors()

        if sensor_data and sensor_data.get('temperature') is not None:
            conn = get_db_connection()
            conn.execute('''
                INSERT INTO sensors (timestamp, moisture, temperature, humidity)
                VALUES (?, ?, ?, ?)
            ''', (
                datetime.now(),
                sensor_data.get('moisture'),
                sensor_data['temperature'],
                sensor_data.get('humidity')
            ))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'moisture': sensor_data.get('moisture'),
                    'temperature': sensor_data['temperature'],
                    'humidity': sensor_data.get('humidity'),
                    'timestamp': datetime.now()
                }
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to read from ESP32'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# -----------------------------
# MANUAL SENSOR READ — ALL
# -----------------------------
@sensors_bp.route('/api/sensors/manual/all', methods=['POST'])
def read_all_sensors_manual():
    try:
        from utils.esp_helper import read_sensors
        sensor_data = read_sensors()

        if sensor_data:
            conn = get_db_connection()
            conn.execute('''
                INSERT INTO sensors (timestamp, moisture, temperature, humidity)
                VALUES (?, ?, ?, ?)
            ''', (
                datetime.now(),
                sensor_data.get('moisture'),
                sensor_data.get('temperature'),
                sensor_data.get('humidity')
            ))
            conn.commit()
            conn.close()

            return jsonify({
                'success': True,
                'data': {
                    'moisture': sensor_data.get('moisture'),
                    'temperature': sensor_data.get('temperature'),
                    'humidity': sensor_data.get('humidity'),
                    'timestamp': datetime.now()
                }
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to read from ESP32'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
