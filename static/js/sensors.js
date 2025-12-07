// Sensor and ESP32-CAM control functionality
class SensorManager {
    constructor() {
        this.autoCaptureInterval = null;

        // Will be loaded dynamically from Flask
        this.ESP32_IP = null;
        this.ESP32_PORT = 80;

        this.loadConfig();
        this.init();
    }

    // -------------------------------------------------------
    // Load ESP32 and Flask config dynamically
    // -------------------------------------------------------
    async loadConfig() {
        try {
            const res = await fetch('/api/config');
            const cfg = await res.json();

            this.ESP32_IP = cfg.ESP32_IP;
            this.ESP32_PORT = cfg.ESP32_PORT || 80;

            console.log("✅ Loaded ESP32 config:", this.ESP32_IP, ":", this.ESP32_PORT);

        } catch (error) {
            console.error("❌ Failed to load config:", error);
            this.showNotification("Failed to load system config", "error");
        }
    }

    // -------------------------------------------------------
    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('read-soil-btn')?.addEventListener('click', () => {
            this.readSoilMoisture();
        });

        document.getElementById('read-dht-btn')?.addEventListener('click', () => {
            this.readDHTSensor();
        });

        document.getElementById('read-all-btn')?.addEventListener('click', () => {
            this.readAllSensors();
        });

        document.getElementById('auto-capture-btn')?.addEventListener('click', () => {
            this.captureImage();
        });

        document.getElementById('capture-interval')?.addEventListener('change', (e) => {
            this.setAutoCaptureInterval(parseInt(e.target.value));
        });
    }

    // Safety check for ESP32 IP
    ensureESP() {
        if (!this.ESP32_IP) {
            this.showNotification("ESP32 IP not loaded yet", "error");
            return false;
        }
        return true;
    }

    // -------------------------------------------------------
    // 🌱 Soil Moisture Reading
    // (Already via Flask → ESP32)
    // -------------------------------------------------------
    async readSoilMoisture() {
        this.showSensorStatus('Reading soil moisture...');

        try {
            const response = await fetch('/api/sensors/manual/soil', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('Soil moisture updated!', 'success');
                window.dashboardManager?.loadInitialData();
            } else {
                this.showNotification('Soil moisture read failed', 'error');
            }

        } catch (error) {
            console.error('Soil read error:', error);
            this.showNotification('Error communicating with server', 'error');
        } finally {
            this.hideSensorStatus();
        }
    }

    // -------------------------------------------------------
    // 🌡️ DHT Sensor Reading
    // Use Flask endpoint NOT direct ESP32
    // -------------------------------------------------------
    async readDHTSensor() {
        this.showSensorStatus('Reading temperature & humidity...');

        try {
            const response = await fetch('/api/sensors/manual/dht', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await response.json();

            if (result.success) {
                this.showNotification('DHT sensor updated!', 'success');
                window.dashboardManager?.loadInitialData();
            } else {
                this.showNotification('DHT sensor read failed', 'error');
            }

        } catch (error) {
            console.error('Error reading DHT sensor:', error);
            this.showNotification('Error communicating with server', 'error');
        } finally {
            this.hideSensorStatus();
        }
    }

    // -------------------------------------------------------
    // 📊 Read All Sensors
    // -------------------------------------------------------
    async readAllSensors() {
        this.showSensorStatus('Triggering all sensors...');

        try {
            await this.readSoilMoisture();
            await this.readDHTSensor();

            this.showNotification('All sensor readings triggered', 'success');

        } catch (error) {
            console.error('Error reading all sensors:', error);
            this.showNotification('Error triggering sensors', 'error');
        } finally {
            this.hideSensorStatus();
        }
    }

    // -------------------------------------------------------
    // 📸 Capture Image → Gallery → Analyze
    // -------------------------------------------------------
    async captureImage() {
        if (!this.ensureESP()) return;

        this.showCaptureStatus('Capturing image from ESP32-CAM...');

        try {
            // 1️⃣ Trigger ESP32 capture
            const response = await fetch(`http://${this.ESP32_IP}:${this.ESP32_PORT}/capture`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                this.showNotification('Failed to trigger ESP32 capture', 'error');
                this.hideCaptureStatus();
                return;
            }

            this.showNotification('ESP32 capture triggered', 'success');

            await new Promise(resolve => setTimeout(resolve, 3000));

            // 2️⃣ Fetch latest image from gallery
            const galleryResponse = await fetch('/api/gallery');
            const gallery = await galleryResponse.json();

            if (!gallery || gallery.length === 0) {
                this.showNotification('No image found in gallery', 'error');
                this.hideCaptureStatus();
                return;
            }

            const latestScan = gallery[0];
            const scanId = latestScan.id;
            const filename = latestScan.image_path || latestScan.filename;

            // 3️⃣ Analyze the image
            this.showCaptureStatus('Analyzing captured image...');

            const cropType = document.getElementById('crop-type')?.value || 'general';

            const analyzeResponse = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scan_id: scanId,
                    crop_type: cropType
                })
            });

            const result = await analyzeResponse.json();

            if (result.error) {
                this.showNotification(`Analysis failed: ${result.error}`, 'error');
                this.hideCaptureStatus();
                return;
            }

            this.showNotification('Image analyzed successfully!', 'success');
            this.updateDashboardAnalysis(filename, result);

            if (window.chatManager) {
                window.chatManager.setDiseaseContext(result.disease, cropType);
            }

        } catch (error) {
            console.error('Error during capture or analysis:', error);
            this.showNotification('Error communicating with ESP32 or AI', 'error');
        } finally {
            this.hideCaptureStatus();
        }
    }

    // -------------------------------------------------------
    // 🧠 Update Dashboard with Analysis Results
    // -------------------------------------------------------
    updateDashboardAnalysis(filename, result) {
        document.getElementById('analysis-results').classList.remove('hidden');

        document.getElementById('analysis-image').src =
            `/static/uploads/${filename}`;

        document.getElementById('disease-name').textContent = result.disease || 'Unknown';
        document.getElementById('confidence-value').textContent =
            `${(result.confidence * 100 || 0).toFixed(1)}%`;

        document.getElementById('disease-description').textContent =
            result.description || 'No description available';

        document.getElementById('confidence-bar').style.width =
            `${(result.confidence * 100 || 0).toFixed(1)}%`;
    }

    // -------------------------------------------------------
    // ⏱ Auto Capture
    // -------------------------------------------------------
    setAutoCaptureInterval(intervalSeconds) {
        if (this.autoCaptureInterval) {
            clearInterval(this.autoCaptureInterval);
            this.autoCaptureInterval = null;
        }

        if (intervalSeconds > 0) {
            this.autoCaptureInterval = setInterval(() => {
                this.captureImage();
            }, intervalSeconds * 1000);

            this.showNotification(
                `Auto-capture every ${this.formatInterval(intervalSeconds)}`,
                'info'
            );
        } else {
            this.showNotification('Auto-capture disabled', 'info');
        }
    }

    formatInterval(seconds) {
        if (seconds < 60) return `${seconds} seconds`;
        if (seconds < 3600) return `${seconds / 60} minutes`;
        return `${seconds / 3600} hours`;
    }

    // -------------------------------------------------------
    // UI Helpers
    // -------------------------------------------------------
    showSensorStatus(message) {
        const statusElement = document.getElementById('sensor-status');
        if (statusElement) {
            statusElement.querySelector('span').textContent = message;
            statusElement.classList.remove('hidden');
        }
    }

    hideSensorStatus() {
        const statusElement = document.getElementById('sensor-status');
        if (statusElement) statusElement.classList.add('hidden');
    }

    showCaptureStatus(message) {
        const statusElement = document.getElementById('capture-status');
        if (statusElement) {
            statusElement.querySelector('span').textContent = message;
            statusElement.classList.remove('hidden');
        }
    }

    hideCaptureStatus() {
        const statusElement = document.getElementById('capture-status');
        if (statusElement) statusElement.classList.add('hidden');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className =
            `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;

        switch (type) {
            case 'success':
                notification.classList.add('bg-green-600', 'text-white');
                notification.innerHTML = `<i class="fas fa-check-circle mr-2"></i>${message}`;
                break;
            case 'error':
                notification.classList.add('bg-red-600', 'text-white');
                notification.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i>${message}`;
                break;
            default:
                notification.classList.add('bg-blue-600', 'text-white');
                notification.innerHTML = `<i class="fas fa-info-circle mr-2"></i>${message}`;
        }

        document.body.appendChild(notification);

        setTimeout(() => notification.classList.remove('translate-x-full'), 100);
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sensorManager = new SensorManager();
});
