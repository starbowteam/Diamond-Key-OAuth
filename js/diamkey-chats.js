// diamkey-chats.js — чаты DiamKey (оптимизированные, без задержек)
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    const chatListContainer = document.getElementById('chatListContainer');
    const chatSearchInput = document.getElementById('chatSearchInput');
    const noChatSelected = document.getElementById('noChatSelected');
    const activeChatView = document.getElementById('activeChatView');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendMessageBtn');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderStatus = document.getElementById('chatHeaderStatus');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const callOverlay = document.getElementById('callOverlay');
    const callName = document.getElementById('callName');
    const callStatusText = document.getElementById('callStatusText');
    const chatViewPanel = document.getElementById('chatViewPanel');

    let currentChatLogin = null;
    let allUsersCache = null;
    let recentLoginsCache = [];
    let initialLoad = true;

    // Загрузка сообщений (оптимизированная)
    async function loadMessages(partner) {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('*')
            .or(`and(sender.eq.${currentUser.login},receiver.eq.${partner}),and(sender.eq.${partner},receiver.eq.${currentUser.login})`)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Ошибка загрузки сообщений:', error);
            return [];
        }
        return data || [];
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

    async function getRecentChats() {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('sender, receiver')
            .or(`sender.eq.${currentUser.login},receiver.eq.${currentUser.login}`);

        if (error || !data) return [];

        const partners = new Set();
        data.forEach(msg => {
            if (msg.sender === currentUser.login && msg.receiver !== 'system') partners.add(msg.receiver);
            else if (msg.receiver === currentUser.login && msg.sender !== 'system') partners.add(msg.sender);
        });
        return Array.from(partners);
    }

    // Быстрая отрисовка списка (без задержек)
    function renderChatListInstant(filterText = '') {
        if (!chatListContainer || !allUsersCache) return;

        const otherUsers = allUsersCache.filter(u => u.login !== currentUser.login);
        const lowerFilter = filterText.toLowerCase();
        const isTagSearch = lowerFilter.startsWith('@');
        const searchTerm = isTagSearch ? lowerFilter.slice(1) : lowerFilter;

        const filterFn = (u) => {
            if (!filterText) return true;
            if (isTagSearch) return u.login.toLowerCase().includes(searchTerm);
            return (u.name || u.login).toLowerCase().includes(searchTerm);
        };

        let html = '';

        // Последние чаты
        if (recentLoginsCache.length > 0) {
            const recentUsers = otherUsers.filter(u => recentLoginsCache.includes(u.login) && filterFn(u));
            if (recentUsers.length > 0) {
                const items = recentUsers.map(u => {
                    const activeClass = currentChatLogin === u.login ? 'active' : '';
                    return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
                        <div class="chat-item-avatar">${u.avatar ? `<img src="${escapeHtml(u.avatar)}" alt="${u.login}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>'}</div>
                        <div class="chat-item-info">
                            <div class="chat-item-name">${escapeHtml(u.name || u.login)}</div>
                            <div class="chat-item-last-msg">${escapeHtml(u._lastMsg || '')}</div>
                        </div>
                        <div class="chat-item-meta"><div class="chat-item-time">${u._lastTime || ''}</div></div>
                    </div>`;
                });
                html += `<div class="chat-section">
                    <div class="chat-section-title"><i class="fas fa-history"></i> Последние чаты</div>
                    ${items.join('')}
                </div>`;
            }
        } else {
            html += `<div class="chat-section-empty">Вы ещё можете пообщаться, выберите пользователя ниже!</div>`;
        }

        // Все пользователи
        const recentSet = new Set(recentLoginsCache);
        const allFiltered = otherUsers.filter(u => !recentSet.has(u.login) && filterFn(u));
        if (allFiltered.length > 0) {
            const items = allFiltered.map(u => {
                const activeClass = currentChatLogin === u.login ? 'active' : '';
                return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
                    <div class="chat-item-avatar">${u.avatar ? `<img src="${escapeHtml(u.avatar)}" alt="${u.login}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>'}</div>
                    <div class="chat-item-info">
                        <div class="chat-item-name">${escapeHtml(u.name || u.login)}</div>
                        <div class="chat-item-last-msg">Начать чат</div>
                    </div>
                    <div class="chat-item-meta"></div>
                </div>`;
            });
            html += `<div class="chat-section" style="margin-top: 16px;">
                <div class="chat-section-title"><i class="fas fa-users"></i> Все пользователи</div>
                ${items.join('')}
            </div>`;
        }

        chatListContainer.innerHTML = html;
    }

    // Первый запуск — с лоадером
    async function initialLoadData() {
        chatListContainer.innerHTML = `<div class="loader-container">
            <div class="loader-icon"><i class="fas fa-comments"></i></div>
            <div class="loader-progress"><div class="loader-bar" id="chatsLoaderBar" style="width:0%"></div></div>
            <div class="loader-status" id="chatsLoaderStatus">Загрузка чатов...</div>
        </div>`;

        let width = 0;
        const interval = setInterval(() => {
            width += 15;
            if (width > 90) width = 90;
            const bar = document.getElementById('chatsLoaderBar');
            const status = document.getElementById('chatsLoaderStatus');
            if (bar) bar.style.width = width + '%';
            if (status) status.textContent = `Загрузка ${width}%`;
        }, 200);

        [allUsersCache, recentLoginsCache] = await Promise.all([
            getUsers(),
            getRecentChats()
        ]);

        clearInterval(interval);
        const bar = document.getElementById('chatsLoaderBar');
        const status = document.getElementById('chatsLoaderStatus');
        if (bar) bar.style.width = '100%';
        if (status) status.textContent = 'Готово!';
        await new Promise(r => setTimeout(r, 300));

        // Загружаем последние сообщения для кэша
        await updateLastMessagesCache();
        initialLoad = false;
        renderChatListInstant();
    }

    async function updateLastMessagesCache() {
        if (!allUsersCache) return;
        const recentUsers = allUsersCache.filter(u => recentLoginsCache.includes(u.login));
        await Promise.all(recentUsers.map(async (u) => {
            const lastMsg = await getLastMessage(u.login);
            u._lastMsg = lastMsg.text;
            u._lastTime = lastMsg.time;
        }));
    }

    async function refreshChatList() {
        recentLoginsCache = await getRecentChats();
        await updateLastMessagesCache();
        renderChatListInstant(chatSearchInput?.value || '');
    }

    window._selectChat = async function(login) {
        currentChatLogin = login;
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';

        // Загружаем профиль и сообщения параллельно
        const [profile, messages] = await Promise.all([
            getProfile(login),
            loadMessages(login)
        ]);

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

        // Если сообщений нет, создаём системное
        if (messages.length === 0) {
            await _supabase.from('chat_messages').insert([{
                sender: 'system',
                receiver: login,
                message: `Это ваш чат с ${escapeHtml(profile?.name || login)}! Можете начинать свое общение.`
            }]);
            const updated = await loadMessages(login);
            renderMessages(login, updated);
        } else {
            renderMessages(login, messages);
        }

        refreshChatList();
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(msg => {
            if (msg.sender === 'system') {
                return `<div class="chat-system-msg">${escapeHtml(msg.message)}</div>`;
            }
            const isMe = (msg.sender === currentUser.login);
            return `<div class="message ${isMe ? 'sent' : 'received'}">
                <div class="msg-avatar">${isMe ? avatarHTML(currentUser.avatar, 32) : `<i class="fas fa-user"></i>`}</div>
                <div>
                    <div class="msg-content">${escapeHtml(msg.message)}</div>
                    <div class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>`;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage() {
        if (!currentChatLogin) return;
        const text = messageInput.value.trim();
        if (!text) return;

        const ok = await sendMessageToSupabase(currentChatLogin, text);
        if (!ok) return;

        messageInput.value = '';

        // Мгновенно обновляем сообщения
        const messages = await loadMessages(currentChatLogin);
        renderMessages(currentChatLogin, messages);
        refreshChatList();
        messageInput.focus();
    }

    sendBtn?.addEventListener('click', sendMessage);
    messageInput?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendMessage();
    });

    chatSearchInput?.addEventListener('input', function() {
        renderChatListInstant(this.value);
    });

    chatHeaderAvatar.addEventListener('click', () => toggleMiniProfile(currentChatLogin));
    chatHeaderName.addEventListener('click', () => toggleMiniProfile(currentChatLogin));

    function toggleMiniProfile(login) {
        if (!login) return;
        let popup = document.getElementById('miniProfilePopup');
        if (popup.classList.contains('active')) {
            popup.classList.remove('active');
            return;
        }
        getProfile(login).then(profile => {
            if (!profile) return;
            document.getElementById('miniProfileName').textContent = profile.name || login;
            document.getElementById('miniProfileTag').textContent = '@' + login;
            document.getElementById('miniProfileDesc').textContent = profile.description || '';
            popup.classList.add('active');
        });
    }

    document.addEventListener('click', function(e) {
        const popup = document.getElementById('miniProfilePopup');
        if (popup && popup.classList.contains('active')) {
            if (!popup.contains(e.target) && e.target !== chatHeaderAvatar && e.target !== chatHeaderName) {
                popup.classList.remove('active');
            }
        }
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

    // Старт
    await initialLoadData();
}
