// File upload functionality
class UploadManager {
    constructor() {
        this.currentScanId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const uploadBtn = document.getElementById('upload-btn');

        // Click to upload
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });
    }

    async handleFileUpload(file) {
        if (!this.validateFile(file)) {
            return;
        }

        try {
            this.showUploadProgress();
            
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.currentScanId = result.scan_id;
                this.showUploadSuccess(result.filename);
                await this.analyzeImage(result.scan_id);
            } else {
                this.showUploadError(result.error || 'Upload failed');
            }

        } catch (error) {
            console.error('Upload error:', error);
            this.showUploadError('Upload failed. Please try again.');
        }
    }

    validateFile(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const maxSize = 16 * 1024 * 1024; // 16MB

        if (!allowedTypes.includes(file.type)) {
            this.showUploadError('Please select a valid image file (JPG, PNG, GIF, WebP)');
            return false;
        }

        if (file.size > maxSize) {
            this.showUploadError('File size must be less than 16MB');
            return false;
        }

        return true;
    }

    showUploadProgress() {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <div class="text-center">
                <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-700 mb-2">Uploading...</h3>
                <p class="text-gray-500">Please wait while we process your image</p>
            </div>
        `;
    }

    showUploadSuccess(filename) {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <div class="text-center">
                <i class="fas fa-check-circle text-4xl text-green-600 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-700 mb-2">Upload Successful</h3>
                <p class="text-gray-500">Analyzing image for diseases...</p>
                <div class="mt-4">
                    <img src="/static/uploads/${filename}" alt="Uploaded plant" class="max-w-xs mx-auto rounded-lg shadow-md">
                </div>
            </div>
        `;
    }

    showUploadError(message) {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <div class="text-center">
                <i class="fas fa-exclamation-circle text-4xl text-red-600 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-700 mb-2">Upload Failed</h3>
                <p class="text-red-500">${message}</p>
                <button id="retry-upload" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                    Try Again
                </button>
            </div>
        `;

        document.getElementById('retry-upload').addEventListener('click', () => {
            this.resetUploadArea();
        });
    }

    resetUploadArea() {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
            <h3 class="text-lg font-medium text-gray-700 mb-2">Upload Plant Image</h3>
            <p class="text-gray-500 mb-4">Drag and drop or click to select</p>
            <input type="file" id="file-input" accept="image/*" class="hidden">
            <button id="upload-btn" class="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition">
                Choose File
            </button>
        `;
        
        // Re-attach event listeners
        this.setupEventListeners();
    }

    async analyzeImage(scanId) {
        try {
            const cropType = document.getElementById('crop-type').value || 'general';
            
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scan_id: scanId,
                    crop_type: cropType
                })
            });

            const result = await response.json();

            if (result.success) {
                this.displayAnalysisResults(result);
            } else {
                this.showAnalysisError(result.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Analysis error:', error);
            this.showAnalysisError('Analysis failed. Please try again.');
        }
    }

    displayAnalysisResults(result) {
        const resultsDiv = document.getElementById('analysis-results');
        const uploadArea = document.getElementById('upload-area');
        
        // Show results section
        resultsDiv.classList.remove('hidden');
        
        // Update image source (assuming we have the image path)
        const imagePath = uploadArea.querySelector('img');
        if (imagePath) {
            document.getElementById('analysis-image').src = imagePath.src;
        }
        
        // Update disease information
        document.getElementById('disease-name').textContent = result.disease || 'Unknown';
        document.getElementById('disease-description').textContent = result.description || 'No description available';
        
        // Update confidence
        const confidence = (result.confidence || 0) * 100;
        document.getElementById('confidence-value').textContent = `${confidence.toFixed(1)}%`;
        document.getElementById('confidence-bar').style.width = `${confidence}%`;
        
        // Color code confidence
        const confidenceBar = document.getElementById('confidence-bar');
        if (confidence > 80) {
            confidenceBar.className = 'bg-green-500 h-2 rounded-full transition-all duration-500';
        } else if (confidence > 60) {
            confidenceBar.className = 'bg-yellow-500 h-2 rounded-full transition-all duration-500';
        } else {
            confidenceBar.className = 'bg-red-500 h-2 rounded-full transition-all duration-500';
        }

        // Enable AI chat with disease context
        if (window.chatManager) {
            window.chatManager.setDiseaseContext(result.disease, result.plant_name || 'general');
        }

        this.showAnalysisComplete();
    }

    showAnalysisComplete() {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <div class="text-center">
                <i class="fas fa-microscope text-4xl text-green-600 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-700 mb-2">Analysis Complete</h3>
                <p class="text-gray-500">Results are displayed below. You can now chat with our AI for treatment advice.</p>
                <button id="new-analysis" class="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition">
                    Analyze Another Image
                </button>
            </div>
        `;

        document.getElementById('new-analysis').addEventListener('click', () => {
            this.resetUploadArea();
            document.getElementById('analysis-results').classList.add('hidden');
        });
    }

    showAnalysisError(message) {
        const uploadArea = document.getElementById('upload-area');
        uploadArea.innerHTML = `
            <div class="text-center">
                <i class="fas fa-exclamation-triangle text-4xl text-red-600 mb-4"></i>
                <h3 class="text-lg font-medium text-gray-700 mb-2">Analysis Failed</h3>
                <p class="text-red-500">${message}</p>
                <button id="retry-analysis" class="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                    Try Again
                </button>
            </div>
        `;

        document.getElementById('retry-analysis').addEventListener('click', () => {
            this.resetUploadArea();
        });
    }

    getCurrentScanId() {
        return this.currentScanId;
    }
}

// Initialize upload manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uploadManager = new UploadManager();
});