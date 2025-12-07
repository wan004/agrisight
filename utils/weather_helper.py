import requests
from config import Config

def get_weather_data(lat, lon):
    """
    Get weather data from OpenWeatherMap API
    """
    if not Config.OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured")
    
    params = {
        'lat': lat,
        'lon': lon,
        'appid': Config.OPENWEATHER_API_KEY,
        'units': 'metric'  # Use Celsius
    }
    
    try:
        response = requests.get(
            Config.OPENWEATHER_URL,
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            return {
                'temperature': data['main']['temp'],
                'humidity': data['main']['humidity'],
                'description': data['weather'][0]['description'],
                'pressure': data['main']['pressure'],
                'wind_speed': data['wind']['speed'],
                'location': data['name'],
                'country': data['sys']['country'],
                'timestamp': data['dt']
            }
        else:
            print(f"Weather API Error: {response.status_code} - {response.text}")
            raise Exception(f"Weather API request failed: {response.status_code}")
            
    except requests.exceptions.Timeout:
        raise Exception("Weather request timed out")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error: {e}")
    except Exception as e:
        raise Exception(f"Error getting weather data: {e}")

def get_weather_by_city(city_name):
    """
    Get weather data by city name
    """
    if not Config.OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured")
    
    params = {
        'q': city_name,
        'appid': Config.OPENWEATHER_API_KEY,
        'units': 'metric'
    }
    
    try:
        response = requests.get(
            'https://api.openweathermap.org/data/2.5/weather',
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            return {
                'temperature': data['main']['temp'],
                'humidity': data['main']['humidity'],
                'description': data['weather'][0]['description'],
                'pressure': data['main']['pressure'],
                'wind_speed': data['wind']['speed'],
                'location': data['name'],
                'country': data['sys']['country'],
                'coordinates': {
                    'lat': data['coord']['lat'],
                    'lon': data['coord']['lon']
                },
                'timestamp': data['dt']
            }
        else:
            raise Exception(f"Weather API request failed: {response.status_code}")
            
    except Exception as e:
        raise Exception(f"Error getting weather data: {e}")

def get_weather_forecast(lat, lon):
    """
    Get 5-day weather forecast
    """
    if not Config.OPENWEATHER_API_KEY:
        raise Exception("OpenWeatherMap API key not configured")
    
    params = {
        'lat': lat,
        'lon': lon,
        'appid': Config.OPENWEATHER_API_KEY,
        'units': 'metric'
    }
    
    try:
        response = requests.get(
            'https://api.openweathermap.org/data/2.5/forecast',
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Parse forecast data
            forecast = []
            for item in data['list']:
                forecast.append({
                    'datetime': item['dt_txt'],
                    'temperature': item['main']['temp'],
                    'humidity': item['main']['humidity'],
                    'description': item['weather'][0]['description'],
                    'pressure': item['main']['pressure'],
                    'wind_speed': item['wind']['speed']
                })
            
            return {
                'location': data['city']['name'],
                'forecast': forecast
            }
        else:
            raise Exception(f"Forecast API request failed: {response.status_code}")
            
    except Exception as e:
        raise Exception(f"Error getting forecast data: {e}")

def interpret_weather_for_agriculture(weather_data):
    """
    Interpret weather data for agricultural purposes
    """
    temp = weather_data.get('temperature', 0)
    humidity = weather_data.get('humidity', 0)
    description = weather_data.get('description', '').lower()
    wind_speed = weather_data.get('wind_speed', 0)
    
    advice = []
    
    # Temperature advice
    if temp < 5:
        advice.append("⚠️ Cold conditions - protect sensitive crops from frost")
    elif temp > 35:
        advice.append("⚠️ High temperatures - ensure adequate irrigation")
    elif temp > 25:
        advice.append("✅ Optimal growing conditions")
    
    # Humidity advice
    if humidity > 80:
        advice.append("⚠️ High humidity - watch for fungal diseases")
    elif humidity < 30:
        advice.append("⚠️ Low humidity - increase watering frequency")
    
    # Weather condition advice
    if 'rain' in description:
        advice.append("🌧️ Rain expected - reduce irrigation, watch for waterlogging")
    elif 'clear' in description:
        advice.append("☀️ Clear skies - normal irrigation schedule")
    elif 'cloud' in description:
        advice.append("☁️ Cloudy conditions - reduced evaporation")
    
    # Wind advice
    if wind_speed > 10:
        advice.append("💨 High winds - secure loose materials, increase watering")
    
    return {
        'current_conditions': f"{temp}°C, {humidity}% humidity, {description}",
        'agricultural_advice': advice
    }