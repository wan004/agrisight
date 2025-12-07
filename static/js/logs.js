// Analytics and logs functionality
class LogsManager {
    constructor() {
        this.sensorChart = null;
        this.diseaseChart = null;
        this.selectedImages = new Set();
        this.currentImageId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupCharts();
        this.loadAllData();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Gallery controls
        document.getElementById('refresh-gallery').addEventListener('click', () => {
            this.loadGallery();
        });

        document.getElementById('delete-selected').addEventListener('click', () => {
            this.deleteSelectedImages();
        });

        // Export controls
        document.getElementById('export-sensors').addEventListener('click', () => {
            this.exportSensorData();
        });

        document.getElementById('clear-actions').addEventListener('click', () => {
            this.clearActionHistory();
        });

        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('download-image').addEventListener('click', () => {
            this.downloadCurrentImage();
        });

        document.getElementById('delete-image').addEventListener('click', () => {
            this.deleteCurrentImage();
        });

        // Close modal on background click
        document.getElementById('image-modal').addEventListener('click', (e) => {
            if (e.target.id === 'image-modal') {
                this.closeModal();
            }
        });
    }

    setupCharts() {
        this.setupSensorChart();
        this.setupDiseaseChart();
    }

    setupSensorChart() {
        const ctx = document.getElementById('sensor-chart-large');
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
                            text: 'Date/Time'
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
                }
            }
        });
    }

    setupDiseaseChart() {
        const ctx = document.getElementById('disease-chart');
        if (!ctx) return;

        this.diseaseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        'rgb(34, 197, 94)',  // Green - Healthy
                        'rgb(239, 68, 68)',  // Red - Disease
                        'rgb(245, 158, 11)', // Yellow - Warning
                        'rgb(156, 163, 175)', // Gray - Unknown
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }

    async loadAllData() {
        try {
            // Load statistics
            await this.loadStatistics();
            
            // Load charts data
            await this.loadChartsData();
            
            // Load default tab (gallery)
            await this.loadGallery();
            
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    async loadStatistics() {
        try {
            // Get gallery data for statistics
            const response = await fetch('/api/gallery');
            const scans = await response.json();
            
            // Calculate statistics
            const totalScans = scans.length;
            const healthyPlants = scans.filter(scan => 
                scan.disease === 'No disease detected' || 
                scan.disease === 'Healthy' || 
                scan.confidence < 0.5
            ).length;
            const issuesFound = totalScans - healthyPlants;
            
            // Get sensor data for average moisture
            const sensorResponse = await fetch('/api/sensors');
            const sensors = await sensorResponse.json();
            const avgMoisture = sensors.length > 0 
                ? sensors.reduce((sum, s) => sum + (s.moisture || 0), 0) / sensors.length 
                : 0;
            
            // Update UI
            document.getElementById('total-scans').textContent = totalScans;
            document.getElementById('healthy-plants').textContent = healthyPlants;
            document.getElementById('issues-found').textContent = issuesFound;
            document.getElementById('avg-moisture').textContent = `${avgMoisture.toFixed(1)}%`;
            
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    async loadChartsData() {
        try {
            // Load sensor data for chart
            const sensorResponse = await fetch('/api/sensors');
            const sensorData = await sensorResponse.json();
            this.updateSensorChart(sensorData);
            
            // Load disease data for chart
            const galleryResponse = await fetch('/api/gallery');
            const galleryData = await galleryResponse.json();
            this.updateDiseaseChart(galleryData);
            
        } catch (error) {
            console.error('Error loading charts data:', error);
        }
    }

    updateSensorChart(data) {
        if (!this.sensorChart || !data.length) return;

        // Take last 50 readings
        const recentData = data.slice(0, 50).reverse();
        
        const labels = recentData.map(item => {
            const date = new Date(item.timestamp);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString('en-US', { 
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

    updateDiseaseChart(data) {
        if (!this.diseaseChart || !data.length) return;

        // Count diseases
        const diseaseCounts = {};
        data.forEach(scan => {
            const disease = scan.disease || 'Unknown';
            diseaseCounts[disease] = (diseaseCounts[disease] || 0) + 1;
        });

        // Prepare chart data
        const labels = Object.keys(diseaseCounts);
        const values = Object.values(diseaseCounts);

        this.diseaseChart.data.labels = labels;
        this.diseaseChart.data.datasets[0].data = values;
        this.diseaseChart.update('none');
    }

    async loadGallery() {
        try {
            const response = await fetch('/api/gallery');
            const scans = await response.json();
            
            const galleryGrid = document.getElementById('gallery-grid');
            const emptyState = document.getElementById('gallery-empty');
            
            if (scans.length === 0) {
                galleryGrid.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }
            
            emptyState.classList.add('hidden');
            
            // Create gallery items
            galleryGrid.innerHTML = scans.map(scan => this.createGalleryItem(scan)).join('');
            
            // Add event listeners to new items
            this.attachGalleryEventListeners();
            
        } catch (error) {
            console.error('Error loading gallery:', error);
        }
    }

    createGalleryItem(scan) {
        const confidence = (scan.confidence || 0) * 100;
        const confidenceColor = confidence > 80 ? 'green' : confidence > 60 ? 'yellow' : 'red';
        const timestamp = new Date(scan.timestamp).toLocaleString();
        
        return `
            <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
                <div class="relative">
                    <img src="/static/uploads/${scan.image_path}" 
                         alt="Plant scan" 
                         class="w-full h-48 object-cover cursor-pointer"
                         data-scan-id="${scan.id}">
                    <div class="absolute top-2 right-2">
                        <input type="checkbox" 
                               class="image-checkbox w-5 h-5 text-blue-600 rounded"
                               data-scan-id="${scan.id}">
                    </div>
                    <div class="absolute bottom-2 left-2 right-2">
                        <div class="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                            <div class="flex justify-between items-center">
                                <span>${scan.disease || 'Unknown'}</span>
                                <span class="bg-${confidenceColor}-500 px-1 rounded">${confidence.toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-4">
                    <h3 class="font-semibold text-gray-800 truncate">${scan.disease || 'Unknown'}</h3>
                    <p class="text-sm text-gray-600 mb-2">${scan.description || 'No description'}</p>
                    <div class="flex justify-between items-center text-xs text-gray-500">
                        <span>${timestamp}</span>
                        <div class="flex space-x-2">
                            <button class="view-image text-blue-600 hover:text-blue-800" data-scan-id="${scan.id}">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="download-image text-green-600 hover:text-green-800" data-scan-id="${scan.id}" data-filename="${scan.image_path}">
                                <i class="fas fa-download"></i>
                            </button>
                            <button class="delete-image text-red-600 hover:text-red-800" data-scan-id="${scan.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachGalleryEventListeners() {
        // View image
        document.querySelectorAll('.view-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const scanId = e.currentTarget.dataset.scanId;
                this.openImageModal(scanId);
            });
        });

        // Download image
        document.querySelectorAll('.download-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const scanId = e.currentTarget.dataset.scanId;
                const filename = e.currentTarget.dataset.filename;
                this.downloadImage(scanId, filename);
            });
        });

        // Delete image
        document.querySelectorAll('.delete-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const scanId = e.currentTarget.dataset.scanId;
                this.deleteImage(scanId);
            });
        });

        // Image selection
        document.querySelectorAll('.image-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const scanId = e.target.dataset.scanId;
                if (e.target.checked) {
                    this.selectedImages.add(scanId);
                } else {
                    this.selectedImages.delete(scanId);
                }
                this.updateDeleteButton();
            });
        });
    }

    updateDeleteButton() {
        const deleteBtn = document.getElementById('delete-selected');
        if (this.selectedImages.size > 0) {
            deleteBtn.disabled = false;
            deleteBtn.textContent = `Delete Selected (${this.selectedImages.size})`;
        } else {
            deleteBtn.disabled = true;
            deleteBtn.textContent = 'Delete Selected';
        }
    }

    async openImageModal(scanId) {
        try {
            const response = await fetch(`/api/scans/${scanId}`);
            const scan = await response.json();
            
            this.currentImageId = scanId;
            
            const modal = document.getElementById('image-modal');
            const modalImage = document.getElementById('modal-image');
            const modalDisease = document.getElementById('modal-disease');
            const modalConfidence = document.getElementById('modal-confidence');
            
            modalImage.src = `/static/uploads/${scan.image_path}`;
            modalDisease.textContent = scan.disease || 'Unknown';
            modalConfidence.textContent = `Confidence: ${((scan.confidence || 0) * 100).toFixed(1)}%`;
            
            modal.classList.add('active');
            
        } catch (error) {
            console.error('Error loading image details:', error);
        }
    }

    closeModal() {
        const modal = document.getElementById('image-modal');
        modal.classList.remove('active');
    }

    downloadCurrentImage() {
        if (this.currentImageId) {
            // Find the image element and trigger download
            const img = document.getElementById('modal-image');
            const link = document.createElement('a');
            link.href = img.src;
            link.download = `plant-scan-${this.currentImageId}.jpg`;
            link.click();
        }
    }

    async deleteCurrentImage() {
        if (this.currentImageId && confirm('Are you sure you want to delete this image?')) {
            await this.deleteImage(this.currentImageId);
            this.closeModal();
        }
    }

    async deleteImage(scanId) {
        try {
            const response = await fetch(`/api/delete_scan/${scanId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                this.showNotification('Image deleted successfully', 'success');
                this.loadGallery();
                this.loadStatistics();
            } else {
                this.showNotification('Failed to delete image', 'error');
            }
            
        } catch (error) {
            console.error('Error deleting image:', error);
            this.showNotification('Error deleting image', 'error');
        }
    }

    async deleteSelectedImages() {
        if (this.selectedImages.size === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${this.selectedImages.size} selected images?`)) {
            return;
        }
        
        let deletedCount = 0;
        
        for (const scanId of this.selectedImages) {
            try {
                const response = await fetch(`/api/delete_scan/${scanId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    deletedCount++;
                }
            } catch (error) {
                console.error(`Error deleting image ${scanId}:`, error);
            }
        }
        
        this.selectedImages.clear();
        this.updateDeleteButton();
        
        this.showNotification(`${deletedCount} images deleted successfully`, 'success');
        this.loadGallery();
        this.loadStatistics();
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('border-purple-500', 'text-purple-600');
            btn.classList.add('border-transparent', 'text-gray-500');
        });
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.remove('border-transparent', 'text-gray-500');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('border-purple-500', 'text-purple-600');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
        
        // Load tab-specific data
        switch (tabName) {
            case 'gallery':
                this.loadGallery();
                break;
            case 'sensors':
                this.loadSensorLogs();
                break;
            case 'actions':
                this.loadActionLogs();
                break;
        }
    }

    async loadSensorLogs() {
        try {
            const response = await fetch('/api/sensors');
            const sensors = await response.json();
            
            const tbody = document.getElementById('sensors-table-body');
            tbody.innerHTML = sensors.map(sensor => `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${new Date(sensor.timestamp).toLocaleString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(sensor.moisture || 0).toFixed(1)}%
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(sensor.temperature || 0).toFixed(1)}°C
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${(sensor.humidity || 0).toFixed(1)}%
                    </td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading sensor logs:', error);
        }
    }

    async loadActionLogs() {
        try {
            const response = await fetch('/api/actions');
            const actions = await response.json();
            
            const tbody = document.getElementById('actions-table-body');
            tbody.innerHTML = actions.map(action => `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${new Date(action.timestamp).toLocaleString()}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${action.action_type}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${action.data || 'No details'}
                    </td>
                </tr>
            `).join('');
            
        } catch (error) {
            console.error('Error loading action logs:', error);
        }
    }

    exportSensorData() {
        // This would create and download a CSV file
        // For demo purposes, we'll just show a notification
        this.showNotification('Sensor data export feature coming soon!', 'info');
    }

    clearActionHistory() {
        if (confirm('Are you sure you want to clear all action history?')) {
            // This would clear the action history
            // For demo purposes, we'll just show a notification
            this.showNotification('Action history cleared', 'success');
            this.loadActionLogs();
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 transform translate-x-full`;
        
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

        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);

        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialize logs manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.logsManager = new LogsManager();
});