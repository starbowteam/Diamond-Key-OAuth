// diamkey-chats.js — плавные чаты без багов
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
    let allUsers = [];                // кэш пользователей (без себя)
    let recentLogins = [];           // логины, с которыми реально общались (есть сообщения не‑system)
    let lastMessagesCache = {};      // { login: { text, time } }
    let avatarCache = {};            // { login: url }
    let messagesCache = {};          // { login: [messages] }
    let currentMessagesToken = 0;    // токен для предотвращения гонки сообщений

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    async function initialLoad() {
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
        }, 150);

        // Загружаем пользователей и «настоящие» последние чаты
        const [users, recent] = await Promise.all([
            getUsers(),
            getRealRecentChats()   // новая функция – см. ниже
        ]);

        allUsers = users.filter(u => u.login !== currentUser.login);
        recentLogins = recent;

        // Кэшируем аватарки
        await Promise.all(allUsers.map(async (u) => {
            if (!avatarCache[u.login]) {
                const profile = await getProfile(u.login);
                avatarCache[u.login] = profile?.avatar || '';
            }
        }));

        // Заполняем кэш последних сообщений для превью
        await updateLastMessages();

        clearInterval(interval);
        document.getElementById('chatsLoaderBar').style.width = '100%';
        document.getElementById('chatsLoaderStatus').textContent = 'Готово!';
        await new Promise(r => setTimeout(r, 200));

        renderChatListInstant();
    }

    // «Настоящие» последние чаты — те, где есть хотя бы одно не‑системное сообщение
    async function getRealRecentChats() {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('sender, receiver, message')
            .or(`sender.eq.${currentUser.login},receiver.eq.${currentUser.login}`)
            .neq('sender', 'system');   // исключаем системные

        if (error || !data) return [];

        const partners = new Set();
        data.forEach(msg => {
            if (msg.sender === currentUser.login) partners.add(msg.receiver);
            else if (msg.receiver === currentUser.login) partners.add(msg.sender);
        });
        return Array.from(partners);
    }

    async function updateLastMessages() {
        // обновляем превью только для настоящих недавних чатов
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

    // ========== РАБОТА С БД ==========
    async function loadMessagesFromDB(partner) {
        const { data, error } = await _supabase
            .from('chat_messages')
            .select('*')
            .or(`and(sender.eq.${currentUser.login},receiver.eq.${partner}),and(sender.eq.${partner},receiver.eq.${currentUser.login})`)
            .order('created_at', { ascending: true });
        if (error) return [];
        return data || [];
    }

    async function sendMessageToDB(partner, text) {
        const { error } = await _supabase
            .from('chat_messages')
            .insert([{ sender: currentUser.login, receiver: partner, message: text }]);
        return !error;
    }

    // ========== ОТРИСОВКА СПИСКА ==========
    function getAvatarHTML(login) {
        const url = avatarCache[login];
        return url ? `<img src="${escapeHtml(url)}" alt="${login}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>';
    }

    function renderChatListInstant(filterText = '') {
        if (!chatListContainer || !allUsers.length) return;

        const lowerFilter = filterText.toLowerCase();
        const filterFn = (u) => {
            if (!filterText) return true;
            if (lowerFilter.startsWith('@')) return u.login.toLowerCase().includes(lowerFilter.slice(1));
            return (u.name || u.login).toLowerCase().includes(lowerFilter);
        };

        let html = '';

        // Настоящие последние чаты
        if (recentLogins.length > 0) {
            const recentUsers = allUsers.filter(u => recentLogins.includes(u.login) && filterFn(u));
            if (recentUsers.length > 0) {
                const items = recentUsers.map(u => {
                    const preview = lastMessagesCache[u.login] || { text: '', time: '' };
                    const activeClass = currentChatLogin === u.login ? 'active' : '';
                    return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
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

        // Все пользователи (кроме тех, что уже в последних)
        const recentSet = new Set(recentLogins);
        const others = allUsers.filter(u => !recentSet.has(u.login) && filterFn(u));
        if (others.length > 0) {
            const items = others.map(u => {
                const activeClass = currentChatLogin === u.login ? 'active' : '';
                return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
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

    // ========== ВЫБОР ЧАТА (ПЛАВНЫЙ) ==========
    window._selectChat = function(login) {
        if (currentChatLogin === login) return;
        currentChatLogin = login;

        // Показываем область чата с анимацией
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';
        activeChatView.classList.remove('fade-in');
        void activeChatView.offsetWidth;
        activeChatView.classList.add('fade-in');

        const profile = allUsers.find(u => u.login === login);
        chatHeaderName.textContent = profile?.name || login;
        chatHeaderAvatar.innerHTML = getAvatarHTML(login);

        // Защита от гонки: увеличиваем токен
        const token = ++currentMessagesToken;

        // Загружаем сообщения (из кэша или БД)
        if (messagesCache[login]) {
            if (token === currentMessagesToken) {
                renderMessages(login, messagesCache[login]);
            }
        } else {
            loadMessagesFromDB(login).then(msgs => {
                if (token !== currentMessagesToken) return; // устарело
                if (msgs.length === 0) {
                    // Вставляем системное сообщение, но НЕ добавляем в recent
                    const sysMsg = {
                        sender: 'system',
                        receiver: login,
                        message: `Это ваш чат с ${escapeHtml(profile?.name || login)}! Можете начинать свое общение.`,
                        created_at: new Date().toISOString()
                    };
                    _supabase.from('chat_messages').insert([sysMsg]).then(() => {
                        msgs.push(sysMsg);
                        messagesCache[login] = msgs;
                        if (token === currentMessagesToken) {
                            renderMessages(login, msgs);
                        }
                    });
                } else {
                    messagesCache[login] = msgs;
                    if (token === currentMessagesToken) {
                        renderMessages(login, msgs);
                    }
                }
            });
        }

        // Мгновенно подсвечиваем активный чат в списке
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

    // ========== ОТПРАВКА СООБЩЕНИЯ ==========
    async function sendMessage() {
        if (!currentChatLogin) return;
        const text = messageInput.value.trim();
        if (!text) return;

        // Оптимистичное отображение
        const now = new Date().toISOString();
        const newMsg = { sender: currentUser.login, receiver: currentChatLogin, message: text, created_at: now };
        if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
        messagesCache[currentChatLogin].push(newMsg);
        renderMessages(currentChatLogin, messagesCache[currentChatLogin]);

        // Обновляем превью в списке
        lastMessagesCache[currentChatLogin] = {
            text: `Вы: ${text}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        // Теперь это настоящий чат – добавляем в recent, если ещё нет
        if (!recentLogins.includes(currentChatLogin)) {
            recentLogins.push(currentChatLogin);
        }
        renderChatListInstant(chatSearchInput?.value || '');

        messageInput.value = '';
        messageInput.focus();

        const ok = await sendMessageToDB(currentChatLogin, text);
        if (!ok) {
            // Откат при ошибке
            messagesCache[currentChatLogin].pop();
            renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
            showToast('Ошибка отправки');
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
    chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));

    // Мини‑профиль
    chatHeaderAvatar.addEventListener('click', () => toggleMiniProfile(currentChatLogin));
    chatHeaderName.addEventListener('click', () => toggleMiniProfile(currentChatLogin));

    function toggleMiniProfile(login) {
        if (!login) return;
        const popup = document.getElementById('miniProfilePopup');
        if (popup.classList.contains('active')) {
            popup.classList.remove('active');
            return;
        }
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

    // ========== СТАРТ ==========
    await initialLoad();
}
