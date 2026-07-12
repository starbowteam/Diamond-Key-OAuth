// diamkey-chats.js — чаты DiamKey (полный, без сокращений, все баги пофикшены)
async function renderChats() {
    if (!currentUser) {
        navigateTo('/home');
        return;
    }

    // ==================== СТИЛИ ====================
    const callStyles = document.createElement('style');
    callStyles.textContent = `
        /* входящий вызов */
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
        .caller-avatar img { width: 100%; height: 100%; object-fit: cover; }
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

        /* активный звонок */
        .call-modal {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.92); backdrop-filter: blur(30px);
            z-index: 1001; display: none; flex-direction: column;
            align-items: center; justify-content: center;
        }
        .call-modal.active { display: flex; }
        .call-modal-content {
            display: flex; flex-direction: column; align-items: center; gap: 24px;
            width: 90%; max-width: 800px;
        }
        .call-boxes {
            display: flex; gap: 20px; width: 100%; justify-content: center;
        }
        .call-box {
            flex: 1; max-width: 360px; aspect-ratio: 4 / 3;
            border-radius: 24px; overflow: hidden;
            background: #1a1a24; border: 2px solid var(--accent);
            box-shadow: 0 0 40px rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            position: relative;
        }
        .call-box video { width: 100%; height: 100%; object-fit: cover; }
        .call-box-avatar {
            width: 100%; height: 100%; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 12px;
            color: var(--text-muted); font-size: 16px;
            background: radial-gradient(circle at center, rgba(255,255,255,0.05), transparent);
        }
        .call-box-avatar i { font-size: 56px; }
        .call-modal-name { font-size: 22px; font-weight: 700; color: white; }
        .call-modal-timer { font-family: monospace; font-size: 20px; color: var(--text-muted); }
        .call-modal-controls {
            display: flex; gap: 20px;
        }
        .call-modal-btn {
            width: 56px; height: 56px; border-radius: 50%;
            background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
            color: white; font-size: 22px; cursor: pointer; display: flex;
            align-items: center; justify-content: center; transition: 0.2s;
        }
        .call-modal-btn:hover { background: rgba(255,255,255,0.2); }
        .call-modal-btn.disabled { opacity: 0.4; pointer-events: none; }
        .call-modal-btn.end-call { background: rgba(224,93,93,0.3); border-color: #e05d5d; color: #e05d5d; }
        .call-modal-btn.end-call:hover { background: rgba(224,93,93,0.6); }
    `;
    document.head.appendChild(callStyles);

    // удаляем старый оверлей, если остался
    const oldCallOverlay = document.getElementById('callOverlay');
    if (oldCallOverlay) oldCallOverlay.remove();

    // ==================== DOM ====================
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

    // ==================== СОСТОЯНИЕ ====================
    let currentChatLogin = null;
    let allUsers = [];
    let recentLogins = [];
    let lastMessagesCache = {};
    let avatarCache = {};
    let onlineCache = {};
    window._onlineCache = onlineCache;   // для обновления из core.js
    let messagesCache = {};
    let activeMessageToken = 0;
    let messageSubscription = null;

    // звонки
    let localStream = null;
    let peerConnection = null;
    let currentCallPartner = null;
    let currentCallType = null;
    let callChannel = null;
    let isInCall = false;
    let callStartTime = null;
    let callTimerInterval = null;
    let callRole = null;
    let incomingCallData = null;
    let callAcceptedChannel = null;
    let callDeclineChannel = null;

    // голосовые сообщения
    let mediaRecorder = null;
    let audioChunks = [];
    let voiceRecording = false;
    let voiceSeconds = 0;
    let voiceTimer = null;
    let voiceInterval = null;

    // ==================== UI ЗВОНКОВ ====================
    function ensureCallUI() {
        if (document.getElementById('incomingCallOverlay')) return;

        const incOverlay = document.createElement('div');
        incOverlay.id = 'incomingCallOverlay';
        incOverlay.className = 'incoming-call-overlay';
        incOverlay.innerHTML = `
            <div class="caller-avatar" id="incCallAvatar"><i class="fas fa-user"></i></div>
            <div class="caller-name" id="incCallName"></div>
            <div class="caller-type" id="incCallType"></div>
            <div class="call-actions" id="incCallActions"></div>
        `;
        document.body.appendChild(incOverlay);

        const callModal = document.createElement('div');
        callModal.id = 'callModal';
        callModal.className = 'call-modal';
        callModal.innerHTML = `
            <div class="call-modal-content">
                <div class="call-modal-name" id="callModalName"></div>
                <div class="call-modal-timer" id="callModalTimer">00:00</div>
                <div class="call-boxes">
                    <div class="call-box" id="remoteBox">
                        <video id="callRemoteVideo" autoplay playsinline></video>
                        <div class="call-box-avatar" id="remoteAvatar"><i class="fas fa-user"></i> <span id="remoteName"></span></div>
                    </div>
                    <div class="call-box" id="localBox">
                        <video id="callLocalVideo" autoplay muted playsinline></video>
                        <div class="call-box-avatar" id="localAvatar"><i class="fas fa-user"></i> <span>Вы</span></div>
                    </div>
                </div>
                <div class="call-modal-controls">
                    <button class="call-modal-btn" id="callToggleMicBtn"><i class="fas fa-microphone"></i></button>
                    <button class="call-modal-btn" id="callToggleVideoBtn"><i class="fas fa-video"></i></button>
                    <button class="call-modal-btn end-call" id="callEndBtn"><i class="fas fa-phone-slash"></i></button>
                </div>
            </div>
        `;
        document.body.appendChild(callModal);

        document.getElementById('callToggleMicBtn').addEventListener('click', toggleCallMic);
        document.getElementById('callToggleVideoBtn').addEventListener('click', toggleCallVideo);
        document.getElementById('callEndBtn').addEventListener('click', endCall);
    }

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    async function initialLoad() {
        // если первый раз – прогресс-бар
        if (!allUsers.length) {
            chatListContainer.innerHTML = `<div class="list-loader">
                <i class="fas fa-comments"></i>
                <div class="list-loader-progress"><div class="fill" id="chatsLoaderBar" style="width:0%"></div></div>
                <small>Загружаем чаты...</small>
            </div>`;
            const loaderBar = document.getElementById('chatsLoaderBar');
            let progress = 0;
            const interval = setInterval(() => {
                progress += 7; if (progress > 90) progress = 90;
                if (loaderBar) loaderBar.style.width = progress + '%';
            }, 200);
            await new Promise(r => setTimeout(r, 500));
            clearInterval(interval);
            if (loaderBar) loaderBar.style.width = '100%';
            await new Promise(r => setTimeout(r, 300));
        }

        const [users, presenceData, recent] = await Promise.all([
            getUsers(),
            _supabase.from('user_presence').select('login, last_seen'),
            getRealRecentChats()
        ]);

        allUsers = users.filter(u => u.login !== currentUser.login);
        const now = Date.now();
        (presenceData.data || []).forEach(p => {
            onlineCache[p.login] = (now - new Date(p.last_seen).getTime()) < 120000;
        });
        allUsers.forEach(u => { if (!(u.login in onlineCache)) onlineCache[u.login] = false; });

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
        subscribeToMessages();
        ensureCallUI();
        if (typeof subscribePresence === 'function') subscribePresence();   // обновление онлайна
    }

    // ... продолжение в следующем сообщении ...

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
                    text: `${last.sender === currentUser.login ? 'Вы' : login}: ${last.message || (last.type === 'voice' ? '🎤 Голосовое' : '')}`,
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
        chatHeaderStatus.textContent = onlineCache[login] ? 'В сети' : 'Не в сети';
        chatHeaderStatus.className = 'chat-header-status ' + (onlineCache[login] ? 'online' : '');
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
                    <button class="voice-play-btn" onclick="toggleVoicePlayback(this, '${msg.audio_url || ''}')"><i class="fas fa-play"></i></button>
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

    window.toggleVoicePlayback = function(btn, url) {
        if (!url) return;
        const icon = btn.querySelector('i');
        if (icon.classList.contains('fa-play')) {
            if (window._currentVoiceAudio) { window._currentVoiceAudio.pause(); }
            const audio = new Audio(url);
            window._currentVoiceAudio = audio;
            audio.play();
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
            audio.onended = () => {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            };
        } else {
            if (window._currentVoiceAudio) {
                window._currentVoiceAudio.pause();
            }
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
        lastMessagesCache[currentChatLogin] = { text: `Вы: ${text}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        if (!recentLogins.includes(currentChatLogin)) recentLogins.push(currentChatLogin);
        renderChatListInstant(chatSearchInput?.value || '');
        messageInput.value = ''; messageInput.focus();
        const { error } = await _supabase.from('chat_messages').insert([{ sender: currentUser.login, receiver: currentChatLogin, message: text }]);
        if (error) { showToast('Ошибка отправки'); messagesCache[currentChatLogin].pop(); renderMessages(currentChatLogin, messagesCache[currentChatLogin]); }
    }

    // ==================== ГОЛОСОВЫЕ СООБЩЕНИЯ ====================
    async function startVoiceRecording() {
        const area = document.getElementById('messageInputArea') || document.querySelector('.message-input-area');
        if (!area || !currentChatLogin) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                const url = URL.createObjectURL(blob);
                uploadVoiceMessage(blob, url);
            };
            mediaRecorder.start();
            voiceRecording = true;
            const orig = area.innerHTML;
            area.setAttribute('data-orig', orig);
            area.innerHTML = `<div class="voice-recording-area"><div class="voice-waveform-large" id="voiceWaveLarge">${Array.from({length:30},()=>'<div class="voice-bar-large" style="height:3px;"></div>').join('')}</div><span class="voice-timer-large" id="voiceTimerLarge">00:00</span><button class="voice-stop-btn" id="voiceStopBtn"><i class="fas fa-stop"></i></button></div>`;
            voiceSeconds = 0;
            voiceTimer = setInterval(() => { voiceSeconds++; const el = document.getElementById('voiceTimerLarge'); if(el) el.textContent = `00:${String(voiceSeconds).padStart(2,'0')}`; }, 1000);
            voiceInterval = setInterval(() => document.querySelectorAll('.voice-bar-large').forEach(b => b.style.height = Math.floor(Math.random()*20+3)+'px'), 100);
            document.getElementById('voiceStopBtn').addEventListener('click', stopVoiceRecording);
        } catch (e) { showToast('Нет доступа к микрофону'); }
    }

    function stopVoiceRecording() {
        if (!voiceRecording) return;
        voiceRecording = false;
        clearInterval(voiceTimer); clearInterval(voiceInterval);
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(t => t.stop());
        }
        const area = document.getElementById('messageInputArea') || document.querySelector('.message-input-area');
        if (area) { const orig = area.getAttribute('data-orig'); if (orig) area.innerHTML = orig; }
        bindInputHandlers();
    }

    async function uploadVoiceMessage(blob, localUrl) {
        if (!currentChatLogin) return;
        const fileName = `voice_${Date.now()}_${Math.random().toString(36).substr(2,6)}.webm`;
        const { error } = await _supabase.storage.from('wall_audio').upload(fileName, blob, { contentType: 'audio/webm', cacheControl: '3600' });
        if (error) { showToast('Ошибка загрузки голосового'); return; }
        const { data: { publicUrl } } = _supabase.storage.from('wall_audio').getPublicUrl(fileName);
        const now = new Date().toISOString();
        const voiceMsg = { sender: currentUser.login, receiver: currentChatLogin, type: 'voice', audio_url: publicUrl, duration: voiceSeconds, created_at: now, id: Date.now() };
        await _supabase.from('chat_messages').insert([{ sender: currentUser.login, receiver: currentChatLogin, message: '', type: 'voice', audio_url: publicUrl, duration: voiceSeconds }]);
        if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
        messagesCache[currentChatLogin].push(voiceMsg);
        renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
        lastMessagesCache[currentChatLogin] = { text: '🎤 Голосовое сообщение', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
        if (!recentLogins.includes(currentChatLogin)) recentLogins.push(currentChatLogin);
        renderChatListInstant(chatSearchInput?.value || '');
    }

    function bindInputHandlers() {
        const sb = document.getElementById('sendMessageBtn'), mi = document.getElementById('messageInput'), vb = document.getElementById('voiceRecordBtn');
        if (sb) sb.onclick = sendTextMessage;
        if (mi) mi.onkeydown = e => { if (e.key==='Enter') sendTextMessage(); };
        if (vb) vb.onclick = startVoiceRecording;
    }

    window.openMiniProfile = function() {
        if (!currentChatLogin) return;
        let panel = document.getElementById('miniProfilePanel');
        if (!panel) { panel = document.createElement('div'); panel.id = 'miniProfilePanel'; panel.className = 'mini-profile-panel'; chatViewPanel.appendChild(panel); }
        if (panel.classList.contains('active')) { panel.classList.remove('active'); return; }
        const user = allUsers.find(u => u.login === currentChatLogin);
        if (!user) return;
        getProfile(currentChatLogin).then(profile => {
            getUserBadges(currentChatLogin).then(badgesData => {
                const badges = (badgesData||[]).map(b=>b.badges?.name).filter(Boolean);
                panel.innerHTML = `<div class="mini-profile-close" onclick="document.getElementById('miniProfilePanel').classList.remove('active')"><i class="fas fa-times"></i></div>
                    <div class="mini-profile-avatar-large">${profile?.avatar?`<img src="${escapeHtml(profile.avatar)}" alt="${currentChatLogin}">`:'<i class="fas fa-user"></i>'}</div>
                    <div class="mini-profile-name">${escapeHtml(profile?.name||currentChatLogin)}</div><div class="mini-profile-tag">@${currentChatLogin}</div>
                    <div class="mini-profile-status"><i class="fas fa-circle" style="color:${onlineCache[currentChatLogin]?'var(--online)':'var(--offline)'};"></i> ${onlineCache[currentChatLogin]?'В сети':'Не в сети'}</div>
                    <div class="mini-profile-desc">${escapeHtml(profile?.description||'')}</div>
                    <div class="mini-profile-badges">${badges.length?badges.map(b=>`<span class="mini-profile-badge">${escapeHtml(b)}</span>`).join(''):'<span style="color:var(--text-muted);font-size:12px;">Нет бейджей</span>'}</div>
                    <div class="mini-profile-date"><i class="fas fa-calendar-alt"></i> В DiamKey с ${profile?.created_at?new Date(profile.created_at).toLocaleDateString():'неизвестно'}</div>
                    <button class="mini-profile-btn" onclick="navigateTo('/users/${currentChatLogin}')"><i class="fas fa-external-link-alt"></i> Открыть профиль</button>`;
                panel.classList.add('active');
            });
        });
    };
    document.addEventListener('click', e => {
        const panel = document.getElementById('miniProfilePanel');
        if (panel && panel.classList.contains('active') && !panel.contains(e.target) && e.target!==chatHeaderAvatar && e.target!==chatHeaderName) panel.classList.remove('active');
    });

    // ==================== REALTIME СООБЩЕНИЯ ====================
    function subscribeToMessages() {
        if (messageSubscription) _supabase.removeChannel(messageSubscription);
        messageSubscription = _supabase
            .channel('chat_messages_channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `receiver=eq.${currentUser.login}` }, payload => {
                const newMsg = payload.new;
                if (!newMsg || !newMsg.sender) return;
                // своё сообщение с другой вкладки – добавляем, если ещё нет
                if (newMsg.sender === currentUser.login) {
                    if (!messagesCache[newMsg.receiver]) messagesCache[newMsg.receiver] = [];
                    const exists = messagesCache[newMsg.receiver].some(m => m.id === newMsg.id);
                    if (!exists) {
                        messagesCache[newMsg.receiver].push(newMsg);
                        if (currentChatLogin === newMsg.receiver) renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
                    }
                    return;
                }
                // входящее
                if (!messagesCache[newMsg.sender]) messagesCache[newMsg.sender] = [];
                messagesCache[newMsg.sender].push(newMsg);
                if (newMsg.message && newMsg.sender !== 'system') {
                    lastMessagesCache[newMsg.sender] = {
                        text: `${newMsg.sender}: ${newMsg.message || (newMsg.type === 'voice' ? '🎤 Голосовое' : '')}`,
                        time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    };
                    if (!recentLogins.includes(newMsg.sender)) recentLogins.push(newMsg.sender);
                    addUnreadMessage(newMsg.sender);
                }
                if (currentChatLogin === newMsg.sender) renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
                renderChatListInstant(chatSearchInput?.value || '');
            })
            .subscribe();
    }

    // ==================== ЗВОНКИ ====================
    async function getLocalMedia(type) {
        const constraints = { audio: true, video: type === 'video' };
        try { return await navigator.mediaDevices.getUserMedia(constraints); }
        catch (e) { showToast('Нет доступа к камере/микрофону'); cleanupCallState(); return null; }
    }

    async function createPeerConnection(stream) {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        pc.ontrack = (event) => {
            const remoteVideo = document.getElementById('callRemoteVideo');
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.style.display = 'block';
                document.getElementById('remoteAvatar').style.display = 'none';
            }
        };
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                endCallInternal();
            }
        };
        pc.onicecandidate = (event) => {
            if (event.candidate && callChannel) {
                callChannel.send({ type: 'ice-candidate', candidate: event.candidate, sender: currentUser.login });
            }
        };
        return pc;
    }

    function setupCallChannel(partner) {
        if (callChannel) _supabase.removeChannel(callChannel);
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
        try {
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
            } else if (msg.type === 'video-state-change') {
                const remoteVideo = document.getElementById('callRemoteVideo');
                const remoteAvatar = document.getElementById('remoteAvatar');
                if (msg.enabled) {
                    remoteVideo.style.display = 'block';
                    remoteAvatar.style.display = 'none';
                } else {
                    remoteVideo.style.display = 'none';
                    remoteAvatar.style.display = 'flex';
                }
            }
        } catch(e) { console.error('Signal error:', e); }
    }

    window.startCall = async function(type) {
        if (!currentChatLogin || isInCall) return;
        currentCallPartner = currentChatLogin;
        currentCallType = type;
        callRole = 'caller';

        const overlay = document.getElementById('incomingCallOverlay');
        overlay.classList.add('active');
        document.getElementById('incCallName').textContent = currentChatLogin;
        document.getElementById('incCallType').textContent = type === 'voice' ? 'Голосовой вызов' : 'Видеозвонок';
        document.getElementById('incCallActions').innerHTML = '<button class="call-decline-btn" onclick="cancelOutgoingCall()"><i class="fas fa-phone-slash"></i></button>';

        const targetChannel = _supabase.channel(`user_${currentChatLogin}`);
        await targetChannel.subscribe();
        await targetChannel.send({ type: 'broadcast', event: 'incoming_call', payload: { from: currentUser.login, type } });
        setTimeout(() => { if (!isInCall && callRole === 'caller') { cancelOutgoingCall(); showToast('Вызов не принят'); } }, 30000);
    };

    window.cancelOutgoingCall = function() {
        document.getElementById('incomingCallOverlay').classList.remove('active');
        cleanupCallState();
    };

    function subscribeToIncomingCalls() {
        if (callAcceptedChannel) _supabase.removeChannel(callAcceptedChannel);
        if (callDeclineChannel) _supabase.removeChannel(callDeclineChannel);
        const incomingChannel = _supabase.channel(`user_${currentUser.login}`);
        incomingChannel.on('broadcast', { event: 'incoming_call' }, (payload) => {
            const { from, type } = payload.payload;
            incomingCallData = { from, type };
            const overlay = document.getElementById('incomingCallOverlay');
            overlay.classList.add('active');
            document.getElementById('incCallName').textContent = from;
            document.getElementById('incCallType').textContent = type === 'voice' ? 'Голосовой вызов' : 'Видеозвонок';
            document.getElementById('incCallActions').innerHTML = `
                <button class="call-decline-btn" onclick="declineIncomingCall()"><i class="fas fa-phone-slash"></i></button>
                <button class="call-accept-btn" onclick="acceptIncomingCall()"><i class="fas fa-phone"></i></button>`;
            const avatarEl = document.getElementById('incCallAvatar');
            const av = avatarCache[from];
            avatarEl.innerHTML = av ? `<img src="${escapeHtml(av)}" alt="${from}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>';
        });
        incomingChannel.subscribe();

        callAcceptedChannel = _supabase.channel(`user_${currentUser.login}_accepted`);
        callAcceptedChannel.on('broadcast', { event: 'call_accepted' }, async () => {
            if (callRole === 'caller' && !isInCall) {
                document.getElementById('incomingCallOverlay').classList.remove('active');
                await startCaller();
            }
        });
        callAcceptedChannel.subscribe();

        callDeclineChannel = _supabase.channel(`user_${currentUser.login}_decline`);
        callDeclineChannel.on('broadcast', { event: 'call_declined' }, () => {
            if (callRole === 'caller' && !isInCall) { cancelOutgoingCall(); showToast('Вызов отклонён'); }
        });
        callDeclineChannel.subscribe();
    }

    window.declineIncomingCall = async function() {
        document.getElementById('incomingCallOverlay').classList.remove('active');
        if (incomingCallData) {
            const ch = _supabase.channel(`user_${incomingCallData.from}_decline`);
            await ch.subscribe();
            await ch.send({ type: 'broadcast', event: 'call_declined', payload: { from: currentUser.login } });
        }
        incomingCallData = null;
        cleanupCallState();
    };

    window.acceptIncomingCall = async function() {
        if (!incomingCallData) return;
        const { from, type } = incomingCallData;
        incomingCallData = null;
        document.getElementById('incomingCallOverlay').classList.remove('active');
        currentCallPartner = from;
        currentCallType = type;
        callRole = 'callee';
        const ch = _supabase.channel(`user_${from}_accepted`);
        await ch.subscribe();
        await ch.send({ type: 'broadcast', event: 'call_accepted', payload: { from: currentUser.login } });
        await startCallee();
    };

    async function startCaller() {
        const stream = await getLocalMedia(currentCallType);
        if (!stream) return;
        localStream = stream;
        setupCallChannel(currentCallPartner);
        peerConnection = await createPeerConnection(stream);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        callChannel.send({ type: 'offer', sdp: offer, sender: currentUser.login });
        showCallModal();
        startCallTimer();
        isInCall = true;
    }

    async function startCallee() {
        const stream = await getLocalMedia(currentCallType);
        if (!stream) return;
        localStream = stream;
        setupCallChannel(currentCallPartner);
        peerConnection = await createPeerConnection(stream);
        showCallModal();
        startCallTimer();
        isInCall = true;
    }

    function showCallModal() {
        const modal = document.getElementById('callModal');
        modal.classList.add('active');
        document.getElementById('callModalName').textContent = currentCallPartner;
        document.getElementById('remoteName').textContent = currentCallPartner;

        const rv = document.getElementById('callRemoteVideo');
        const ra = document.getElementById('remoteAvatar');
        const lv = document.getElementById('callLocalVideo');
        const la = document.getElementById('localAvatar');

        if (currentCallType === 'video') {
            lv.srcObject = localStream;
            lv.style.display = 'block'; la.style.display = 'none';
            rv.style.display = 'none'; ra.style.display = 'flex';
        } else {
            lv.style.display = 'none'; la.style.display = 'flex';
            rv.style.display = 'none'; ra.style.display = 'flex';
        }
    }

    function startCallTimer() {
        callStartTime = Date.now();
        updateCallTimer();
        callTimerInterval = setInterval(updateCallTimer, 1000);
    }

    function updateCallTimer() {
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const m = Math.floor(elapsed / 60), s = elapsed % 60;
        document.getElementById('callModalTimer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }

    function toggleCallMic() {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            document.getElementById('callToggleMicBtn').querySelector('i').className = audioTrack.enabled ? 'fas fa-microphone' : 'fas fa-microphone-slash';
        }
    }

    function toggleCallVideo() {
        if (!localStream || currentCallType !== 'video') return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const icon = document.getElementById('callToggleVideoBtn').querySelector('i');
            icon.className = videoTrack.enabled ? 'fas fa-video' : 'fas fa-video-slash';
            const lv = document.getElementById('callLocalVideo');
            const la = document.getElementById('localAvatar');
            if (videoTrack.enabled) { lv.style.display = 'block'; la.style.display = 'none'; }
            else { lv.style.display = 'none'; la.style.display = 'flex'; }
            if (callChannel) callChannel.send({ type: 'video-state-change', enabled: videoTrack.enabled, sender: currentUser.login });
        }
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
        localStream = null; peerConnection = null; callChannel = null;
        isInCall = false; clearInterval(callTimerInterval);
        document.getElementById('callModal').classList.remove('active');
        document.getElementById('incomingCallOverlay').classList.remove('active');
        if (currentCallPartner && duration > 0) {
            const m = Math.floor(duration / 60), s = duration % 60;
            const callMsg = { sender:'system', receiver:currentCallPartner, message:`📞 Вызов завершён · ${m}:${String(s).padStart(2,'0')}`, created_at:new Date().toISOString() };
            if (!messagesCache[currentCallPartner]) messagesCache[currentCallPartner] = [];
            messagesCache[currentCallPartner].push(callMsg);
            if (currentChatLogin === currentCallPartner) renderMessages(currentCallPartner, messagesCache[currentCallPartner]);
        }
        cleanupCallState();
    }

    function cleanupCallState() {
        currentCallPartner = null; currentCallType = null; callRole = null; incomingCallData = null;
        if (callTimerInterval) clearInterval(callTimerInterval);
        if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
        if (peerConnection) { peerConnection.close(); peerConnection = null; }
        if (callChannel) { _supabase.removeChannel(callChannel); callChannel = null; }
        isInCall = false;
    }

    // очистка при уходе со страницы
    function cleanupAll() {
        if (isInCall) endCallInternal();
        if (messageSubscription) { _supabase.removeChannel(messageSubscription); messageSubscription = null; }
        if (callAcceptedChannel) { _supabase.removeChannel(callAcceptedChannel); callAcceptedChannel = null; }
        if (callDeclineChannel) { _supabase.removeChannel(callDeclineChannel); callDeclineChannel = null; }
        if (typeof unsubscribePresence === 'function') unsubscribePresence();
    }
    window.addEventListener('beforeunload', cleanupAll);
    // при SPA-уходе (если роутер сменит страницу) тоже очищаем
    const observer = new MutationObserver(() => {
        if (!document.getElementById('page-chats')?.classList.contains('active')) {
            cleanupAll();
        }
    });
    observer.observe(document.getElementById('page-chats'), { attributes: true, attributeFilter: ['class'] });

    bindInputHandlers();
    chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));
    chatHeaderAvatar.addEventListener('click', openMiniProfile);
    chatHeaderName.addEventListener('click', openMiniProfile);
    await initialLoad();
}
