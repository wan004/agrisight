from flask import Flask
import os
from config import Config
from utils.db import init_db

# Import Blueprints from routes package
from routes import (
    dashboard_bp,
    sensors_bp,
    scans_bp,
    chat_bp,
    relay_bp,
    weather_bp,
    gallery_bp,
    telegram_bp,
    config_bp
)


def create_app():
    # Create Flask app
    app = Flask(__name__)
    app.config.from_object(Config)

    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Initialize database (creates tables if not exist)
    init_db()

    # Register all blueprints
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(sensors_bp)
    app.register_blueprint(scans_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(relay_bp)
    app.register_blueprint(weather_bp)
    app.register_blueprint(gallery_bp)
    app.register_blueprint(telegram_bp)
    app.register_blueprint(config_bp)


    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)
