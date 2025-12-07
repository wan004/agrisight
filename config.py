import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # ----------------------------
    # Flask settings
    # ----------------------------
    SECRET_KEY = os.environ.get('SECRET_KEY')

    # ----------------------------
    # API Keys
    # ----------------------------
    CROP_HEALTH_API_KEY = os.environ.get('CROP_HEALTH_API_KEY')
    KINDWISE_API_KEY = os.environ.get("KINDWISE_API_KEY") or CROP_HEALTH_API_KEY
    OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY')
    OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY')

    # ----------------------------
    # Kindwise API endpoints
    # ----------------------------
    KW_BASE = "https://crop.kindwise.com/api/v1"
    KW_IDENTIFY = f"{KW_BASE}/identification"
    KW_GET_RESULT = f"{KW_BASE}/identification/{{token}}"

    # ----------------------------
    # ESP32 settings
    # ----------------------------
    ESP32_IP = os.environ.get('ESP32_IP')
    ESP32_PORT = int(os.environ.get('ESP32_PORT', 80))

    # ----------------------------
    # Flask Server (for ESP32 callbacks)
    # ----------------------------
    FLASK_IP = os.environ.get("FLASK_IP")
    FLASK_PORT = int(os.environ.get("FLASK_PORT", 5000))

    # ----------------------------
    # Telegram Bot
    # ----------------------------
    TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
    TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

    # ----------------------------
    # Database
    # ----------------------------
    DATABASE_PATH = os.path.join('database', 'agrisight.db')

    # ----------------------------
    # Upload settings
    # ----------------------------
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB



    # ----------------------------
    # External API URLs
    # ----------------------------
    CROP_HEALTH_URL = 'https://crop.kindwise.com/api/v1/identification'
    OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
    OPENWEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'

    # ----------------------------
    # Supported Crop Types
    # ----------------------------
    CROP_TYPES = [
        'general', 'apple', 'apricot', 'avocado', 'banana', 'barley', 'beans',
        'bell_pepper', 'blackberry', 'blueberry', 'broccoli', 'cabbage', 'capsicum',
        'carrot', 'cauliflower', 'celery', 'cherry', 'chilli', 'citrus', 'coffee',
        'cucumber', 'currant', 'custard_apple', 'eggplant', 'elderberry', 'fig',
        'grape', 'grapefruit', 'guava', 'hazelnut', 'hop', 'kiwi', 'kohlrabi',
        'lemon', 'lettuce', 'lime', 'loquat', 'mandarin', 'mango', 'melon',
        'mulberry', 'nectarine', 'oat', 'okra', 'olive', 'onion', 'orange',
        'papaya', 'passion_fruit', 'peach', 'pear', 'peas', 'persimmon', 'physalis',
        'pineapple', 'plum', 'pomegranate', 'potato', 'quince', 'raspberry',
        'rice', 'rye', 'sorghum', 'strawberry', 'sugarcane', 'sweet_potato',
        'tangerine', 'tea', 'tomato', 'turnip', 'walnut', 'watermelon', 'wheat',
        'zucchini'
    ]
