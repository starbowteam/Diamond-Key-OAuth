// diamkey-chats.js — чаты DiamKey (только для друзей, симметричное хранение)
function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    const chatListContainer = document.getElementById('chatListContainer');
    const chatSearchInput = document.getElementById('chatSearchInput');
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

    // Симметричный ключ для чата между двумя пользователями
    function getChatKey(loginA, loginB) {
        const sorted = [loginA, loginB].sort();
        return `diamkey_chat_${sorted[0]}_${sorted[1]}`;
    }

    function getChatMessages(login) {
        const key = getChatKey(currentUser.login, login);
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    }

    function saveChatMessages(login, messages) {
        const key = getChatKey(currentUser.login, login);
        localStorage.setItem(key, JSON.stringify(messages));
    }

    function getLastMessage(login) {
        const messages = getChatMessages(login);
        if (messages.length === 0) return { text: 'Нет сообщений', time: '' };
        const last = messages[messages.length - 1];
        return {
            text: last.from === 'system' ? last.text : (last.from === 'me' ? 'Вы: ' : '') + last.text,
            time: last.time
        };
    }

    function renderChatList(filterText = '') {
        if (!chatListContainer) return;
        const friends = getFriendsList();
        const lowerFilter = filterText.toLowerCase();
        const filtered = friends.filter(login => !filterText || login.toLowerCase().includes(lowerFilter));

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
            return `
                <div class="chat-item ${activeClass}" onclick="window._selectChat('${login}')">
                    <div class="chat-item-avatar"><i class="fas fa-user"></i></div>
                    <div class="chat-item-info">
                        <div class="chat-item-name">${escapeHtml(login)}</div>
                        <div class="chat-item-lastmsg">${escapeHtml(lastMsg.text)}</div>
                    </div>
                    <div class="chat-item-meta">
                        <div class="chat-item-time">${lastMsg.time}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    window._selectChat = function(login) {
        currentChatLogin = login;
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';

        chatHeaderName.textContent = login;
        chatHeaderStatus.textContent = 'В сети';
        chatHeaderStatus.className = 'chat-header-status online';
        chatHeaderAvatar.innerHTML = '<i class="fas fa-user"></i>';

        isUserOnline(login).then(online => {
            chatHeaderStatus.textContent = online ? 'В сети' : 'Не в сети';
            chatHeaderStatus.className = 'chat-header-status ' + (online ? 'online' : 'offline');
        });

        let messages = getChatMessages(login);
        if (messages.length === 0) {
            const sysMsg = getSystemMessage(login);
            messages.push(sysMsg);
            saveChatMessages(login, messages);
        }

        renderMessages(login, messages);
        renderChatList(chatSearchInput?.value || '');
    };

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
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    function sendMessage() {
        if (!currentChatLogin) return;
        const text = chatMessageInput.value.trim();
        if (!text) return;

        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const messages = getChatMessages(currentChatLogin);
        messages.push({ from: 'me', text, time });
        saveChatMessages(currentChatLogin, messages);

        renderMessages(currentChatLogin, messages);
        renderChatList(chatSearchInput?.value || '');

        chatMessageInput.value = '';
        chatMessageInput.focus();
    }

    chatSendBtn?.addEventListener('click', sendMessage);
    chatMessageInput?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    chatSearchInput?.addEventListener('input', function() {
        renderChatList(this.value);
    });

    window.startCall = function(type) {
        if (!currentChatLogin) return;
        callOverlay.style.display = 'flex';
        callName.textContent = currentChatLogin;
        callStatusText.textContent = type === 'voice' ? 'Голосовой вызов...' : 'Видеозвонок...';
    };

    window.endCall = function() {
        callOverlay.style.display = 'none';
    };

    renderChatList();

    const friends = getFriendsList();
    if (friends.length > 0 && !currentChatLogin) {
        window._selectChat(friends[0]);
    }
}
