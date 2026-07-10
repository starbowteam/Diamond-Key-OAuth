// diamkey-chats.js — чаты DiamKey (макетный стиль, все пользователи, мини-профиль)
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    const chatListContainer = document.getElementById('chatListContainer');
    const chatSearchInput = document.getElementById('chatSearchInput');
    const noChatSelected = document.getElementById('noChatSelected');
    const activeChatView = document.getElementById('activeChatView');
    const messagesContainer = document.getElementById('chatMessagesContainer');
    const messageInput = document.getElementById('chatMessageInput');
    const sendBtn = document.getElementById('chatSendBtn');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderStatus = document.getElementById('chatHeaderStatus');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const callOverlay = document.getElementById('callOverlay');
    const callName = document.getElementById('callName');
    const callStatusText = document.getElementById('callStatusText');
    const chatViewPanel = document.getElementById('chatViewPanel');

    let currentChatLogin = null;

    // Загрузка сообщений
    async function loadMessages(partner) {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('*')
            .or(`sender.eq.${currentUser.login},receiver.eq.${currentUser.login}`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Ошибка загрузки сообщений:', error);
            return [];
        }

        return (data || []).filter(msg =>
            (msg.sender === currentUser.login && msg.receiver === partner) ||
            (msg.sender === partner && msg.receiver === currentUser.login)
        );
    }

    async function sendMessageToSupabase(partner, text) {
        const { error } = await _supabase
            .from('chat_messages')
            .insert([{
                sender: currentUser.login,
                receiver: partner,
                message: text
            }]);

        if (error) {
            console.error('Ошибка отправки сообщения:', error);
            showToast('Ошибка отправки');
            return false;
        }
        return true;
    }

    async function getLastMessage(partner) {
        const messages = await loadMessages(partner);
        if (messages.length === 0) return { text: 'Нет сообщений', time: '' };
        const last = messages[messages.length - 1];
        if (last.sender === 'system') return { text: last.message, time: new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        const senderName = (last.sender === currentUser.login) ? 'Вы' : partner;
        return {
            text: `${senderName}: ${last.message}`,
            time: new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    }

    async function renderChatList(filterText = '') {
        if (!chatListContainer) return;
        const allUsers = await getUsers();
        const otherUsers = allUsers.filter(u => u.login !== currentUser.login);
        const lowerFilter = filterText.toLowerCase();
        const isTagSearch = lowerFilter.startsWith('@');
        const searchTerm = isTagSearch ? lowerFilter.slice(1) : lowerFilter;

        const filtered = otherUsers.filter(u => {
            if (!filterText) return true;
            if (isTagSearch) return u.login.toLowerCase().includes(searchTerm);
            return (u.name || u.login).toLowerCase().includes(searchTerm);
        });

        if (filtered.length === 0) {
            chatListContainer.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--text-muted);"><i class="fas fa-users" style="font-size:32px; margin-bottom:12px;"></i><p>Пользователи не найдены</p></div>`;
            return;
        }

        const items = await Promise.all(filtered.map(async (u) => {
            const lastMsg = await getLastMessage(u.login);
            const activeClass = currentChatLogin === u.login ? 'active' : '';
            return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
                <div class="chat-item-avatar">${u.avatar ? `<img src="${escapeHtml(u.avatar)}" alt="${u.login}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>'}</div>
                <div class="chat-item-info">
                    <div class="chat-item-name">${escapeHtml(u.name || u.login)}</div>
                    <div class="chat-item-last-msg">${escapeHtml(lastMsg.text)}</div>
                </div>
                <div class="chat-item-meta"><div class="chat-item-time">${lastMsg.time}</div></div>
            </div>`;
        }));
        chatListContainer.innerHTML = items.join('');
    }

    window._selectChat = async function(login) {
        currentChatLogin = login;
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';

        const profile = await getProfile(login);
        chatHeaderName.textContent = profile?.name || login;
        isUserOnline(login).then(online => {
            chatHeaderStatus.textContent = online ? 'В сети' : 'Не в сети';
            chatHeaderStatus.className = 'chat-header-status ' + (online ? 'online' : 'offline');
        });

        if (profile && profile.avatar) {
            chatHeaderAvatar.innerHTML = `<img src="${escapeHtml(profile.avatar)}" alt="${login}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            chatHeaderAvatar.innerHTML = '<i class="fas fa-user"></i>';
        }

        let messages = await loadMessages(login);

        if (messages.length === 0) {
            await _supabase.from('chat_messages').insert([{
                sender: 'system',
                receiver: login,
                message: `Это ваш чат с ${escapeHtml(profile?.name || login)}! Можете начинать свое общение.`
            }]);
            messages = await loadMessages(login);
        }

        renderMessages(login, messages);
        renderChatList(chatSearchInput?.value || '');
        markChatAsRead(login);
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(msg => {
            if (msg.sender === 'system') {
                return `<div class="chat-system-msg">${escapeHtml(msg.message)}</div>`;
            }
            const isMe = (msg.sender === currentUser.login);
            return `<div class="message ${isMe ? 'sent' : 'received'}">
                <div class="msg-avatar">${isMe ? avatarHTML(currentUser.avatar, 32) : `<img src="${escapeHtml(getCachedAvatar(login))}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><i class="fas fa-user" style="display:none;"></i>`}</div>
                <div>
                    <div class="msg-content">${escapeHtml(msg.message)}</div>
                    <div class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>`;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    const avatarCache = {};
    async function getCachedAvatar(login) {
        if (avatarCache[login]) return avatarCache[login];
        const profile = await getProfile(login);
        avatarCache[login] = profile?.avatar || '';
        return avatarCache[login];
    }

    async function sendMessage() {
        if (!currentChatLogin) return;
        const text = messageInput.value.trim();
        if (!text) return;

        const ok = await sendMessageToSupabase(currentChatLogin, text);
        if (!ok) return;

        messageInput.value = '';
        const messages = await loadMessages(currentChatLogin);
        renderMessages(currentChatLogin, messages);
        renderChatList(chatSearchInput?.value || '');
        messageInput.focus();
    }

    sendBtn?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    chatSearchInput?.addEventListener('input', function() {
        renderChatList(this.value);
    });

    // Мини-профиль (как в макете)
    chatHeaderAvatar.addEventListener('click', () => toggleMiniProfile(currentChatLogin));
    chatHeaderName.addEventListener('click', () => toggleMiniProfile(currentChatLogin));

    function toggleMiniProfile(login) {
        if (!login) return;
        let popup = document.getElementById('miniProfilePopup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'miniProfilePopup';
            popup.className = 'mini-profile-popup';
            chatViewPanel.appendChild(popup);
        }

        if (popup.classList.contains('active')) {
            popup.classList.remove('active');
            return;
        }

        getProfile(login).then(profile => {
            if (!profile) return;
            popup.innerHTML = `
                <div class="mini-profile-avatar">${profile.avatar ? `<img src="${escapeHtml(profile.avatar)}" alt="${login}">` : '<i class="fas fa-user" style="font-size:32px; color:var(--text-muted);"></i>'}</div>
                <div class="mini-profile-name">${escapeHtml(profile.name || login)}</div>
                <div class="mini-profile-tag">@${login}</div>
                <div class="mini-profile-desc">${escapeHtml(profile.description || '')}</div>
                <button class="mini-profile-btn" onclick="navigateTo('/users/${login}')"><i class="fas fa-external-link-alt"></i> Открыть профиль</button>
            `;
            popup.classList.add('active');
        });
    }

    // Закрытие мини-профиля при клике вне его
    document.addEventListener('click', function(e) {
        const popup = document.getElementById('miniProfilePopup');
        if (popup && popup.classList.contains('active')) {
            if (!popup.contains(e.target) && e.target !== chatHeaderAvatar && e.target !== chatHeaderName && !chatHeaderAvatar.contains(e.target) && !chatHeaderName.contains(e.target)) {
                popup.classList.remove('active');
            }
        }
    });

    // Звонки
    window.startCall = function(type) {
        if (!currentChatLogin) return;
        callOverlay.style.display = 'flex';
        callName.textContent = currentChatLogin;
        callStatusText.textContent = type === 'voice' ? 'Голосовой вызов...' : 'Видеозвонок...';
    };

    window.endCall = function() {
        callOverlay.style.display = 'none';
    };

    await renderChatList();
}
