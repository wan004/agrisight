// Irrigation relay control functionality
class RelayManager {
    constructor() {
        this.isPumpOn = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPumpStatus();
    }

    setupEventListeners() {
        const pumpOnBtn = document.getElementById('pump-on-btn');
        const pumpOffBtn = document.getElementById('pump-off-btn');

        pumpOnBtn.addEventListener('click', () => {
            this.controlPump('on');
        });

        pumpOffBtn.addEventListener('click', () => {
            this.controlPump('off');
        });
    }

    async controlPump(action) {
        try {
            // Disable buttons during operation
            this.setButtonsEnabled(false);
            
            // Show loading state
            this.showOperationStatus(action, 'loading');

            const response = await fetch('/api/relay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action
                })
            });

            const result = await response.json();

            if (result.success) {
                this.isPumpOn = action === 'on';
                this.updatePumpStatus();
                this.showOperationStatus(action, 'success');
                
                // Log the action
                this.logPumpAction(action);
                
                // Show success notification
                this.showNotification(
                    action === 'on' ? 'Pump started successfully' : 'Pump stopped successfully',
                    'success'
                );
            } else {
                this.showOperationStatus(action, 'error');
                this.showNotification(
                    action === 'on' ? 'Failed to start pump' : 'Failed to stop pump',
                    'error'
                );
            }

        } catch (error) {
            console.error('Relay control error:', error);
            this.showOperationStatus(action, 'error');
            this.showNotification('Failed to communicate with pump', 'error');
        } finally {
            // Re-enable buttons
            this.setButtonsEnabled(true);
        }
    }

    updatePumpStatus() {
        const pumpStatus = document.getElementById('pump-status');
        const pumpText = document.getElementById('pump-text');

        if (this.isPumpOn) {
            pumpStatus.className = 'w-3 h-3 bg-green-500 rounded-full pulse-animation';
            pumpText.textContent = 'ON';
            pumpText.className = 'text-sm text-green-600 font-semibold';
        } else {
            pumpStatus.className = 'w-3 h-3 bg-red-500 rounded-full';
            pumpText.textContent = 'OFF';
            pumpText.className = 'text-sm text-gray-600';
        }
    }

    showOperationStatus(action, status) {
        const pumpOnBtn = document.getElementById('pump-on-btn');
        const pumpOffBtn = document.getElementById('pump-off-btn');

        // Reset button states
        pumpOnBtn.innerHTML = '<i class="fas fa-play"></i><span>Start</span>';
        pumpOffBtn.innerHTML = '<i class="fas fa-stop"></i><span>Stop</span>';

        if (status === 'loading') {
            const loadingBtn = action === 'on' ? pumpOnBtn : pumpOffBtn;
            loadingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Loading...</span>';
        }
    }

    setButtonsEnabled(enabled) {
        const pumpOnBtn = document.getElementById('pump-on-btn');
        const pumpOffBtn = document.getElementById('pump-off-btn');

        pumpOnBtn.disabled = !enabled;
        pumpOffBtn.disabled = !enabled;

        if (enabled) {
            pumpOnBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            pumpOffBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            pumpOnBtn.classList.add('opacity-50', 'cursor-not-allowed');
            pumpOffBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    async loadPumpStatus() {
        try {
            const response = await fetch('/api/relay', {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ action: "status" })
            });

            const result = await response.json();

            if (result.success && result.state) {
                this.isPumpOn = result.state === "on";
            } else {
                this.isPumpOn = false;
            }

            this.updatePumpStatus();

        } catch (error) {
            console.error("Pump status load error:", error);
            this.isPumpOn = false;
            this.updatePumpStatus();
        }
    }



    logPumpAction(action) {
        const timestamp = new Date().toLocaleString();
        const logEntry = {
            timestamp,
            action: `Pump ${action.toUpperCase()}`,
            user: 'User' // In a real app, this would be the logged-in user
        };

        // Store in localStorage for demo purposes
        let pumpLogs = JSON.parse(localStorage.getItem('pumpLogs') || '[]');
        pumpLogs.unshift(logEntry);
        
        // Keep only last 50 logs
        if (pumpLogs.length > 50) {
            pumpLogs = pumpLogs.slice(0, 50);
        }
        
        localStorage.setItem('pumpLogs', JSON.stringify(pumpLogs));
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
        
        // Set notification style based on type
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

        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Safety features
    autoStopPump(duration = 300000) { // 5 minutes default
        if (this.isPumpOn) {
            setTimeout(() => {
                if (this.isPumpOn) {
                    this.controlPump('off');
                    this.showNotification('Pump automatically stopped for safety', 'info');
                }
            }, duration);
        }
    }

    // Schedule irrigation
    scheduleIrrigation(duration, interval) {
        // This would integrate with a scheduling system
        // For demo purposes, we'll just log it
        console.log(`Irrigation scheduled: ${duration}ms every ${interval}ms`);
        
        // In a real system, this would set up cron jobs or timers
        // and integrate with weather data to skip irrigation if rain is expected
    }

    // Get irrigation recommendations based on sensor data
    getIrrigationRecommendation(sensorData) {
        const moisture = sensorData.moisture || 0;
        const temperature = sensorData.temperature || 0;
        const humidity = sensorData.humidity || 0;

        let recommendation = {
            shouldIrrigate: false,
            duration: 0,
            reason: ''
        };

        // Simple irrigation logic
        if (moisture < 30) {
            recommendation.shouldIrrigate = true;
            recommendation.duration = 60000; // 1 minute
            recommendation.reason = 'Soil moisture is critically low';
        } else if (moisture < 50 && temperature > 25) {
            recommendation.shouldIrrigate = true;
            recommendation.duration = 30000; // 30 seconds
            recommendation.reason = 'Low moisture with high temperature';
        } else if (humidity < 40 && temperature > 30) {
            recommendation.shouldIrrigate = true;
            recommendation.duration = 45000; // 45 seconds
            recommendation.reason = 'Low humidity with high temperature';
        } else {
            recommendation.reason = 'Soil conditions are adequate';
        }

        return recommendation;
    }
}

// Initialize relay manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.relayManager = new RelayManager();
});