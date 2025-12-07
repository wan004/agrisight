from flask import Blueprint, jsonify
from config import Config

config_bp = Blueprint("config_bp", __name__)

@config_bp.route("/api/config")
def get_config():
    return jsonify({
        "ESP32_IP": Config.ESP32_IP,
        "ESP32_PORT": Config.ESP32_PORT,
        "FLASK_IP": Config.FLASK_IP,
        "FLASK_PORT": Config.FLASK_PORT
    })
