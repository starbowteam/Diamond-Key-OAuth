// diamkey-chats.js — чаты DiamKey с плавной загрузкой
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    const chatsContainer = document.querySelector('#page-chats .chats-container');
    const loaderOverlay = document.getElementById('chatsLoaderOverlay');
    const loaderIcon = document.getElementById('chatsLoaderIcon');
    const loaderBar = document.getElementById('chatsLoaderBar');
    const loaderSub = document.getElementById('chatsLoaderSub');

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
    let allUsers = [];
    let recentLogins = [];
    let lastMessagesCache = {};
    let avatarCache = {};
    let messagesCache = {};

    // Иконки для лоадера (тема общения)
    const LOADER_ICONS = [
        'fa-comments',
        'fa-users',
        'fa-paper-plane',
        'fa-comment-dots',
        'fa-smile',
        'fa-inbox',
        'fa-address-book'
    ];

    // ---------- ЛОАДЕР ----------
    function showLoader() {
        loaderOverlay.style.display = 'flex';
        loaderOverlay.classList.remove('fade-out');
        loaderBar.style.width = '0%';
        loaderSub.textContent = 'Подключаем пользователей...';
        loaderIcon.className = `fas ${LOADER_ICONS[0]} chats-loader-icon`;

        let iconIndex = 0;
        const iconChangeInterval = 1800;
        const iconTimer = setInterval(() => {
            loaderIcon.style.opacity = '0';
            setTimeout(() => {
                iconIndex = (iconIndex + 1) % LOADER_ICONS.length;
                loaderIcon.className = `fas ${LOADER_ICONS[iconIndex]} chats-loader-icon`;
                loaderIcon.style.opacity = '1';
            }, 300);
        }, iconChangeInterval);

        // Прогресс-бар
        let progress = 0;
        const totalFakeDuration = 8000; // визуальная длительность
        const steps = 40;
        const stepFake = totalFakeDuration / steps;
        const progressTimer = setInterval(() => {
            progress += (100 / steps);
            if (progress > 100) progress = 100;
            loaderBar.style.width = progress + '%';
            const texts = ['Загружаем пользователей...', 'Подключаем чаты...', 'Синхронизируем сообщения...', 'Почти готово...'];
            loaderSub.textContent = texts[Math.floor(progress / 25) % texts.length];
            if (progress >= 100) clearInterval(progressTimer);
        }, stepFake);

        return { iconTimer, progressTimer };
    }

    async function hideLoader(timers) {
        clearInterval(timers.iconTimer);
        clearInterval(timers.progressTimer);
        loaderBar.style.width = '100%';
        loaderSub.textContent = 'Готово!';
        loaderOverlay.classList.add('fade-out');
        await new Promise(r => setTimeout(r, 800));
        loaderOverlay.style.display = 'none';
    }

    // ---------- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ----------
    async function loadInitialData() {
        const [users, recent] = await Promise.all([
            getUsers(),
            getRealRecentChats()
        ]);

        allUsers = users.filter(u => u.login !== currentUser.login);
        recentLogins = recent;

        await Promise.all(allUsers.map(async (u) => {
            if (!avatarCache[u.login]) {
                const profile = await getProfile(u.login);
                avatarCache[u.login] = profile?.avatar || '';
            }
        }));

        await updateLastMessages();
    }

    async function getRealRecentChats() {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('sender, receiver')
            .or(`sender.eq.${currentUser.login},receiver.eq.${currentUser.login}`)
            .neq('sender', 'system');

        if (error || !data) return [];
        const partners = new Set();
        data.forEach(msg => {
            if (msg.sender === currentUser.login && msg.receiver !== 'system') partners.add(msg.receiver);
            else if (msg.receiver === currentUser.login && msg.sender !== 'system') partners.add(msg.sender);
        });
        return Array.from(partners);
    }

    async function updateLastMessages() {
        const logins = recentLogins.length > 0 ? recentLogins : [];
        await Promise.all(logins.map(async (login) => {
            const msgs = await loadMessagesFromDB(login);
            const realMsgs = msgs.filter(m => m.sender !== 'system');
            if (realMsgs.length > 0) {
                const last = realMsgs[realMsgs.length - 1];
                lastMessagesCache[login] = {
                    text: `${last.sender === currentUser.login ? 'Вы' : login}: ${last.message}`,
                    time: new Date(last.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };
            } else {
                lastMessagesCache[login] = { text: '', time: '' };
            }
        }));
    }

    async function loadMessagesFromDB(partner) {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('*')
            .or(`and(sender.eq.${currentUser.login},receiver.eq.${partner}),and(sender.eq.${partner},receiver.eq.${currentUser.login})`)
            .order('created_at', { ascending: true });
        if (error) return [];
        return data || [];
    }

    // ---------- ИНТЕРФЕЙС ----------
    function renderChatListInstant(filterText = '') {
        if (!chatListContainer || !allUsers.length) return;

        const lowerFilter = filterText.toLowerCase();
        const filterFn = (u) => {
            if (!filterText) return true;
            if (lowerFilter.startsWith('@')) return u.login.toLowerCase().includes(lowerFilter.slice(1));
            return (u.name || u.login).toLowerCase().includes(lowerFilter);
        };

        let html = '';
        if (recentLogins.length > 0) {
            const recentUsers = allUsers.filter(u => recentLogins.includes(u.login) && filterFn(u));
            if (recentUsers.length > 0) {
                const items = recentUsers.map(u => {
                    const preview = lastMessagesCache[u.login] || { text: '', time: '' };
                    const active = currentChatLogin === u.login ? 'active' : '';
                    return `<div class="chat-item ${active}" onclick="window._selectChat('${u.login}')">
                        <div class="chat-item-avatar">${getAvatarHTML(u.login)}</div>
                        <div class="chat-item-info">
                            <div class="chat-item-name">${escapeHtml(u.name || u.login)}</div>
                            <div class="chat-item-last-msg">${escapeHtml(preview.text || 'Нет сообщений')}</div>
                        </div>
                        <div class="chat-item-meta"><div class="chat-item-time">${preview.time}</div></div>
                    </div>`;
                });
                html += `<div class="chat-section"><div class="chat-section-title"><i class="fas fa-history"></i> Последние чаты</div>${items.join('')}</div>`;
            }
        } else {
            html += `<div class="chat-section-empty">Вы ещё можете пообщаться, выберите пользователя ниже!</div>`;
        }

        const recentSet = new Set(recentLogins);
        const others = allUsers.filter(u => !recentSet.has(u.login) && filterFn(u));
        if (others.length > 0) {
            const items = others.map(u => {
                const active = currentChatLogin === u.login ? 'active' : '';
                return `<div class="chat-item ${active}" onclick="window._selectChat('${u.login}')">
                    <div class="chat-item-avatar">${getAvatarHTML(u.login)}</div>
                    <div class="chat-item-info">
                        <div class="chat-item-name">${escapeHtml(u.name || u.login)}</div>
                        <div class="chat-item-last-msg">Начать чат</div>
                    </div>
                    <div class="chat-item-meta"></div>
                </div>`;
            });
            html += `<div class="chat-section" style="margin-top:16px;"><div class="chat-section-title"><i class="fas fa-users"></i> Все пользователи</div>${items.join('')}</div>`;
        }

        chatListContainer.innerHTML = html;
    }

    function getAvatarHTML(login) {
        const url = avatarCache[login];
        return url ? `<img src="${escapeHtml(url)}" alt="${login}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>';
    }

    window._selectChat = function(login) {
        if (currentChatLogin === login) return;
        currentChatLogin = login;
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';
        activeChatView.classList.remove('fade-in');
        void activeChatView.offsetWidth;
        activeChatView.classList.add('fade-in');

        const profile = allUsers.find(u => u.login === login);
        chatHeaderName.textContent = profile?.name || login;
        chatHeaderAvatar.innerHTML = getAvatarHTML(login);

        if (messagesCache[login]) {
            renderMessages(login, messagesCache[login]);
        } else {
            loadMessagesFromDB(login).then(msgs => {
                if (msgs.length === 0) {
                    const sysMsg = { sender: 'system', receiver: login, message: `Это ваш чат с ${escapeHtml(profile?.name || login)}! Можете начинать свое общение.`, created_at: new Date().toISOString() };
                    _supabase.from('chat_messages').insert([sysMsg]).then(() => {
                        msgs.push(sysMsg);
                        messagesCache[login] = msgs;
                        renderMessages(login, msgs);
                    });
                } else {
                    messagesCache[login] = msgs;
                    renderMessages(login, msgs);
                }
            });
        }

        renderChatListInstant(chatSearchInput?.value || '');
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(msg => {
            if (msg.sender === 'system') return `<div class="chat-system-msg">${escapeHtml(msg.message)}</div>`;
            const isMe = (msg.sender === currentUser.login);
            const avatar = isMe ? (currentUser.avatar || '') : (avatarCache[login] || '');
            const avatarHTML = avatar ? `<img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '<i class="fas fa-user"></i>';
            return `<div class="message ${isMe ? 'sent' : 'received'}">
                <div class="msg-avatar">${avatarHTML}</div>
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

        const now = new Date().toISOString();
        const newMsg = { sender: currentUser.login, receiver: currentChatLogin, message: text, created_at: now };
        if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
        messagesCache[currentChatLogin].push(newMsg);
        renderMessages(currentChatLogin, messagesCache[currentChatLogin]);

        lastMessagesCache[currentChatLogin] = { text: `Вы: ${text}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        if (!recentLogins.includes(currentChatLogin)) recentLogins.push(currentChatLogin);
        renderChatListInstant(chatSearchInput?.value || '');

        messageInput.value = '';
        messageInput.focus();

        const ok = await sendMessageToDB(currentChatLogin, text);
        if (!ok) {
            messagesCache[currentChatLogin].pop();
            renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
            showToast('Ошибка отправки');
        }
    }

    async function sendMessageToDB(partner, text) {
        const { error } = await _supabase.from('chat_messages').insert([{ sender: currentUser.login, receiver: partner, message: text }]);
        return !error;
    }

    // Обработчики
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
    chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));

    chatHeaderAvatar.addEventListener('click', () => toggleMiniProfile(currentChatLogin));
    chatHeaderName.addEventListener('click', () => toggleMiniProfile(currentChatLogin));

    function toggleMiniProfile(login) {
        if (!login) return;
        const popup = document.getElementById('miniProfilePopup');
        if (popup.classList.contains('active')) { popup.classList.remove('active'); return; }
        const profile = allUsers.find(u => u.login === login);
        if (profile) {
            document.getElementById('miniProfileName').textContent = profile.name || login;
            document.getElementById('miniProfileTag').textContent = '@' + login;
            document.getElementById('miniProfileDesc').textContent = profile.description || '';
            popup.classList.add('active');
        }
    }

    document.addEventListener('click', e => {
        const popup = document.getElementById('miniProfilePopup');
        if (popup && popup.classList.contains('active') && !popup.contains(e.target) && e.target !== chatHeaderAvatar && e.target !== chatHeaderName) {
            popup.classList.remove('active');
        }
    });

    window.startCall = type => {
        if (!currentChatLogin) return;
        callOverlay.style.display = 'flex';
        callName.textContent = currentChatLogin;
        callStatusText.textContent = type === 'voice' ? 'Голосовой вызов...' : 'Видеозвонок...';
    };
    window.endCall = () => { callOverlay.style.display = 'none'; };

    // ---------- ГЛАВНЫЙ СТАРТ ----------
    const timers = showLoader();
    const MIN_LOAD_TIME = 5000;
    const startTime = Date.now();
    await loadInitialData();
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_LOAD_TIME) {
        await new Promise(r => setTimeout(r, MIN_LOAD_TIME - elapsed));
    }
    await hideLoader(timers);

    renderChatListInstant();
    const friends = getFriendsList ? await getFriendsList() : []; // если функция друзей ещё существует, но она удалена, то просто []
    if (friends.length > 0 && !currentChatLogin) {
        window._selectChat(friends[0]);
    }
}
