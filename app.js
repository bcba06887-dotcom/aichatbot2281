// AI Chat Application for LM Studio
class AIChat {
    constructor() {
        this.API_URL = localStorage.getItem('apiUrl') || '';
        this.systemPrompt = localStorage.getItem('systemPrompt') || 'Ты полезный AI ассистент. Отвечай на русском языке, если пользователь пишет на русском.';
        this.temperature = parseFloat(localStorage.getItem('temperature')) || 0.7;
        this.maxTokens = parseInt(localStorage.getItem('maxTokens')) || 2048;
        this.currentModel = localStorage.getItem('currentModel') || 'liquid/lfm2.5-1.2b';

        this.messages = [];
        this.chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];
        this.currentChatId = null;
        this.isGenerating = false;

        this.initElements();
        this.initEventListeners();
        this.loadModels();
        this.renderChatHistory();
        this.checkConnection();
    }

    initElements() {
        // Main elements
        this.messagesContainer = document.getElementById('messagesContainer');
        this.messagesDiv = document.getElementById('messages');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.modelSelect = document.getElementById('modelSelect');

        // Sidebar elements
        this.sidebar = document.querySelector('.sidebar');
        this.menuToggle = document.getElementById('menuToggle');
        this.newChatBtn = document.getElementById('newChatBtn');
        this.chatHistoryDiv = document.getElementById('chatHistory');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Settings elements
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettings = document.getElementById('closeSettings');
        this.apiUrlInput = document.getElementById('apiUrl');
        this.systemPromptInput = document.getElementById('systemPrompt');
        this.temperatureInput = document.getElementById('temperature');
        this.tempValue = document.getElementById('tempValue');
        this.maxTokensInput = document.getElementById('maxTokens');
        this.saveSettingsBtn = document.getElementById('saveSettings');

        // Quick prompts
        this.quickPrompts = document.querySelectorAll('.quick-prompt');

        // Load saved settings
        this.apiUrlInput.value = this.API_URL;
        this.systemPromptInput.value = this.systemPrompt;
        this.temperatureInput.value = this.temperature;
        this.tempValue.textContent = this.temperature;
        this.maxTokensInput.value = this.maxTokens;
    }

    initEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 200) + 'px';
            this.sendBtn.disabled = !this.messageInput.value.trim() || this.isGenerating;
        });

        // Mobile menu toggle
        this.menuToggle.addEventListener('click', () => {
            this.sidebar.classList.toggle('open');
        });

        // New chat
        this.newChatBtn.addEventListener('click', () => this.startNewChat());

        // Settings modal
        this.settingsBtn.addEventListener('click', () => {
            this.settingsModal.classList.add('active');
        });

        this.closeSettings.addEventListener('click', () => {
            this.settingsModal.classList.remove('active');
        });

        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.classList.remove('active');
            }
        });

        // Temperature slider
        this.temperatureInput.addEventListener('input', () => {
            this.tempValue.textContent = this.temperatureInput.value;
        });

        // Save settings
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // Quick prompts
        this.quickPrompts.forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.dataset.prompt;
                this.messageInput.value = prompt;
                this.sendBtn.disabled = false;
                this.messageInput.focus();
            });
        });

        // Model selection
        this.modelSelect.addEventListener('change', () => {
            this.currentModel = this.modelSelect.value;
            localStorage.setItem('currentModel', this.currentModel);
        });

        // Refresh models button
        this.refreshModelsBtn = document.getElementById('refreshModels');
        this.refreshModelsBtn.addEventListener('click', async () => {
            this.refreshModelsBtn.classList.add('spinning');
            await this.loadModels();
            await this.checkConnection();
            this.refreshModelsBtn.classList.remove('spinning');
        });

        // Close sidebar on mobile when clicking outside
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 &&
                !this.sidebar.contains(e.target) &&
                !this.menuToggle.contains(e.target)) {
                this.sidebar.classList.remove('open');
            }
        });
    }

    async loadModels() {
        try {
            this.modelSelect.innerHTML = '<option value="">Загрузка...</option>';

            const response = await fetch(`${this.API_URL}/v1/models`);
            const data = await response.json();

            this.modelSelect.innerHTML = '';

            if (data.data && data.data.length > 0) {
                data.data.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = model.id;
                    if (model.id === this.currentModel) {
                        option.selected = true;
                    }
                    this.modelSelect.appendChild(option);
                });

                // If current model not found in list, add it manually
                const modelExists = data.data.some(m => m.id === this.currentModel);
                if (!modelExists && this.currentModel) {
                    const option = document.createElement('option');
                    option.value = this.currentModel;
                    option.textContent = this.currentModel;
                    option.selected = true;
                    this.modelSelect.insertBefore(option, this.modelSelect.firstChild);
                }

                if (!this.currentModel && data.data.length > 0) {
                    this.currentModel = data.data[0].id;
                    localStorage.setItem('currentModel', this.currentModel);
                }
            } else {
                // No models loaded - use default
                this.modelSelect.innerHTML = `<option value="${this.currentModel}">${this.currentModel}</option>`;
            }
        } catch (error) {
            console.error('Error loading models:', error);
            // Use default model on error
            this.modelSelect.innerHTML = `<option value="${this.currentModel}">${this.currentModel}</option>`;
        }
    }

    async checkConnection() {
        try {
            const response = await fetch(`${this.API_URL}/v1/models`);
            if (response.ok) {
                this.connectionStatus.querySelector('.status-dot').classList.add('connected');
            } else {
                this.connectionStatus.querySelector('.status-dot').classList.remove('connected');
            }
        } catch (error) {
            this.connectionStatus.querySelector('.status-dot').classList.remove('connected');
        }
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content || this.isGenerating) return;

        this.isGenerating = true;
        this.sendBtn.disabled = true;
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Hide welcome screen
        this.welcomeScreen.classList.add('hidden');

        // Add user message
        this.messages.push({ role: 'user', content });
        this.renderMessage('user', content);

        // Create new chat if needed
        if (!this.currentChatId) {
            this.currentChatId = Date.now().toString();
            this.chatHistory.unshift({
                id: this.currentChatId,
                title: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
                messages: [...this.messages],
                createdAt: new Date().toISOString()
            });
            this.renderChatHistory();
        }

        // Show typing indicator
        const typingDiv = this.createTypingIndicator();
        this.messagesDiv.appendChild(typingDiv);
        this.scrollToBottom();

        try {
            const response = await fetch(`${this.API_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.currentModel,
                    messages: [
                        { role: 'system', content: this.systemPrompt },
                        ...this.messages
                    ],
                    temperature: this.temperature,
                    max_tokens: this.maxTokens,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Remove typing indicator
            typingDiv.remove();

            // Stream response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            const messageEl = this.createMessageElement('assistant', '');
            this.messagesDiv.appendChild(messageEl);
            const textEl = messageEl.querySelector('.message-text');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices?.[0]?.delta?.content || '';
                            if (content) {
                                assistantMessage += content;
                                textEl.innerHTML = this.formatMessage(assistantMessage);
                                this.scrollToBottom();
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            if (assistantMessage) {
                this.messages.push({ role: 'assistant', content: assistantMessage });
                this.saveCurrentChat();
            }

        } catch (error) {
            console.error('Error sending message:', error);
            typingDiv.remove();
            this.renderError('Ошибка подключения к LM Studio. Убедитесь, что сервер запущен на ' + this.API_URL);
        }

        this.isGenerating = false;
        this.sendBtn.disabled = !this.messageInput.value.trim();
        this.checkConnection();
    }

    createMessageElement(role, content) {
        const div = document.createElement('div');
        div.className = `message ${role}`;

        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const authorName = role === 'user' ? 'Вы' : 'AI';
        const avatarIcon = role === 'user'
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

        div.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">${authorName}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${this.formatMessage(content)}</div>
            </div>
        `;

        return div;
    }

    renderMessage(role, content) {
        const messageEl = this.createMessageElement(role, content);
        this.messagesDiv.appendChild(messageEl);
        this.scrollToBottom();
    }

    createTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-author">AI</span>
                </div>
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        return div;
    }

    renderError(message) {
        const div = document.createElement('div');
        div.className = 'error-message';
        div.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>${message}</span>
        `;
        this.messagesDiv.appendChild(div);
        this.scrollToBottom();
    }

    formatMessage(content) {
        // Escape HTML
        let formatted = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks
        formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic
        formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    startNewChat() {
        this.currentChatId = null;
        this.messages = [];
        this.messagesDiv.innerHTML = '';
        this.welcomeScreen.classList.remove('hidden');
        this.messageInput.focus();
        this.sidebar.classList.remove('open');

        // Update active state in history
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    loadChat(chatId) {
        const chat = this.chatHistory.find(c => c.id === chatId);
        if (!chat) return;

        this.currentChatId = chatId;
        this.messages = [...chat.messages];
        this.messagesDiv.innerHTML = '';
        this.welcomeScreen.classList.add('hidden');

        // Render all messages
        this.messages.forEach(msg => {
            this.renderMessage(msg.role, msg.content);
        });

        // Update active state
        document.querySelectorAll('.history-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === chatId);
        });

        this.sidebar.classList.remove('open');
    }

    saveCurrentChat() {
        const chatIndex = this.chatHistory.findIndex(c => c.id === this.currentChatId);
        if (chatIndex !== -1) {
            this.chatHistory[chatIndex].messages = [...this.messages];
            localStorage.setItem('chatHistory', JSON.stringify(this.chatHistory));
        }
    }

    deleteChat(chatId) {
        this.chatHistory = this.chatHistory.filter(c => c.id !== chatId);
        localStorage.setItem('chatHistory', JSON.stringify(this.chatHistory));

        if (this.currentChatId === chatId) {
            this.startNewChat();
        }

        this.renderChatHistory();
    }

    renderChatHistory() {
        const historyItems = this.chatHistory.map(chat => `
            <div class="history-item ${chat.id === this.currentChatId ? 'active' : ''}" data-id="${chat.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="history-item-text">${chat.title}</span>
                <button class="history-item-delete" data-id="${chat.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
        `).join('');

        this.chatHistoryDiv.innerHTML = `
            <div class="history-section-title">История чатов</div>
            ${historyItems || '<div style="padding: 16px; color: var(--text-muted); font-size: 0.85rem;">Нет сохранённых чатов</div>'}
        `;

        // Add event listeners
        this.chatHistoryDiv.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.history-item-delete')) {
                    this.loadChat(item.dataset.id);
                }
            });
        });

        this.chatHistoryDiv.querySelectorAll('.history-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteChat(btn.dataset.id);
            });
        });
    }

    saveSettings() {
        this.API_URL = this.apiUrlInput.value;
        this.systemPrompt = this.systemPromptInput.value;
        this.temperature = parseFloat(this.temperatureInput.value);
        this.maxTokens = parseInt(this.maxTokensInput.value);

        localStorage.setItem('apiUrl', this.API_URL);
        localStorage.setItem('systemPrompt', this.systemPrompt);
        localStorage.setItem('temperature', this.temperature.toString());
        localStorage.setItem('maxTokens', this.maxTokens.toString());

        this.settingsModal.classList.remove('active');

        // Update API URL display
        document.querySelector('.api-url').textContent = this.API_URL.replace('http://', '');

        // Reload models and check connection
        this.loadModels();
        this.checkConnection();
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new AIChat();
});
