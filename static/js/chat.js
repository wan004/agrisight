// AI Chat functionality
class ChatManager {
    constructor() {
        this.currentDisease = '';
        this.currentCropType = 'general';
        this.chatHistory = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadWelcomeMessage();
    }

    setupEventListeners() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('chat-send');
        const chatContainer = document.getElementById('chat-container');

        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Send message on button click
        sendButton.addEventListener('click', () => {
            this.sendMessage();
        });
    }

    loadWelcomeMessage() {
        const welcomeMessage = {
            type: 'ai',
            content: "Hello! I'm your AI agronomist assistant. I can help you with:\n\n🌱 Plant disease identification\n💊 Treatment recommendations\n🛡️ Prevention strategies\n🌾 General agricultural advice\n\nFeel free to ask me any questions about your crops!"
        };
        
        this.addMessageToChat(welcomeMessage);
    }

    setDiseaseContext(disease, cropType) {
        this.currentDisease = disease;
        this.currentCropType = cropType;
        
        // Add context-aware welcome message
        if (disease && disease !== 'Unknown' && disease !== 'No disease detected') {
            const contextMessage = {
                type: 'ai',
                content: `I see your ${cropType} plant has been diagnosed with: **${disease}**\n\nI can help you with treatment options and prevention strategies. What would you like to know?`
            };
            this.addMessageToChat(contextMessage);
        }
    }

    async sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (!message) return;

        // Add user message to chat
        const userMessage = {
            type: 'user',
            content: message
        };
        
        this.addMessageToChat(userMessage);
        this.chatHistory.push(userMessage);
        
        // Clear input
        chatInput.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send to AI API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    disease_name: this.currentDisease,
                    crop_type: this.currentCropType,
                    scan_id: window.uploadManager ? window.uploadManager.getCurrentScanId() : null
                })
            });

            const result = await response.json();
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            if (result.response) {
                const aiMessage = {
                    type: 'ai',
                    content: result.response
                };
                
                this.addMessageToChat(aiMessage);
                this.chatHistory.push(aiMessage);
            } else {
                this.showError('Failed to get AI response. Please try again.');
            }
            
        } catch (error) {
            console.error('Chat error:', error);
            this.removeTypingIndicator();
            this.showError('Sorry, I encountered an error. Please try again.');
        }
    }

    addMessageToChat(message) {
        const chatContainer = document.getElementById('chat-container');
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `mb-4 ${message.type === 'user' ? 'text-right' : 'text-left'}`;
        
        const messageBubble = document.createElement('div');
        messageBubble.className = `inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
            message.type === 'user' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 text-gray-800'
        }`;
        
        // Format message content (support basic markdown)
        let formattedContent = message.content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
        
        messageBubble.innerHTML = formattedContent;
        messageDiv.appendChild(messageBubble);
        
        chatContainer.appendChild(messageDiv);
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    showTypingIndicator() {
        const chatContainer = document.getElementById('chat-container');
        
        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'mb-4 text-left';
        
        const typingBubble = document.createElement('div');
        typingBubble.className = 'inline-block px-4 py-2 rounded-lg bg-gray-200 text-gray-800';
        typingBubble.innerHTML = `
            <div class="flex items-center space-x-1">
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
        `;
        
        typingDiv.appendChild(typingBubble);
        chatContainer.appendChild(typingDiv);
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    removeTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    showError(message) {
        const errorMessage = {
            type: 'ai',
            content: `⚠️ ${message}`
        };
        
        this.addMessageToChat(errorMessage);
    }

    clearChat() {
        const chatContainer = document.getElementById('chat-container');
        chatContainer.innerHTML = '';
        this.chatHistory = [];
        this.loadWelcomeMessage();
    }

    // Quick action buttons for common questions
    addQuickActionButtons() {
        const quickActions = [
            { text: 'Treatment options', query: 'What are the treatment options for this disease?' },
            { text: 'Prevention', query: 'How can I prevent this disease in the future?' },
            { text: 'Organic solutions', query: 'What organic treatments are available?' },
            { text: 'Chemical options', query: 'What chemical treatments do you recommend?' }
        ];

        const chatContainer = document.getElementById('chat-container');
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'mb-4 flex flex-wrap gap-2';

        quickActions.forEach(action => {
            const button = document.createElement('button');
            button.className = 'bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm hover:bg-purple-200 transition';
            button.textContent = action.text;
            button.addEventListener('click', () => {
                document.getElementById('chat-input').value = action.query;
                this.sendMessage();
            });
            actionsDiv.appendChild(button);
        });

        chatContainer.appendChild(actionsDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Method to get chat history for a specific scan
    async loadChatHistory(scanId) {
        try {
            const response = await fetch(`/api/chats/${scanId}`);
            const history = await response.json();
            
            this.clearChat();
            
            history.forEach(message => {
                const chatMessage = {
                    type: 'user',
                    content: message.user_message
                };
                const aiResponse = {
                    type: 'ai',
                    content: message.ai_response
                };
                
                this.addMessageToChat(chatMessage);
                this.addMessageToChat(aiResponse);
            });
            
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
    }
}

// Initialize chat manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatManager = new ChatManager();
});