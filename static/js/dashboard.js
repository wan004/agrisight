// Dashboard functionality
class DashboardManager {
    constructor() {
        this.sensorChart = null;
        this.updateInterval = null;
        this.init();
    }

    init() {
        this.setupSensorChart();
        this.startDataUpdates();
        this.setupEventListeners();
        this.loadInitialData();
    }

    setupSensorChart() {
        const ctx = document.getElementById('sensor-chart');
        if (!ctx) return;

        this.sensorChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Soil Moisture (%)',
                        data: [],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Temperature (°C)',
                        data: [],
                        borderColor: 'rgb(239, 68, 68)',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        tension: 0.1,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'Humidity (%)',
                        data: [],
                        borderColor: 'rgb(34, 197, 94)',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.1,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Percentage (%)'
                        },
                        min: 0,
                        max: 100
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Temperature (°C)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                        min: 0,
                        max: 50
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toFixed(1);
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }

    async loadInitialData() {
        try {
            // Load sensor data
            const sensorResponse = await fetch('/api/sensors');
            const sensorData = await sensorResponse.json();
            this.updateSensorChart(sensorData);
            
            // Load latest sensor values
            if (sensorData.length > 0) {
                const latest = sensorData[0];
                this.updateSensorDisplay(latest);
            }
            
            // Update ESP32 status
            await this.updateESP32Status();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    updateSensorChart(data) {
        if (!this.sensorChart || !data.length) return;

        // Take last 20 readings
        const recentData = data.slice(0, 20).reverse();
        
        const labels = recentData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        });

        const moistureData = recentData.map(item => item.moisture || 0);
        const temperatureData = recentData.map(item => item.temperature || 0);
        const humidityData = recentData.map(item => item.humidity || 0);

        this.sensorChart.data.labels = labels;
        this.sensorChart.data.datasets[0].data = moistureData;
        this.sensorChart.data.datasets[1].data = temperatureData;
        this.sensorChart.data.datasets[2].data = humidityData;
        
        this.sensorChart.update('none');
    }

    updateSensorDisplay(data) {
        // Update moisture
        const moisture = data.moisture || 0;
        document.getElementById('moisture-value').textContent = moisture.toFixed(1);
        document.getElementById('moisture-bar').style.width = `${moisture}%`;

        // Update temperature
        const temperature = data.temperature || 0;
        document.getElementById('temperature-value').textContent = temperature.toFixed(1);
        
        let tempStatus = '';
        if (temperature < 10) tempStatus = '❄️ Too cold';
        else if (temperature < 20) tempStatus = '🌡️ Cool';
        else if (temperature < 30) tempStatus = '☀️ Optimal';
        else if (temperature < 40) tempStatus = '🔥 Warm';
        else tempStatus = '🌋 Too hot';
        
        document.getElementById('temp-status').textContent = tempStatus;

        // Update humidity
        const humidity = data.humidity || 0;
        document.getElementById('humidity-value').textContent = humidity.toFixed(1);
        
        let humidityStatus = '';
        if (humidity < 30) humidityStatus = '🏜️ Too dry';
        else if (humidity < 50) humidityStatus = '☀️ Low humidity';
        else if (humidity < 70) humidityStatus = '🌤️ Optimal';
        else if (humidity < 90) humidityStatus = '☁️ High humidity';
        else humidityStatus = '💧 Too humid';
        
        document.getElementById('humidity-status').textContent = humidityStatus;

        // Update timestamp
        const now = new Date();
        document.getElementById('last-update').textContent = now.toLocaleTimeString();
    }

    async updateESP32Status() {
        try {
            // This would check ESP32 connection status
            // For now, we'll simulate it
            const isConnected = Math.random() > 0.3; // 70% chance of being connected
            
            const statusElement = document.getElementById('esp32-status');
            const indicator = statusElement.querySelector('.w-3');
            const text = statusElement.querySelector('span');
            
            if (isConnected) {
                indicator.className = 'w-3 h-3 bg-green-500 rounded-full pulse-animation';
                text.textContent = 'ESP32 Connected';
                text.className = 'text-sm text-gray-600';
            } else {
                indicator.className = 'w-3 h-3 bg-red-500 rounded-full';
                text.textContent = 'ESP32 Disconnected';
                text.className = 'text-sm text-gray-600';
            }
        } catch (error) {
            console.error('Error updating ESP32 status:', error);
        }
    }

    startDataUpdates() {
        // Update data every 30 seconds
        this.updateInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/sensors');
                const data = await response.json();
                this.updateSensorChart(data);
                
                if (data.length > 0) {
                    this.updateSensorDisplay(data[0]);
                }
                
                this.updateESP32Status();
            } catch (error) {
                console.error('Error updating sensor data:', error);
            }
        }, 30000);
    }

    setupEventListeners() {
        // Add any dashboard-specific event listeners here
        window.addEventListener('beforeunload', () => {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }
        });
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.sensorChart) {
            this.sensorChart.destroy();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});

// Utility functions for sensor data formatting
function formatSensorValue(value, unit = '') {
    if (value === null || value === undefined) return '--';
    return `${value.toFixed(1)}${unit}`;
}

function getMoistureColor(moisture) {
    if (moisture < 30) return 'text-red-600';
    if (moisture < 60) return 'text-yellow-600';
    return 'text-green-600';
}

function getTemperatureColor(temp) {
    if (temp < 10) return 'text-blue-600';
    if (temp > 35) return 'text-red-600';
    return 'text-green-600';
}

function getHumidityColor(humidity) {
    if (humidity < 40) return 'text-yellow-600';
    if (humidity > 80) return 'text-blue-600';
    return 'text-green-600';
}