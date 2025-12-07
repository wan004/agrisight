from flask import Blueprint, request, jsonify
from utils.weather_helper import get_weather_data

weather_bp = Blueprint('weather', __name__)


# ---------------------------------------------------------
# GET WEATHER DATA
# /api/weather?lat=XX&lon=YY
# ---------------------------------------------------------
@weather_bp.route('/api/weather', methods=['GET'])
def get_weather():
    try:
        lat = request.args.get('lat')
        lon = request.args.get('lon')

        if not lat or not lon:
            return jsonify({'error': 'Location coordinates required'}), 400

        weather_data = get_weather_data(lat, lon)
        return jsonify(weather_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500
