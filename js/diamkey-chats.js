// diamkey-chats.js — чаты DiamKey (полный, без сокращений, с реальными аудио/видео звонками)
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    // ==================== ВНЕДРЯЕМ СТИЛИ ЗВОНКОВ ====================
    const callStyles = document.createElement('style');
    callStyles.textContent = `
        .incoming-call-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(20px);
            z-index: 1000; display: none; flex-direction: column;
            align-items: center; justify-content: center; gap: 32px;
        }
        .incoming-call-overlay.active { display: flex; }
        .caller-avatar {
            width: 120px; height: 120px; border-radius: 50%;
            background: rgba(255,255,255,0.1); border: 2px solid var(--accent);
            display: flex; align-items: center; justify-content: center;
            animation: callPulse 1.5s ease-in-out infinite;
            overflow: hidden;
        }
        @keyframes callPulse {
            0%,100% { box-shadow: 0 0 0 0 rgba(192,192,208,0.6); }
            50% { box-shadow: 0 0 0 25px rgba(192,192,208,0); }
        }
        .caller-name { font-size: 28px; font-weight: 700; color: white; }
        .caller-type { font-size: 18px; color: var(--text-muted); }
        .call-actions { display: flex; gap: 24px; }
        .call-accept-btn, .call-decline-btn {
            width: 64px; height: 64px; border-radius: 50%;
            border: 1px solid; display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 24px; transition: transform 0.2s;
        }
        .call-accept-btn { background: rgba(46,204,113,0.2); border-color: #2ecc71; color: #2ecc71; }
        .call-decline-btn { background: rgba(224,93,93,0.2); border-color: #e05d5d; color: #e05d5d; }
        .call-accept-btn:hover { transform: scale(1.1); background: rgba(46,204,113,0.4); }
        .call-decline-btn:hover { transform: scale(1.1); background: rgba(224,93,93,0.4); }

        .active-call-panel {
            position: absolute; bottom: 0; left: 0; right: 0;
            background: rgba(20,20,25,0.95); backdrop-filter: blur(30px);
            border-top: 1px solid var(--border-glass);
            padding: 16px 24px; display: none; align-items: center;
            justify-content: center; gap: 24px; z-index: 50;
        }
        .active-call-panel.active { display: flex; }
        .call-control-btn {
            width: 48px; height: 48px; border-radius: 50%;
            background: rgba(255,255,255,0.08); border: 1px solid var(--border-glass);
            color: white; font-size: 20px; cursor: pointer; display: flex;
            align-items: center; justify-content: center; transition: 0.2s;
        }
        .call-control-btn:hover { background: rgba(255,255,255,0.15); }
        .call-control-btn.disabled { opacity: 0.4; pointer-events: none; }
        .call-control-btn.end-call { background: rgba(224,93,93,0.2); border-color: #e05d5d; color: #e05d5d; }
        .call-timer { font-family: monospace; font-size: 18px; color: white; min-width: 60px; text-align: center; }
        .remote-video-container { display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
        .remote-video-container video { width: 100%; height: 100%; object-fit: cover; }
        .local-video-container { display: none; position: absolute; bottom: 100px; right: 24px; width: 140px; height: 100px; border-radius: 16px; overflow: hidden; border: 2px solid var(--accent); z-index: 2; }
        .local-video-container video { width: 100%; height: 100%; object-fit: cover; }
        .call-ended-msg {
            display: flex; align-items: center; gap: 10px;
            background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass);
            border-radius: 16px; padding: 12px 18px; margin: 8px 0;
            color: var(--text-muted); font-size: 14px; justify-content: center;
        }
    `;
    document.head.appendChild(callStyles);

    // Удаляем старый оверлей звонка, если он остался от предыдущей верстки
    const oldCallOverlay = document.getElementById('callOverlay');
    if (oldCallOverlay) oldCallOverlay.remove();

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
    const chatViewPanel = document.getElementById('chatViewPanel');

    // ==================== Состояние чатов ====================
    let currentChatLogin = null;
    let allUsers = [];
    let recentLogins = [];
    let lastMessagesCache = {};
    let avatarCache = {};
    let onlineCache = {};
    let messagesCache = {};
    let activeMessageToken = 0;

    // ==================== Состояние WebRTC звонков ====================
    let localStream = null;
    let peerConnection = null;
    let currentCallType = null;        // 'voice' или 'video'
    let callChannel = null;           // Supabase Realtime канал
    let isInCall = false;
    let callStartTime = null;
    let callTimerInterval = null;
    let incomingCallData = null;      // { from, type }

    // ==================== СОЗДАНИЕ UI ЗВОНКОВ (ОДИН РАЗ) ====================
    function ensureCallUI() {
        if (document.getElementById('incomingCallOverlay')) return;

        // Оверлей входящего вызова
        const incOverlay = document.createElement('div');
        incOverlay.id = 'incomingCallOverlay';
        incOverlay.className = 'incoming-call-overlay';
        incOverlay.innerHTML = `
            <div class="caller-avatar" id="incCallAvatar"><i class="fas fa-user"></i></div>
            <div class="caller-name" id="incCallName"></div>
            <div class="caller-type" id="incCallType"></div>
            <div class="call-actions"></div>
        `;
        document.body.appendChild(incOverlay);

        // Панель активного звонка (внизу области чата)
        const callPanel = document.createElement('div');
        callPanel.id = 'activeCallPanel';
        callPanel.className = 'active-call-panel';
        callPanel.innerHTML = `
            <button class="call-control-btn" id="toggleMicBtn"><i class="fas fa-microphone"></i></button>
            <span class="call-timer" id="callTimer">00:00</span>
            <button class="call-control-btn end-call" id="endCallBtn"><i class="fas fa-phone-slash"></i></button>
            <button class="call-control-btn" id="toggleVideoBtn"><i class="fas fa-video"></i></button>
        `;
        chatViewPanel.appendChild(callPanel);

        // Контейнеры для видео
        const remoteCont = document.createElement('div');
        remoteCont.id = 'remoteVideoContainer';
        remoteCont.className = 'remote-video-container';
        remoteCont.innerHTML = `<video id="remoteVideo" autoplay playsinline></video>`;
        chatViewPanel.appendChild(remoteCont);

        const localCont = document.createElement('div');
        localCont.id = 'localVideoContainer';
        localCont.className = 'local-video-container';
        localCont.innerHTML = `<video id="localVideo" autoplay muted playsinline></video>`;
        chatViewPanel.appendChild(localCont);

        // Обработчики кнопок
        document.getElementById('toggleMicBtn').addEventListener('click', toggleMic);
        document.getElementById('toggleVideoBtn').addEventListener('click', toggleVideo);
        document.getElementById('endCallBtn').addEventListener('click', endCall);
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ДАННЫХ ЧАТОВ ====================
    async function initialLoad() {
        // Прогресс-бар загрузки
        chatListContainer.innerHTML = `
            <div class="list-loader">
                <i class="fas fa-comments"></i>
                <div class="list-loader-progress"><div class="fill" id="chatsLoaderBar" style="width:0%"></div></div>
                <small>Загружаем чаты...</small>
            </div>`;

        const loaderBar = document.getElementById('chatsLoaderBar');
        let progress = 0;
        const interval = setInterval(() => {
            progress += 7;
            if (progress > 90) progress = 90;
            if (loaderBar) loaderBar.style.width = progress + '%';
        }, 200);

        const [users, presenceData, recent] = await Promise.all([
            getUsers(),
            _supabase.from('user_presence').select('login, last_seen'),
            getRealRecentChats()
        ]);

        clearInterval(interval);
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
        subscribeToIncomingCalls();
        ensureCallUI();
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
            if (msg.sender === currentUser.login) partners.add(msg.receiver);
            else if (msg.receiver === currentUser.login) partners.add(msg.sender);
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

    // ==================== РЕНДЕР СПИСКА ЧАТОВ ====================
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

    // ==================== ВЫБОР ЧАТА ====================
    window._selectChat = async function(login) {
        if (currentChatLogin === login) return;

        currentChatLogin = login;
        activeMessageToken++;
        const token = activeMessageToken;

        noChatSelected.style.display = 'none';
        activeChatView.style.display = 'flex';
        activeChatView.classList.remove('fade-in');
        void activeChatView.offsetWidth;
        activeChatView.classList.add('fade-in');

        const profile = allUsers.find(u => u.login === login);
        chatHeaderName.textContent = profile?.name || login;
        chatHeaderAvatar.innerHTML = getAvatarHTML(login);

        const online = onlineCache[login] ?? false;
        chatHeaderStatus.textContent = online ? 'В сети' : 'Не в сети';
        chatHeaderStatus.className = 'chat-header-status ' + (online ? 'online' : '');

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

        markChatAsRead(login);
        renderChatListInstant(chatSearchInput?.value || '');
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(msg => {
            if (msg.sender === 'system') return `<div class="system-msg">${escapeHtml(msg.message)}</div>`;

            if (msg.type === 'voice') {
                const isMe = msg.sender === currentUser.login;
                return `<div class="voice-message ${isMe ? 'sent' : 'received'}">
                    <button class="voice-play-btn" onclick="toggleVoicePlayback(this)"><i class="fas fa-play"></i></button>
                    <span style="margin:0 8px; font-size:14px;">🎤 Голосовое сообщение</span>
                    <span class="voice-time">0:${String(msg.duration || 0).padStart(2, '0')}</span>
                    <div class="msg-footer"><span class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>`;
            }

            const isMe = msg.sender === currentUser.login;
            const avatar = isMe ? (currentUser.avatar || '') : (avatarCache[login] || '');
            const avatarHTML = avatar ? `<img src="${escapeHtml(avatar)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '<i class="fas fa-user"></i>';

            return `<div class="message ${isMe ? 'sent' : 'received'}">
                <div class="msg-avatar">${avatarHTML}</div>
                <div>
                    <div class="msg-content">${escapeHtml(msg.message)}</div>
                    <div class="msg-footer"><span class="msg-time">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                </div>
            </div>`;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    window.toggleVoicePlayback = function(btn) {
        const icon = btn.querySelector('i');
        if (icon.classList.contains('fa-play')) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        } else {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
    };

    // ==================== ОТПРАВКА СООБЩЕНИЙ ====================
    async function sendTextMessage() {
        if (!currentChatLogin) return;
        const text = messageInput.value.trim();
        if (!text) return;

        const now = new Date().toISOString();
        const newMsg = { sender: currentUser.login, receiver: currentChatLogin, message: text, created_at: now, id: Date.now() };
        if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
        messagesCache[currentChatLogin].push(newMsg);
        renderMessages(currentChatLogin, messagesCache[currentChatLogin]);

        lastMessagesCache[currentChatLogin] = {
            text: `Вы: ${text}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        if (!recentLogins.includes(currentChatLogin)) {
            recentLogins.push(currentChatLogin);
        }
        renderChatListInstant(chatSearchInput?.value || '');

        messageInput.value = '';
        messageInput.focus();

        const { error } = await _supabase.from('chat_messages').insert([{ sender: currentUser.login, receiver: currentChatLogin, message: text }]);
        if (error) {
            showToast('Ошибка отправки');
            messagesCache[currentChatLogin].pop();
            renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
        }
    }

    // ==================== ГОЛОСОВЫЕ СООБЩЕНИЯ ====================
    let voiceRecording = false, voiceTimer = null, voiceSeconds = 0, voiceInterval = null;

    function startVoiceRecording() {
        const messageInputArea = document.getElementById('messageInputArea') || document.querySelector('.message-input-area');
        if (!messageInputArea || !currentChatLogin) return;
        voiceRecording = true;
        const originalHTML = messageInputArea.innerHTML;
        messageInputArea.setAttribute('data-orig', originalHTML);
        messageInputArea.innerHTML = `
            <div class="voice-recording-area">
                <div class="voice-waveform-large" id="voiceWaveLarge">${Array.from({ length: 30 }, () => '<div class="voice-bar-large" style="height:3px;"></div>').join('')}</div>
                <span class="voice-timer-large" id="voiceTimerLarge">00:00</span>
                <button class="voice-stop-btn" id="voiceStopBtn"><i class="fas fa-stop"></i></button>
            </div>`;
        voiceSeconds = 0;
        voiceTimer = setInterval(() => {
            voiceSeconds++;
            const el = document.getElementById('voiceTimerLarge');
            if (el) el.textContent = `00:${String(voiceSeconds).padStart(2, '0')}`;
        }, 1000);
        voiceInterval = setInterval(() => {
            const bars = document.querySelectorAll('.voice-bar-large');
            bars.forEach(bar => {
                bar.style.height = Math.floor(Math.random() * 20 + 3) + 'px';
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
            const orig = messageInputArea.getAttribute('data-orig');
            if (orig) messageInputArea.innerHTML = orig;
        }
        bindInputHandlers();
        if (voiceSeconds > 0 && currentChatLogin) {
            const now = new Date().toISOString();
            const voiceMsg = { sender: currentUser.login, receiver: currentChatLogin, type: 'voice', duration: voiceSeconds, created_at: now, id: Date.now() };
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
        const sb = document.getElementById('sendMessageBtn');
        const mi = document.getElementById('messageInput');
        const vb = document.getElementById('voiceRecordBtn');
        if (sb) sb.onclick = sendTextMessage;
        if (mi) mi.onkeydown = e => { if (e.key === 'Enter') sendTextMessage(); };
        if (vb) vb.onclick = startVoiceRecording;
    }

    // ==================== МИНИ-ПРОФИЛЬ ====================
    window.openMiniProfile = function() {
        if (!currentChatLogin) return;
        let panel = document.getElementById('miniProfilePanel');
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'miniProfilePanel';
            panel.className = 'mini-profile-panel';
            chatViewPanel.appendChild(panel);
        }
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
                    <div class="mini-profile-badges">${badges.length ? badges.map(b => `<span class="mini-profile-badge">${escapeHtml(b)}</span>`).join('') : '<span style="color:var(--text-muted);font-size:12px;">Нет бейджей</span>'}</div>
                    <div class="mini-profile-date"><i class="fas fa-calendar-alt"></i> В DiamKey с ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'неизвестно'}</div>
                    <button class="mini-profile-btn" onclick="navigateTo('/users/${currentChatLogin}')"><i class="fas fa-external-link-alt"></i> Открыть профиль</button>
                `;
                panel.classList.add('active');
            });
        });
    };

    document.addEventListener('click', e => {
        const panel = document.getElementById('miniProfilePanel');
        if (panel && panel.classList.contains('active') && !panel.contains(e.target) && e.target !== chatHeaderAvatar && e.target !== chatHeaderName) {
            panel.classList.remove('active');
        }
    });

    // ==================== ЗВОНКИ (WEBRTC + SUPABASE REALTIME) ====================
    async function getLocalMedia(type) {
        const constraints = { audio: true, video: type === 'video' };
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
            showToast('Нет доступа к камере/микрофону');
            return null;
        }
    }

    async function createPeerConnection(stream) {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        pc.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) remoteVideo.srcObject = event.streams[0];
        };
        pc.onicecandidate = (event) => {
            if (event.candidate && callChannel) {
                callChannel.send({ type: 'ice-candidate', candidate: event.candidate, sender: currentUser.login });
            }
        };
        return pc;
    }

    function setupCallChannel(partner) {
        const channelName = `call_${[currentUser.login, partner].sort().join('_')}`;
        callChannel = _supabase.channel(channelName);
        callChannel.on('broadcast', { event: 'signal' }, (payload) => {
            const msg = payload.payload;
            if (msg.sender === currentUser.login) return;
            handleSignalMessage(msg);
        });
        callChannel.subscribe();
    }

    async function handleSignalMessage(msg) {
        if (!peerConnection) return;
        if (msg.type === 'offer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            callChannel.send({ type: 'answer', sdp: answer, sender: currentUser.login });
        } else if (msg.type === 'answer') {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        } else if (msg.type === 'ice-candidate') {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === 'hangup') {
            endCallInternal();
        }
    }

    async function initiateCall(type) {
        if (!currentChatLogin) return;
        if (isInCall) { showToast('Уже в звонке'); return; }

        incomingCallData = { from: currentUser.login, type };
        const overlay = document.getElementById('incomingCallOverlay');
        overlay.classList.add('active');
        document.getElementById('incCallName').textContent = currentChatLogin;
        document.getElementById('incCallType').textContent = type === 'voice' ? 'Голосовой вызов' : 'Видеозвонок';
        document.querySelector('#incomingCallOverlay .call-actions').innerHTML = `
            <button class="call-decline-btn" onclick="cancelOutgoingCall()"><i class="fas fa-phone-slash"></i></button>
        `;

        const targetChannel = _supabase.channel(`user_${currentChatLogin}`);
        await targetChannel.subscribe();
        await targetChannel.send({ type: 'broadcast', event: 'incoming_call', payload: { from: currentUser.login, type } });

        setTimeout(() => {
            if (!isInCall && incomingCallData) cancelOutgoingCall();
        }, 30000);
    }

    window.cancelOutgoingCall = function() {
        document.getElementById('incomingCallOverlay').classList.remove('active');
        incomingCallData = null;
    };

    function subscribeToIncomingCalls() {
        const incomingChannel = _supabase.channel(`user_${currentUser.login}`);
        incomingChannel.on('broadcast', { event: 'incoming_call' }, (payload) => {
            const { from, type } = payload.payload;
            incomingCallData = { from, type };
            const overlay = document.getElementById('incomingCallOverlay');
            overlay.classList.add('active');
            document.getElementById('incCallName').textContent = from;
            document.getElementById('incCallType').textContent = type === 'voice' ? 'Голосовой вызов' : 'Видеозвонок';
            document.querySelector('#incomingCallOverlay .call-actions').innerHTML = `
                <button class="call-decline-btn" onclick="declineIncomingCall()"><i class="fas fa-phone-slash"></i></button>
                <button class="call-accept-btn" onclick="acceptIncomingCall()"><i class="fas fa-phone"></i></button>
            `;
        });
        incomingChannel.subscribe();
    }

    window.declineIncomingCall = function() {
        document.getElementById('incomingCallOverlay').classList.remove('active');
        if (incomingCallData) {
            const targetChannel = _supabase.channel(`user_${incomingCallData.from}`);
            targetChannel.subscribe().then(() => {
                targetChannel.send({ type: 'broadcast', event: 'call_declined', payload: { from: currentUser.login } });
            });
        }
        incomingCallData = null;
    };

    window.acceptIncomingCall = async function() {
        if (!incomingCallData) return;
        document.getElementById('incomingCallOverlay').classList.remove('active');
        const { from, type } = incomingCallData;
        incomingCallData = null;
        currentChatLogin = from;
        await startCallInternal(type);
    };

    const declineChannel = _supabase.channel(`user_${currentUser.login}_decline`);
    declineChannel.on('broadcast', { event: 'call_declined' }, () => {
        cancelOutgoingCall();
        showToast('Вызов отклонён');
    });
    declineChannel.subscribe();

    window.startCall = function(type) {
        initiateCall(type);
    };

    async function startCallInternal(type) {
        if (isInCall) return;
        const stream = await getLocalMedia(type);
        if (!stream) return;
        localStream = stream;
        currentCallType = type;

        const panel = document.getElementById('activeCallPanel');
        panel.classList.add('active');
        callStartTime = Date.now();
        updateCallTimer();
        callTimerInterval = setInterval(updateCallTimer, 1000);

        document.getElementById('localVideo').srcObject = stream;
        if (type === 'voice') {
            document.getElementById('localVideoContainer').style.display = 'none';
            document.getElementById('remoteVideoContainer').style.display = 'none';
        } else {
            document.getElementById('localVideoContainer').style.display = 'block';
            document.getElementById('remoteVideoContainer').style.display = 'block';
        }

        setupCallChannel(currentChatLogin);
        peerConnection = await createPeerConnection(stream);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        callChannel.send({ type: 'offer', sdp: offer, sender: currentUser.login });

        isInCall = true;
    }

    function updateCallTimer() {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        document.getElementById('callTimer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    window.endCall = function() {
        if (callChannel) callChannel.send({ type: 'hangup', sender: currentUser.login });
        endCallInternal();
    };

    function endCallInternal() {
        const duration = callStartTime ? Math.floor((Date.now() - callStartTime) / 1000) : 0;
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (peerConnection) peerConnection.close();
        if (callChannel) _supabase.removeChannel(callChannel);
        localStream = null;
        peerConnection = null;
        callChannel = null;
        isInCall = false;
        clearInterval(callTimerInterval);

        document.getElementById('activeCallPanel').classList.remove('active');
        document.getElementById('localVideoContainer').style.display = 'none';
        document.getElementById('remoteVideoContainer').style.display = 'none';

        if (currentChatLogin && duration > 0) {
            const m = Math.floor(duration / 60);
            const s = duration % 60;
            const callMsg = {
                sender: 'system',
                receiver: currentChatLogin,
                message: `📞 Вызов завершён · ${m}:${String(s).padStart(2, '0')}`,
                created_at: new Date().toISOString()
            };
            if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
            messagesCache[currentChatLogin].push(callMsg);
            renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
        }
        callStartTime = null;
    }

    function toggleMic() {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                document.getElementById('toggleMicBtn').querySelector('i').className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
            }
        }
    }

    function toggleVideo() {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                document.getElementById('toggleVideoBtn').querySelector('i').className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash';
            }
        }
    }

    // ==================== ФИНАЛЬНАЯ ПРИВЯЗКА ====================
    bindInputHandlers();
    chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));
    chatHeaderAvatar.addEventListener('click', openMiniProfile);
    chatHeaderName.addEventListener('click', openMiniProfile);
    await initialLoad();
}
