// Weather functionality
class WeatherManager {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeMap();
    }

    setupEventListeners() {
        const getWeatherBtn = document.getElementById('get-weather-btn');
        const useLocationBtn = document.getElementById('use-location-btn');
        const cityInput = document.getElementById('city-input');

        getWeatherBtn.addEventListener('click', () => {
            const city = cityInput.value.trim();
            if (city) {
                this.getWeatherByCity(city);
            }
        });

        useLocationBtn.addEventListener('click', () => {
            this.getCurrentLocationWeather();
        });

        // Enter key in city input
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                getWeatherBtn.click();
            }
        });
    }

    async getWeatherByCity(city) {
        try {
            this.showWeatherLoading();
            
            const response = await fetch(`/api/weather/city?q=${encodeURIComponent(city)}`);
            
            if (response.ok) {
                const weatherData = await response.json();
                this.displayWeatherData(weatherData);
                this.updateMapLocation(weatherData.coordinates.lat, weatherData.coordinates.lon);
            } else {
                this.showWeatherError('City not found. Please try again.');
            }
            
        } catch (error) {
            console.error('Weather API error:', error);
            this.showWeatherError('Failed to fetch weather data. Please try again.');
        }
    }

    async getCurrentLocationWeather() {
        if (!navigator.geolocation) {
            this.showWeatherError('Geolocation is not supported by this browser.');
            return;
        }

        this.showWeatherLoading();

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                this.userLocation = { lat, lon };
                
                try {
                    const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
                    
                    if (response.ok) {
                        const weatherData = await response.json();
                        this.displayWeatherData(weatherData);
                        this.updateMapLocation(lat, lon);
                    } else {
                        this.showWeatherError('Failed to fetch weather data for your location.');
                    }
                    
                } catch (error) {
                    console.error('Weather API error:', error);
                    this.showWeatherError('Failed to fetch weather data. Please try again.');
                }
            },
            (error) => {
                let errorMessage = 'Unable to get your location.';
                
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied by user.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'Location request timed out.';
                        break;
                }
                
                this.showWeatherError(errorMessage);
            }
        );
    }

    displayWeatherData(data) {
        const weatherDisplay = document.getElementById('weather-display');
        
        // Show weather display
        weatherDisplay.classList.remove('hidden');
        
        // Update weather information
        document.getElementById('weather-temp').textContent = `${Math.round(data.temperature)}°`;
        document.getElementById('weather-desc').textContent = this.capitalizeFirst(data.description);
        document.getElementById('weather-location').textContent = `${data.location}, ${data.country}`;
        document.getElementById('weather-humidity').textContent = `${data.humidity}%`;
        document.getElementById('weather-wind').textContent = `${data.wind_speed} m/s`;
        
        // Add agricultural interpretation
        this.addAgriculturalAdvice(data);
    }

    addAgriculturalAdvice(weatherData) {
        const advice = this.interpretWeatherForAgriculture(weatherData);
        
        // Create or update advice element
        let adviceElement = document.getElementById('weather-advice');
        if (!adviceElement) {
            adviceElement = document.createElement('div');
            adviceElement.id = 'weather-advice';
            adviceElement.className = 'mt-4 p-3 bg-blue-50 rounded-lg';
            document.getElementById('weather-display').appendChild(adviceElement);
        }
        
        let adviceHtml = `<h4 class="font-semibold text-blue-800 mb-2">Agricultural Advice</h4>`;
        
        if (advice.advice.length > 0) {
            adviceHtml += '<ul class="text-sm text-blue-700 space-y-1">';
            advice.advice.forEach(item => {
                adviceHtml += `<li>• ${item}</li>`;
            });
            adviceHtml += '</ul>';
        } else {
            adviceHtml += '<p class="text-sm text-blue-700">Good conditions for most crops.</p>';
        }
        
        adviceElement.innerHTML = adviceHtml;
    }

    interpretWeatherForAgriculture(weatherData) {
        const temp = weatherData.temperature || 0;
        const humidity = weatherData.humidity || 0;
        const description = (weatherData.description || '').toLowerCase();
        const windSpeed = weatherData.wind_speed || 0;
        
        const advice = [];
        
        // Temperature advice
        if (temp < 5) {
            advice.push('⚠️ Protect sensitive crops from frost damage');
        } else if (temp > 35) {
            advice.push('🔥 Increase irrigation frequency, provide shade for sensitive crops');
        } else if (temp > 25 && temp < 35) {
            advice.push('☀️ Optimal growing conditions for most crops');
        }
        
        // Humidity advice
        if (humidity > 85) {
            advice.push('💧 High humidity - watch for fungal diseases, improve air circulation');
        } else if (humidity < 30) {
            advice.push('🏜️ Low humidity - increase watering frequency, consider mulching');
        }
        
        // Weather condition advice
        if (description.includes('rain')) {
            advice.push('🌧️ Reduce irrigation, ensure proper drainage to prevent waterlogging');
        } else if (description.includes('clear') || description.includes('sunny')) {
            advice.push('☀️ Normal irrigation schedule, monitor soil moisture');
        } else if (description.includes('cloud')) {
            advice.push('☁️ Reduced evaporation - adjust irrigation accordingly');
        }
        
        // Wind advice
        if (windSpeed > 8) {
            advice.push('💨 Secure loose materials, increase watering to compensate for evaporation');
        }
        
        // Pressure advice (if available)
        if (weatherData.pressure) {
            if (weatherData.pressure < 1000) {
                advice.push('📉 Low pressure - possible weather changes, monitor closely');
            }
        }
        
        return {
            current_conditions: `${Math.round(temp)}°C, ${humidity}% humidity, ${this.capitalizeFirst(description)}`,
            advice: advice
        };
    }

    initializeMap() {
        const mapContainer = document.getElementById('weather-map');
        
        // Initialize Leaflet map
        this.map = L.map(mapContainer).setView([40.7128, -74.0060], 10); // Default to NYC
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Add click handler for map
        this.map.on('click', (e) => {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;
            this.getWeatherByCoords(lat, lon);
            this.updateMapLocation(lat, lon);
        });
        
        // Show map
        mapContainer.classList.remove('hidden');
    }

    updateMapLocation(lat, lon) {
        if (this.map) {
            this.map.setView([lat, lon], 10);
            
            // Clear existing markers
            this.map.eachLayer((layer) => {
                if (layer instanceof L.Marker) {
                    this.map.removeLayer(layer);
                }
            });
            
            // Add new marker
            L.marker([lat, lon]).addTo(this.map)
                .bindPopup('Weather location')
                .openPopup();
        }
    }

    async getWeatherByCoords(lat, lon) {
        try {
            this.showWeatherLoading();
            
            const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
            
            if (response.ok) {
                const weatherData = await response.json();
                this.displayWeatherData(weatherData);
            } else {
                this.showWeatherError('Failed to fetch weather data for this location.');
            }
            
        } catch (error) {
            console.error('Weather API error:', error);
            this.showWeatherError('Failed to fetch weather data. Please try again.');
        }
    }

    showWeatherLoading() {
        const weatherDisplay = document.getElementById('weather-display');
        weatherDisplay.classList.remove('hidden');
        
        document.getElementById('weather-temp').innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        document.getElementById('weather-desc').textContent = 'Loading...';
        document.getElementById('weather-location').textContent = 'Please wait';
        document.getElementById('weather-humidity').textContent = '--';
        document.getElementById('weather-wind').textContent = '--';
    }

    showWeatherError(message) {
        const weatherDisplay = document.getElementById('weather-display');
        weatherDisplay.classList.remove('hidden');
        
        document.getElementById('weather-temp').textContent = '--';
        document.getElementById('weather-desc').textContent = 'Error';
        document.getElementById('weather-location').textContent = message;
        document.getElementById('weather-humidity').textContent = '--';
        document.getElementById('weather-wind').textContent = '--';
        
        // Remove any existing advice
        const adviceElement = document.getElementById('weather-advice');
        if (adviceElement) {
            adviceElement.remove();
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Get weather forecast
    async getWeatherForecast(lat, lon) {
        try {
            const response = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
            
            if (response.ok) {
                return await response.json();
            }
            
        } catch (error) {
            console.error('Forecast API error:', error);
        }
        
        return null;
    }

    // Integrate weather with irrigation recommendations
    async getIrrigationRecommendationWithWeather(sensorData) {
        let recommendation = {
            shouldIrrigate: false,
            duration: 0,
            reason: '',
            weatherConsiderations: []
        };

        // Get basic irrigation recommendation
        if (window.relayManager) {
            recommendation = window.relayManager.getIrrigationRecommendation(sensorData);
        }

        // Get weather data if available
        if (this.userLocation) {
            try {
                const weatherData = await this.getWeatherByCoords(
                    this.userLocation.lat, 
                    this.userLocation.lon
                );
                
                if (weatherData) {
                    const weatherAdvice = this.interpretWeatherForAgriculture(weatherData);
                    
                    // Adjust irrigation based on weather
                    if (weatherData.description && weatherData.description.includes('rain')) {
                        recommendation.shouldIrrigate = false;
                        recommendation.weatherConsiderations.push('Rain expected - skipping irrigation');
                    }
                    
                    if (weatherData.wind_speed > 10) {
                        recommendation.duration = Math.min(recommendation.duration * 1.5, 300000); // Max 5 minutes
                        recommendation.weatherConsiderations.push('High winds - increasing irrigation time');
                    }
                    
                    recommendation.weatherConsiderations = recommendation.weatherConsiderations.concat(weatherAdvice.advice);
                }
            } catch (error) {
                console.error('Error getting weather for irrigation:', error);
            }
        }

        return recommendation;
    }
}

// Initialize weather manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.weatherManager = new WeatherManager();
});