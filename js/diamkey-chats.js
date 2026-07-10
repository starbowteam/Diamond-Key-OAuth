// diamkey-chats.js — чаты DiamKey с плавной загрузкой и появлением
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    // Сразу делаем страницу невидимой, чтобы не было рывка
    const pageChats = document.getElementById('page-chats');
    if (pageChats) {
        pageChats.classList.add('loading');
    }

    // DOM-элементы (заполнятся после загрузки)
    let chatListContainer, chatSearchInput, noChatSelected, activeChatView;
    let messagesContainer, messageInput, sendBtn;
    let chatHeaderName, chatHeaderStatus, chatHeaderAvatar;
    let callOverlay, callName, callStatusText, chatViewPanel;

    let currentChatLogin = null;
    let allUsers = [];
    let recentLogins = [];
    let lastMessagesCache = {};
    let avatarCache = {};
    let messagesCache = {};
    let activeRequestToken = 0;

    // ====== Экран загрузки (лоадер) ======
    function showLoader() {
        const overlay = document.createElement('div');
        overlay.className = 'chats-loader-overlay';
        overlay.id = 'chatsLoaderOverlay';
        overlay.innerHTML = `
            <div class="loader-particles" id="loaderParticles"></div>
            <div class="loader-logo-container">
                <div class="loader-ring"></div>
                <img src="/assets/favicon.ico" class="loader-logo" alt="DiamKey" onerror="this.style.display='none';">
            </div>
            <div class="loader-icon-stage" id="loaderIconStage">
                <i class="fas fa-comments loader-icon-item active"></i>
                <i class="fas fa-user-friends loader-icon-item"></i>
                <i class="fas fa-database loader-icon-item"></i>
                <i class="fas fa-shield-alt loader-icon-item"></i>
                <i class="fas fa-bolt loader-icon-item"></i>
                <i class="fas fa-globe loader-icon-item"></i>
            </div>
            <div class="chats-loader-progress">
                <div class="chats-loader-progress-fill" id="loaderProgressFill"></div>
            </div>
            <div class="chats-loader-status" id="loaderStatusText">Подготовка чатов...</div>
        `;
        document.body.appendChild(overlay);

        // Частицы
        const particlesContainer = document.getElementById('loaderParticles');
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'loader-particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = (60 + Math.random() * 40) + '%';
            p.style.animationDelay = Math.random() * 4 + 's';
            p.style.animationDuration = (3 + Math.random() * 5) + 's';
            particlesContainer.appendChild(p);
        }

        // Анимация смены иконок
        const statusMessages = [
            'Подготовка чатов...',
            'Загрузка пользователей...',
            'Синхронизация сообщений...',
            'Настройка шифрования...',
            'Установка соединения...',
            'Почти готово...'
        ];
        let iconIdx = 0;
        const iconItems = document.querySelectorAll('#loaderIconStage .loader-icon-item');
        window._loaderIconInterval = setInterval(() => {
            iconItems.forEach(i => i.classList.remove('active'));
            iconIdx = (iconIdx + 1) % iconItems.length;
            iconItems[iconIdx].classList.add('active');
            const statusEl = document.getElementById('loaderStatusText');
            if (statusEl) statusEl.textContent = statusMessages[iconIdx] || 'Загрузка...';
        }, 800);

        // Прогресс-бар
        let progress = 0;
        window._loaderProgressInterval = setInterval(() => {
            progress += Math.random() * 10 + 3;
            if (progress > 90) progress = 90;
            const fill = document.getElementById('loaderProgressFill');
            if (fill) fill.style.width = progress + '%';
        }, 250);
    }

    function hideLoader() {
        return new Promise(resolve => {
            clearInterval(window._loaderIconInterval);
            clearInterval(window._loaderProgressInterval);
            const progressFill = document.getElementById('loaderProgressFill');
            const statusText = document.getElementById('loaderStatusText');
            if (progressFill) progressFill.style.width = '100%';
            if (statusText) statusText.textContent = 'Готово!';

            const overlay = document.getElementById('chatsLoaderOverlay');
            if (overlay) {
                overlay.classList.add('fade-out');
                overlay.addEventListener('transitionend', () => {
                    overlay.remove();
                    resolve();
                }, { once: true });
            } else {
                resolve();
            }
        });
    }

    // ====== Загрузка данных ======
    async function initialLoad() {
        const [users, recent] = await Promise.all([
            getUsers(),
            getRealRecentChats()
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

        // Кэшируем последние сообщения
        await updateLastMessages();

        // Получаем ссылки на элементы интерфейса чатов
        chatListContainer = document.getElementById('chatListContainer');
        chatSearchInput = document.getElementById('chatSearchInput');
        noChatSelected = document.getElementById('noChatSelected');
        activeChatView = document.getElementById('activeChatView');
        messagesContainer = document.getElementById('messagesContainer');
        messageInput = document.getElementById('messageInput');
        sendBtn = document.getElementById('sendMessageBtn');
        chatHeaderName = document.getElementById('chatHeaderName');
        chatHeaderStatus = document.getElementById('chatHeaderStatus');
        chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
        callOverlay = document.getElementById('callOverlay');
        callName = document.getElementById('callName');
        callStatusText = document.getElementById('callStatusText');
        chatViewPanel = document.getElementById('chatViewPanel');

        // Обработчики
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
        chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));
        chatHeaderAvatar.addEventListener('click', () => toggleMiniProfile(currentChatLogin));
        chatHeaderName.addEventListener('click', () => toggleMiniProfile(currentChatLogin));

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
            const real = msgs.filter(m => m.sender !== 'system');
            if (real.length > 0) {
                const last = real[real.length - 1];
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

    async function sendMessageToDB(partner, text) {
        const { error } = await _supabase
            .from('chat_messages')
            .insert([{ sender: currentUser.login, receiver: partner, message: text }]);
        return !error;
    }

    // ====== Интерфейс ======
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

    window._selectChat = function(login) {
        if (currentChatLogin === login) return;
        currentChatLogin = login;
        activeRequestToken++;
        const token = activeRequestToken;

        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';
        activeChatView.classList.remove('fade-in');
        void activeChatView.offsetWidth;
        activeChatView.classList.add('fade-in');

        const profile = allUsers.find(u => u.login === login);
        chatHeaderName.textContent = profile?.name || login;
        chatHeaderAvatar.innerHTML = getAvatarHTML(login);

        messagesContainer.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
            <i class="fas fa-circle-notch fa-spin" style="font-size:24px;"></i>
            <p>Загрузка сообщений...</p>
        </div>`;

        (async () => {
            let msgs = messagesCache[login] || await loadMessagesFromDB(login);
            if (token !== activeRequestToken) return;
            if (msgs.length === 0) {
                const sysMsg = {
                    sender: 'system',
                    receiver: login,
                    message: `Это ваш чат с ${escapeHtml(profile?.name || login)}! Можете начинать свое общение.`,
                    created_at: new Date().toISOString()
                };
                await _supabase.from('chat_messages').insert([sysMsg]);
                msgs = [sysMsg];
                messagesCache[login] = msgs;
            } else {
                messagesCache[login] = msgs;
            }
            if (token !== activeRequestToken) return;
            renderMessages(login, msgs);
        })();

        renderChatListInstant(chatSearchInput?.value || '');
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(msg => {
            if (msg.sender === 'system') return `<div class="chat-system-msg">${escapeHtml(msg.message)}</div>`;
            const isMe = (msg.sender === currentUser.login);
            const avatar = isMe ? (currentUser.avatar || '') : (avatarCache[login] || '');
            const avHtml = avatar ? `<img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '<i class="fas fa-user"></i>';
            return `<div class="message ${isMe ? 'sent' : 'received'}">
                <div class="msg-avatar">${avHtml}</div>
                <div>
                    <div class="msg-content">${escapeHtml(msg.message)}</div>
                    <div class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            </div>`;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage() {
        const target = currentChatLogin;
        if (!target) return;
        const text = messageInput.value.trim();
        if (!text) return;

        const now = new Date().toISOString();
        const newMsg = { sender: currentUser.login, receiver: target, message: text, created_at: now };
        if (!messagesCache[target]) messagesCache[target] = [];
        messagesCache[target].push(newMsg);
        renderMessages(target, messagesCache[target]);

        lastMessagesCache[target] = {
            text: `Вы: ${text}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (!recentLogins.includes(target)) {
            recentLogins.push(target);
        }
        renderChatListInstant(chatSearchInput?.value || '');

        messageInput.value = '';
        messageInput.focus();

        const ok = await sendMessageToDB(target, text);
        if (!ok) {
            if (currentChatLogin === target) {
                messagesCache[target].pop();
                renderMessages(target, messagesCache[target]);
            }
            showToast('Ошибка отправки');
        }
    }

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

    // ====== Запуск ======
    showLoader();
    await initialLoad();
    await hideLoader(); // ждём завершения анимации скрытия

    // Плавно показываем страницу чатов
    if (pageChats) {
        pageChats.classList.remove('loading');
    }

    renderChatListInstant();
}
