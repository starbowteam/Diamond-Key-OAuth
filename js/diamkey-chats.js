// diamkey-chats.js — чаты DiamKey (плавные, с реакциями, ГС, мини‑профилем)
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    // ==================== DOM‑элементы ====================
    const chatListContainer = document.getElementById('chatListContainer');
    const chatSearchInput = document.getElementById('chatSearchInput');
    const noChatSelected = document.getElementById('noChatSelected');
    const activeChatView = document.getElementById('activeChatView');
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendMessageBtn');
    const voiceBtn = document.getElementById('voiceRecordBtn');
    const chatHeaderName = document.getElementById('chatHeaderName');
    const chatHeaderStatus = document.getElementById('chatHeaderStatus');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const callOverlay = document.getElementById('callOverlay');
    const callName = document.getElementById('callName');
    const callStatusText = document.getElementById('callStatusText');
    const chatViewPanel = document.getElementById('chatViewPanel');

    // ==================== Состояние ====================
    let currentChatLogin = null;
    let allUsers = [];
    let recentLogins = [];
    let lastMessagesCache = {};
    let avatarCache = {};
    let onlineCache = {};
    let messagesCache = {};
    let activeMessageToken = 0;

    // Реакции (ключ – message_id, значение – emoji)
    let myReactions = {};

    // ==================== Инициализация (прогресс‑бар) ====================
    async function initialLoad() {
        chatListContainer.innerHTML = `
            <div class="list-loader">
                <i class="fas fa-comments"></i>
                <div class="list-loader-progress"><div class="fill" id="chatsLoaderBar" style="width:0%"></div></div>
                <small>Загружаем чаты...</small>
            </div>`;

        const loaderBar = document.getElementById('chatsLoaderBar');
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 7;
            if (progress > 90) progress = 90;
            if (loaderBar) loaderBar.style.width = progress + '%';
        }, 200);

        const [users, presenceData, recent] = await Promise.all([
            getUsers(),
            _supabase.from('user_presence').select('login, last_seen'),
            getRealRecentChats()
        ]);

        clearInterval(progressInterval);
        if (loaderBar) loaderBar.style.width = '100%';
        await new Promise(r => setTimeout(r, 300));

        allUsers = users.filter(u => u.login !== currentUser.login);

        const now = Date.now();
        (presenceData.data || []).forEach(p => {
            onlineCache[p.login] = (now - new Date(p.last_seen).getTime()) < 120000;
        });
        allUsers.forEach(u => {
            if (!(u.login in onlineCache)) onlineCache[u.login] = false;
        });

        await Promise.all(allUsers.map(async (u) => {
            if (!avatarCache[u.login]) {
                const profile = await getProfile(u.login);
                avatarCache[u.login] = profile?.avatar || '';
            }
        }));

        recentLogins = recent;
        await updateLastMessagesCache();

        renderChatListInstant();
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

    async function updateLastMessagesCache() {
        const logins = recentLogins.length > 0 ? recentLogins : allUsers.map(u => u.login);
        await Promise.all(logins.map(async (login) => {
            const msgs = await loadMessagesFromDB(login);
            const real = msgs.filter(m => m.sender !== 'system');
            if (real.length > 0) {
                const last = real[real.length - 1];
                lastMessagesCache[login] = {
                    text: `${last.sender === currentUser.login ? 'Вы' : login}: ${last.message || '(голосовое)'}`,
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

    // ==================== Рендер списка чатов ====================
    function renderChatListInstant(filterText = '') {
        if (!chatListContainer || !allUsers.length) return;

        const lowerFilter = filterText.toLowerCase();
        const filterFn = (u) => {
            if (!filterText) return true;
            if (lowerFilter.startsWith('@')) return u.login.toLowerCase().includes(lowerFilter.slice(1));
            return (u.name || u.login).toLowerCase().includes(lowerFilter);
        };

        let html = '';

        // Последние чаты
        if (recentLogins.length > 0) {
            const recentUsers = allUsers.filter(u => recentLogins.includes(u.login) && filterFn(u));
            if (recentUsers.length > 0) {
                const items = recentUsers.map(u => {
                    const preview = lastMessagesCache[u.login] || { text: '', time: '' };
                    const activeClass = currentChatLogin === u.login ? 'active' : '';
                    const onlineDot = onlineCache[u.login] ? '<span class="online-dot"></span>' : '';
                    return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
                        <div class="chat-item-avatar">${getAvatarHTML(u.login)}${onlineDot}</div>
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

        // Все пользователи
        const recentSet = new Set(recentLogins);
        const others = allUsers.filter(u => !recentSet.has(u.login) && filterFn(u));
        if (others.length > 0) {
            const items = others.map(u => {
                const activeClass = currentChatLogin === u.login ? 'active' : '';
                const onlineDot = onlineCache[u.login] ? '<span class="online-dot"></span>' : '';
                return `<div class="chat-item ${activeClass}" onclick="window._selectChat('${u.login}')">
                    <div class="chat-item-avatar">${getAvatarHTML(u.login)}${onlineDot}</div>
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

    // ==================== Выбор чата (плавный) ====================
    window._selectChat = async function(login) {
        if (currentChatLogin === login) return;

        currentChatLogin = login;
        activeMessageToken++;
        const token = activeMessageToken;

        // Плавно показываем панель
        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';
        activeChatView.classList.remove('fade-in');
        void activeChatView.offsetWidth;
        activeChatView.classList.add('fade-in');

        const profile = allUsers.find(u => u.login === login);
        chatHeaderName.textContent = profile?.name || login;
        chatHeaderAvatar.innerHTML = getAvatarHTML(login);

        // Статус онлайн
        const online = onlineCache[login] ?? false;
        chatHeaderStatus.textContent = online ? 'В сети' : 'Не в сети';
        chatHeaderStatus.className = 'chat-header-status ' + (online ? 'online' : '');

        // Загружаем сообщения
        (async () => {
            if (messagesCache[login]) {
                if (token === activeMessageToken) renderMessages(login, messagesCache[login]);
            } else {
                const msgs = await loadMessagesFromDB(login);
                if (token !== activeMessageToken) return;

                if (msgs.length === 0) {
                    const sysMsg = {
                        sender: 'system',
                        receiver: login,
                        message: `Это ваш чат с ${escapeHtml(profile?.name || login)}! Можете начинать свое общение.`,
                        created_at: new Date().toISOString()
                    };
                    await _supabase.from('chat_messages').insert([sysMsg]);
                    msgs.push(sysMsg);
                }
                messagesCache[login] = msgs;
                renderMessages(login, msgs);
            }
        })();

        markChatAsRead(login);
        renderChatListInstant(chatSearchInput?.value || '');
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(msg => {
            if (msg.sender === 'system') return `<div class="system-msg">${escapeHtml(msg.message)}</div>`;

            // Голосовое
            if (msg.type === 'voice') {
                const bars = [8,14,6,18,10,12,9,17,5,15,11,7,13,16,8,10,14,6,12,9];
                const waveHTML = bars.map(h => `<div class="voice-wave-bar" style="height:${h}px;"></div>`).join('');
                const isMe = msg.sender === currentUser.login;
                return `<div class="voice-message ${isMe ? 'sent' : 'received'}">
                    <button class="voice-play-btn" onclick="toggleVoicePlayback(this, '${msg.id}')"><i class="fas fa-play"></i></button>
                    <div class="voice-wave">${waveHTML}</div>
                    <span class="voice-time">0:${String(msg.duration || 0).padStart(2,'0')}</span>
                    <div class="msg-footer">
                        <span class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button class="msg-reaction-btn" onclick="openReactionPicker(${msg.id})"><i class="fas fa-smile"></i></button>
                    </div>
                </div>`;
            }

            // Текстовое сообщение
            const isMe = msg.sender === currentUser.login;
            const avatar = isMe ? (currentUser.avatar || '') : (avatarCache[login] || '');
            const avatarHTML = avatar ? `<img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '<i class="fas fa-user"></i>';

            const reaction = myReactions[msg.id] || null;
            const hasReaction = !!reaction;

            return `<div class="message ${isMe ? 'sent' : 'received'}">
                <div class="msg-avatar">${avatarHTML}</div>
                <div>
                    <div class="msg-content">${escapeHtml(msg.message)}</div>
                    <div class="msg-footer">
                        <span class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button class="msg-reaction-btn ${hasReaction ? 'active' : ''}" onclick="openReactionPicker(${msg.id})">
                            ${hasReaction ? `<span style="font-size:16px;">${reaction}</span>` : '<i class="fas fa-plus"></i>'}
                        </button>
                        ${hasReaction ? `<div class="msg-reactions-display"><span class="msg-reaction-badge">${reaction}</span></div>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Заглушка воспроизведения голосового
    window.toggleVoicePlayback = function(btn, msgId) {
        const icon = btn.querySelector('i');
        if (icon.classList.contains('fa-play')) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
            // здесь должна быть реальная логика Audio
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    };

    // ==================== Реакции (модалка) ====================
    let currentReactionMsgId = null;

    window.openReactionPicker = function(msgId) {
        currentReactionMsgId = msgId;
        const modal = document.getElementById('emojiModalOverlay');
        modal.classList.add('active');
        renderEmojiCategories('people');
    };

    function closeEmojiModal() {
        const modal = document.getElementById('emojiModalOverlay');
        if (modal) modal.classList.remove('active');
        currentReactionMsgId = null;
    }

    const emojiData = {
        people: ['😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘'],
        gestures: ['👍','👎','👏','🙌','🤝','✌️','🤞','🤟','🤘','🤙'],
        hearts: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍'],
        emotions: ['🔥','⭐','🌟','✨','💥','💯'],
        celebrations: ['🎉','🎊','🎈','🎂','🎀','🎁','🏆']
    };

    function renderEmojiCategories(activeCat) {
        const cats = Object.keys(emojiData);
        const catLabels = { people:'Люди', gestures:'Жесты', hearts:'Сердца', emotions:'Эмоции', celebrations:'Праздники' };
        const container = document.getElementById('emojiCats');
        if (container) {
            container.innerHTML = cats.map(cat =>
                `<button class="emoji-cat-btn ${cat===activeCat?'active':''}" onclick="renderEmojiGrid('${cat}')"><i class="fas fa-smile"></i> ${catLabels[cat]}</button>`
            ).join('');
        }
        renderEmojiGrid(activeCat);
    }

    window.renderEmojiGrid = function(category) {
        const grid = document.getElementById('emojiGrid');
        if (grid && emojiData[category]) {
            grid.innerHTML = emojiData[category].map(e =>
                `<div class="emoji-item" onclick="selectReaction('${e}')">${e}</div>`
            ).join('');
        }
    };

    window.selectReaction = function(emoji) {
        if (currentReactionMsgId) {
            if (myReactions[currentReactionMsgId] === emoji) {
                delete myReactions[currentReactionMsgId];
            } else {
                myReactions[currentReactionMsgId] = emoji;
            }
            if (currentChatLogin) renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
            closeEmojiModal();
        }
    };

    // ==================== Отправка сообщений ====================
    async function sendTextMessage() {
        const partner = currentChatLogin;
        if (!partner) return;
        const text = messageInput.value.trim();
        if (!text) return;

        const now = new Date().toISOString();
        const newMsg = { sender: currentUser.login, receiver: partner, message: text, created_at: now, id: Date.now() };
        if (!messagesCache[partner]) messagesCache[partner] = [];
        messagesCache[partner].push(newMsg);
        renderMessages(partner, messagesCache[partner]);

        lastMessagesCache[partner] = {
            text: `Вы: ${text}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (!recentLogins.includes(partner)) {
            recentLogins.push(partner);
        }
        renderChatListInstant(chatSearchInput?.value || '');

        messageInput.value = '';
        messageInput.focus();

        const { error } = await _supabase.from('chat_messages').insert([{ sender: currentUser.login, receiver: partner, message: text }]);
        if (error) {
            showToast('Ошибка отправки');
            messagesCache[partner].pop();
            renderMessages(partner, messagesCache[partner]);
        }
    }

    // Голосовая запись (заглушка)
    let voiceRecording = false;
    let voiceTimer = null;
    let voiceSeconds = 0;
    let voiceInterval = null;

    function startVoiceRecording() {
        const messageInputArea = document.getElementById('messageInputArea') || document.querySelector('.message-input-area');
        if (!messageInputArea || !currentChatLogin) return;
        voiceRecording = true;
        const originalHTML = messageInputArea.innerHTML;
        messageInputArea.setAttribute('data-original-html', originalHTML);
        messageInputArea.innerHTML = `
            <div class="voice-recording-area">
                <div class="voice-waveform-large" id="voiceWaveLarge">${Array.from({length:30}, () => `<div class="voice-bar-large" style="height:3px;"></div>`).join('')}</div>
                <span class="voice-timer-large" id="voiceTimerLarge">00:00</span>
                <button class="voice-stop-btn" id="voiceStopBtn"><i class="fas fa-stop"></i></button>
            </div>`;
        voiceSeconds = 0;
        voiceTimer = setInterval(() => {
            voiceSeconds++;
            const timerEl = document.getElementById('voiceTimerLarge');
            if (timerEl) timerEl.textContent = `00:${String(voiceSeconds).padStart(2,'0')}`;
        }, 1000);
        voiceInterval = setInterval(() => {
            const bars = document.querySelectorAll('.voice-bar-large');
            bars.forEach(bar => {
                bar.style.height = Math.floor(Math.random()*20+3) + 'px';
            });
        }, 100);
        document.getElementById('voiceStopBtn').addEventListener('click', stopVoiceRecording);
    }

    function stopVoiceRecording() {
        if (!voiceRecording) return;
        voiceRecording = false;
        clearInterval(voiceTimer);
        clearInterval(voiceInterval);
        const messageInputArea = document.getElementById('messageInputArea') || document.querySelector('.message-input-area');
        if (messageInputArea) {
            const originalHTML = messageInputArea.getAttribute('data-original-html');
            if (originalHTML) messageInputArea.innerHTML = originalHTML;
        }
        bindInputHandlers();
        if (voiceSeconds > 0 && currentChatLogin) {
            const now = new Date().toISOString();
            const voiceMsg = { sender: currentUser.login, receiver: currentChatLogin, type:'voice', duration: voiceSeconds, created_at: now, id: Date.now() };
            if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
            messagesCache[currentChatLogin].push(voiceMsg);
            renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
            lastMessagesCache[currentChatLogin] = { text: '🎤 Голосовое сообщение', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            if (!recentLogins.includes(currentChatLogin)) recentLogins.push(currentChatLogin);
            renderChatListInstant(chatSearchInput?.value || '');
        }
        voiceSeconds = 0;
    }

    function bindInputHandlers() {
        const sendBtn = document.getElementById('sendMessageBtn');
        const messageInput = document.getElementById('messageInput');
        const voiceBtn = document.getElementById('voiceRecordBtn');
        if (sendBtn) sendBtn.onclick = sendTextMessage;
        if (messageInput) messageInput.onkeydown = e => { if (e.key === 'Enter') sendTextMessage(); };
        if (voiceBtn) voiceBtn.onclick = startVoiceRecording;
    }

    // ==================== Мини‑профиль (выезжает справа) ====================
    window.openMiniProfile = function() {
        if (!currentChatLogin) return;
        let panel = document.getElementById('miniProfilePanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'miniProfilePanel';
            panel.className = 'mini-profile-panel';
            chatViewPanel.appendChild(panel);
        }
        // закрыть при повторном клике
        if (panel.classList.contains('active')) {
            panel.classList.remove('active');
            return;
        }
        const user = allUsers.find(u => u.login === currentChatLogin);
        if (!user) return;
        getProfile(currentChatLogin).then(profile => {
            getUserBadges(currentChatLogin).then(badgesData => {
                const badges = (badgesData || []).map(b => b.badges?.name).filter(Boolean);
                panel.innerHTML = `
                    <div class="mini-profile-close" onclick="document.getElementById('miniProfilePanel').classList.remove('active')"><i class="fas fa-times"></i></div>
                    <div class="mini-profile-avatar-large">${profile?.avatar ? `<img src="${escapeHtml(profile.avatar)}" alt="${currentChatLogin}">` : '<i class="fas fa-user"></i>'}</div>
                    <div class="mini-profile-name">${escapeHtml(profile?.name || currentChatLogin)}</div>
                    <div class="mini-profile-tag">@${currentChatLogin}</div>
                    <div class="mini-profile-status"><i class="fas fa-circle" style="color:${onlineCache[currentChatLogin] ? 'var(--online)' : 'var(--offline)'};"></i> ${onlineCache[currentChatLogin] ? 'В сети' : 'Не в сети'}</div>
                    <div class="mini-profile-desc">${escapeHtml(profile?.description || '')}</div>
                    <div class="mini-profile-badges">${badges.length ? badges.map(b => `<span class="mini-profile-badge">${escapeHtml(b)}</span>`).join('') : '<span style="color:var(--text-muted); font-size:12px;">Нет бейджей</span>'}</div>
                    <div class="mini-profile-date"><i class="fas fa-calendar-alt"></i> В DiamKey с ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'неизвестно'}</div>
                    <button class="mini-profile-btn" onclick="navigateTo('/users/${currentChatLogin}')"><i class="fas fa-external-link-alt"></i> Открыть профиль</button>
                `;
                panel.classList.add('active');
            });
        });
    };

    // Закрытие мини‑профиля при клике вне
    document.addEventListener('click', function(e) {
        const panel = document.getElementById('miniProfilePanel');
        if (panel && panel.classList.contains('active') && !panel.contains(e.target) && e.target !== chatHeaderAvatar && e.target !== chatHeaderName) {
            panel.classList.remove('active');
        }
    });

    // ==================== Звонки ====================
    window.startCall = function(type) {
        if (!currentChatLogin) return;
        callOverlay.style.display = 'flex';
        callName.textContent = currentChatLogin;
        callStatusText.textContent = type === 'voice' ? 'Голосовой вызов...' : 'Видеозвонок...';
    };
    window.endCall = function() {
        callOverlay.style.display = 'none';
    };

    // ==================== Обработчики событий ====================
    bindInputHandlers();
    chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));
    chatHeaderAvatar.addEventListener('click', openMiniProfile);
    chatHeaderName.addEventListener('click', openMiniProfile);

    // Модалка эмодзи (создаётся, если её нет)
    if (!document.getElementById('emojiModalOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'emojiModalOverlay';
        overlay.className = 'emoji-modal-overlay';
        overlay.innerHTML = `
            <div class="emoji-modal">
                <div class="emoji-modal-header">
                    <span class="emoji-modal-title">Выбрать реакцию</span>
                    <button class="mini-profile-close" onclick="closeEmojiModal()"><i class="fas fa-times"></i></button>
                </div>
                <div class="emoji-categories" id="emojiCats"></div>
                <div class="emoji-grid" id="emojiGrid"></div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeEmojiModal();
        });
    }

    // ==================== Старт ====================
    await initialLoad();
}
