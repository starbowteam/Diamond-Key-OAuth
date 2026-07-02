// diamkey-chats.js — управление чатами DiamKey
function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    const chatListContainer = document.getElementById('chatListContainer');
    const chatSearchInput = document.getElementById('chatSearchInput');
    const chatViewPanel = document.getElementById('chatViewPanel');
    const noChatSelected = document.getElementById('noChatSelected');
    const activeChatView = document.getElementById('activeChatView');
    const chatMessagesContainer = document.getElementById('chatMessagesContainer');
    const chatMessageInput = document.getElementById('chatMessageInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderStatus = document.getElementById('chatHeaderStatus');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const callOverlay = document.getElementById('callOverlay');
    const callName = document.getElementById('callName');
    const callStatusText = document.getElementById('callStatusText');

    let currentChatLogin = null;

    // Функция для получения сообщений чата из localStorage
    function getChatMessages(login) {
        const key = `diamkey_chat_${currentUser.login}_${login}`;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    }

    // Функция для сохранения сообщений чата в localStorage
    function saveChatMessages(login, messages) {
        const key = `diamkey_chat_${currentUser.login}_${login}`;
        localStorage.setItem(key, JSON.stringify(messages));
    }

    // Функция для получения последнего сообщения
    function getLastMessage(login) {
        const messages = getChatMessages(login);
        if (messages.length === 0) {
            return { text: 'Нет сообщений', time: '' };
        }
        const lastMsg = messages[messages.length - 1];
        return {
            text: lastMsg.from === 'system' ? lastMsg.text : (lastMsg.from === 'me' ? 'Вы: ' : '') + lastMsg.text,
            time: lastMsg.time
        };
    }

    // Функция для отображения списка чатов
    function renderChatList(filterText = '') {
        if (!chatListContainer) return;
        const friends = getFriendsList();
        const lowerFilter = filterText.toLowerCase();
        const filtered = friends.filter(login => {
            if (!filterText) return true;
            return login.toLowerCase().includes(lowerFilter);
        });

        if (filtered.length === 0) {
            chatListContainer.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
                    <i class="fas fa-user-friends" style="font-size:32px; margin-bottom:12px;"></i>
                    <p>${friends.length === 0 ? 'У вас пока нет друзей. Добавьте друзей, чтобы начать общение.' : 'Чаты не найдены'}</p>
                </div>
            `;
            return;
        }

        chatListContainer.innerHTML = filtered.map(login => {
            const lastMsg = getLastMessage(login);
            const activeClass = currentChatLogin === login ? 'active' : '';
            const unreadCount = 0; // В будущем можно добавить счётчик непрочитанных
            return `
                <div class="chat-item ${activeClass}" onclick="selectChat('${login}')">
                    <div class="chat-item-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="chat-item-info">
                        <div class="chat-item-name">${escapeHtml(login)}</div>
                        <div class="chat-item-lastmsg">${escapeHtml(lastMsg.text)}</div>
                    </div>
                    <div class="chat-item-meta">
                        <div class="chat-item-time">${lastMsg.time}</div>
                        ${unreadCount > 0 ? `<div class="unread-badge">${unreadCount}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Функция выбора чата
    window.selectChat = function(login) {
        currentChatLogin = login;

        // Показываем активный чат
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';

        // Обновляем шапку чата
        chatHeaderName.textContent = login;
        chatHeaderStatus.textContent = 'В сети';
        chatHeaderStatus.className = 'chat-header-status online';
        chatHeaderAvatar.innerHTML = '<i class="fas fa-user"></i>';

        // Проверяем онлайн-статус
        isUserOnline(login).then(online => {
            if (online) {
                chatHeaderStatus.textContent = 'В сети';
                chatHeaderStatus.className = 'chat-header-status online';
            } else {
                chatHeaderStatus.textContent = 'Не в сети';
                chatHeaderStatus.className = 'chat-header-status offline';
            }
        });

        // Загружаем сообщения
        let messages = getChatMessages(login);

        // Если сообщений нет, добавляем системное сообщение
        if (messages.length === 0) {
            const systemMsg = getSystemMessage(login);
            messages.push(systemMsg);
            saveChatMessages(login, messages);
        }

        // Отображаем сообщения
        renderMessages(login, messages);

        // Обновляем список чатов
        renderChatList(chatSearchInput?.value || '');
    };

    // Функция отображения сообщений
    function renderMessages(login, messages) {
        if (!chatMessagesContainer) return;
        chatMessagesContainer.innerHTML = messages.map(msg => {
            if (msg.from === 'system') {
                return `<div class="chat-system-msg">${escapeHtml(msg.text)}</div>`;
            }
            const isMe = msg.from === 'me';
            return `
                <div class="message ${isMe ? 'sent' : 'received'}">
                    <div class="msg-avatar"><i class="fas fa-user"></i></div>
                    <div>
                        <div class="msg-content">${escapeHtml(msg.text)}</div>
                        <div class="msg-time">${msg.time}</div>
                    </div>
                </div>
            `;
        }).join('');
        // Прокручиваем вниз
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // Функция отправки сообщения
    function sendMessage() {
        if (!currentChatLogin) return;
        const text = chatMessageInput.value.trim();
        if (!text) return;

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messages = getChatMessages(currentChatLogin);
        messages.push({
            from: 'me',
            text: text,
            time: time
        });

        saveChatMessages(currentChatLogin, messages);
        renderMessages(currentChatLogin, messages);
        renderChatList(chatSearchInput?.value || '');

        chatMessageInput.value = '';
        chatMessageInput.focus();
    }

    // Обработчики событий
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
    }

    if (chatMessageInput) {
        chatMessageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    if (chatSearchInput) {
        chatSearchInput.addEventListener('input', function() {
            renderChatList(this.value);
        });
    }

    // Звонки (заглушки)
    window.startCall = function(type) {
        if (!currentChatLogin) return;
        callOverlay.style.display = 'flex';
        callName.textContent = currentChatLogin;
        callStatusText.textContent = type === 'voice' ? 'Голосовой вызов...' : 'Видеозвонок...';
    };

    window.endCall = function() {
        callOverlay.style.display = 'none';
    };

    // Инициализация
    renderChatList();

    // Если есть друзья, выбираем первого
    const friends = getFriendsList();
    if (friends.length > 0 && !currentChatLogin) {
        window.selectChat(friends[0]);
    }
}
