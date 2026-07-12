// diamkey-chats.js — чаты DiamKey (с реальными аудио/видео звонками через WebRTC + Supabase Realtime)
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

    // ==================== WebRTC состояние ====================
    let localStream = null;
    let peerConnection = null;
    let currentCallType = null;        // 'voice' или 'video'
    let callChannel = null;           // Supabase Realtime канал для сигналинга
    let isInCall = false;

    // Инициализация (список чатов)
    async function initialLoad() {
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
        (presenceData.data || []).forEach(p => { onlineCache[p.login] = (now - new Date(p.last_seen).getTime()) < 120000; });
        allUsers.forEach(u => { if (!(u.login in onlineCache)) onlineCache[u.login] = false; });

        await Promise.all(allUsers.map(async u => {
            if (!avatarCache[u.login]) { const p = await getProfile(u.login); avatarCache[u.login] = p?.avatar || ''; }
        }));

        recentLogins = recent;
        await updateLastMessagesCache();
        renderChatListInstant();
        subscribeToIncomingCalls();
    }

    async function getRealRecentChats() {
        const { data, error } = await _supabase.from('chat_messages').select('sender, receiver')
            .or(`sender.eq.${currentUser.login},receiver.eq.${currentUser.login}`).neq('sender', 'system');
        if (error || !data) return [];
        const set = new Set();
        data.forEach(m => { if (m.sender === currentUser.login) set.add(m.receiver); else set.add(m.sender); });
        return Array.from(set);
    }

    async function updateLastMessagesCache() {
        const list = recentLogins.length ? recentLogins : allUsers.map(u => u.login);
        await Promise.all(list.map(async login => {
            const msgs = await loadMessagesFromDB(login);
            const real = msgs.filter(m => m.sender !== 'system');
            if (real.length) {
                const last = real[real.length-1];
                lastMessagesCache[login] = { text: `${last.sender===currentUser.login?'Вы':login}: ${last.message||'(голосовое)'}`, time: new Date(last.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
            } else lastMessagesCache[login] = { text:'', time:'' };
        }));
    }

    async function loadMessagesFromDB(partner) {
        const { data, error } = await _supabase.from('chat_messages').select('*')
            .or(`and(sender.eq.${currentUser.login},receiver.eq.${partner}),and(sender.eq.${partner},receiver.eq.${currentUser.login})`)
            .order('created_at', { ascending: true });
        return error ? [] : (data || []);
    }

    function renderChatListInstant(filter = '') {
        if (!chatListContainer || !allUsers.length) return;
        const lower = filter.toLowerCase();
        const fn = u => !filter || (lower.startsWith('@') ? u.login.toLowerCase().includes(lower.slice(1)) : (u.name||u.login).toLowerCase().includes(lower));
        let html = '';
        if (recentLogins.length) {
            const rec = allUsers.filter(u => recentLogins.includes(u.login) && fn(u));
            if (rec.length) {
                html += `<div class="chat-section"><div class="chat-section-title"><i class="fas fa-history"></i> Последние чаты</div>`;
                rec.forEach(u => {
                    const p = lastMessagesCache[u.login] || {};
                    html += `<div class="chat-item ${currentChatLogin===u.login?'active':''}" onclick="window._selectChat('${u.login}')">
                        <div class="chat-item-avatar">${getAvatarHTML(u.login)}${onlineCache[u.login]?'<span class="online-dot"></span>':''}</div>
                        <div class="chat-item-info"><div class="chat-item-name">${escapeHtml(u.name||u.login)}</div><div class="chat-item-last-msg">${escapeHtml(p.text||'Нет сообщений')}</div></div>
                        <div class="chat-item-meta">${p.time}</div></div>`;
                });
                html += `</div>`;
            }
        } else html += `<div class="chat-section-empty">Вы ещё можете пообщаться, выберите пользователя ниже!</div>`;
        const others = allUsers.filter(u => !recentLogins.includes(u.login) && fn(u));
        if (others.length) {
            html += `<div class="chat-section" style="margin-top:16px;"><div class="chat-section-title"><i class="fas fa-users"></i> Все пользователи</div>`;
            others.forEach(u => html += `<div class="chat-item" onclick="window._selectChat('${u.login}')">
                <div class="chat-item-avatar">${getAvatarHTML(u.login)}${onlineCache[u.login]?'<span class="online-dot"></span>':''}</div>
                <div class="chat-item-info"><div class="chat-item-name">${escapeHtml(u.name||u.login)}</div><div class="chat-item-last-msg">Начать чат</div></div></div>`);
            html += `</div>`;
        }
        chatListContainer.innerHTML = html;
    }

    function getAvatarHTML(login) { const a = avatarCache[login]; return a ? `<img src="${escapeHtml(a)}" style="width:100%;height:100%;object-fit:cover;">` : '<i class="fas fa-user"></i>'; }

    window._selectChat = async function(login) {
        if (currentChatLogin === login) return;
        currentChatLogin = login; activeMessageToken++; const token = activeMessageToken;
        noChatSelected.style.display = 'none'; activeChatView.style.display = 'flex';
        const p = allUsers.find(u => u.login === login);
        chatHeaderName.textContent = p?.name || login; chatHeaderAvatar.innerHTML = getAvatarHTML(login);
        chatHeaderStatus.textContent = onlineCache[login] ? 'В сети' : 'Не в сети';
        chatHeaderStatus.className = 'chat-header-status ' + (onlineCache[login]?'online':'');
        if (messagesCache[login]) { if (token===activeMessageToken) renderMessages(login, messagesCache[login]); }
        else {
            const msgs = await loadMessagesFromDB(login); if (token!==activeMessageToken) return;
            if (!msgs.length) {
                const sys = { sender:'system', receiver:login, message:`Это ваш чат с ${escapeHtml(p?.name||login)}! Можете начинать свое общение.`, created_at:new Date().toISOString() };
                await _supabase.from('chat_messages').insert([sys]); msgs.push(sys);
            }
            messagesCache[login] = msgs; renderMessages(login, msgs);
        }
        markChatAsRead(login); renderChatListInstant(chatSearchInput?.value||'');
    };

    function renderMessages(login, messages) {
        if (!messagesContainer) return;
        messagesContainer.innerHTML = messages.map(m => {
            if (m.sender === 'system') return `<div class="system-msg">${escapeHtml(m.message)}</div>`;
            if (m.type === 'voice') {
                const isMe = m.sender === currentUser.login;
                return `<div class="voice-message ${isMe?'sent':'received'}">
                    <button class="voice-play-btn" onclick="toggleVoicePlayback(this)"><i class="fas fa-play"></i></button>
                    <span style="margin:0 8px; font-size:14px;">🎤 Голосовое сообщение</span>
                    <span class="voice-time">0:${String(m.duration||0).padStart(2,'0')}</span>
                    <div class="msg-footer"><span class="msg-time">${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>
                </div>`;
            }
            const isMe = m.sender === currentUser.login;
            const av = isMe ? (currentUser.avatar||'') : (avatarCache[login]||'');
            return `<div class="message ${isMe?'sent':'received'}">
                <div class="msg-avatar">${av ? `<img src="${escapeHtml(av)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '<i class="fas fa-user"></i>'}</div>
                <div><div class="msg-content">${escapeHtml(m.message)}</div>
                <div class="msg-footer"><span class="msg-time">${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div></div>
            </div>`;
        }).join('');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    window.toggleVoicePlayback = function(btn) {
        const icon = btn.querySelector('i');
        if (icon.classList.contains('fa-play')) { icon.classList.remove('fa-play'); icon.classList.add('fa-pause'); }
        else { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
    };

    async function sendTextMessage() {
        if (!currentChatLogin) return; const text = messageInput.value.trim(); if (!text) return;
        const now = new Date().toISOString();
        const msg = { sender:currentUser.login, receiver:currentChatLogin, message:text, created_at:now, id:Date.now() };
        if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
        messagesCache[currentChatLogin].push(msg); renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
        lastMessagesCache[currentChatLogin] = { text:`Вы: ${text}`, time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
        if (!recentLogins.includes(currentChatLogin)) recentLogins.push(currentChatLogin);
        renderChatListInstant(chatSearchInput?.value||''); messageInput.value = ''; messageInput.focus();
        const { error } = await _supabase.from('chat_messages').insert([{ sender:currentUser.login, receiver:currentChatLogin, message:text }]);
        if (error) { showToast('Ошибка отправки'); messagesCache[currentChatLogin].pop(); renderMessages(currentChatLogin, messagesCache[currentChatLogin]); }
    }

    let voiceRecording = false, voiceTimer = null, voiceSeconds = 0, voiceInterval = null;
    function startVoiceRecording() {
        const area = document.getElementById('messageInputArea'); if (!area || !currentChatLogin) return;
        voiceRecording = true; const orig = area.innerHTML; area.setAttribute('data-orig', orig);
        area.innerHTML = `<div class="voice-recording-area"><div class="voice-waveform-large" id="voiceWaveLarge">${Array.from({length:30},()=>'<div class="voice-bar-large" style="height:3px;"></div>').join('')}</div><span class="voice-timer-large" id="voiceTimerLarge">00:00</span><button class="voice-stop-btn" id="voiceStopBtn"><i class="fas fa-stop"></i></button></div>`;
        voiceSeconds = 0; voiceTimer = setInterval(() => { voiceSeconds++; const el = document.getElementById('voiceTimerLarge'); if(el) el.textContent = `00:${String(voiceSeconds).padStart(2,'0')}`; }, 1000);
        voiceInterval = setInterval(() => document.querySelectorAll('.voice-bar-large').forEach(b => b.style.height = Math.floor(Math.random()*20+3)+'px'), 100);
        document.getElementById('voiceStopBtn').addEventListener('click', stopVoiceRecording);
    }
    function stopVoiceRecording() {
        if (!voiceRecording) return; voiceRecording = false; clearInterval(voiceTimer); clearInterval(voiceInterval);
        const area = document.getElementById('messageInputArea'); if (area) { const o = area.getAttribute('data-orig'); if (o) area.innerHTML = o; }
        bindInputHandlers();
        if (voiceSeconds > 0 && currentChatLogin) {
            const now = new Date().toISOString();
            const vm = { sender:currentUser.login, receiver:currentChatLogin, type:'voice', duration:voiceSeconds, created_at:now, id:Date.now() };
            if (!messagesCache[currentChatLogin]) messagesCache[currentChatLogin] = [];
            messagesCache[currentChatLogin].push(vm); renderMessages(currentChatLogin, messagesCache[currentChatLogin]);
            lastMessagesCache[currentChatLogin] = { text:'🎤 Голосовое сообщение', time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) };
            if (!recentLogins.includes(currentChatLogin)) recentLogins.push(currentChatLogin);
            renderChatListInstant(chatSearchInput?.value||'');
        }
        voiceSeconds = 0;
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

    // ==================== ЗВОНКИ WebRTC ====================
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
                callChannel.send({ type: 'ice-candidate', candidate: event.candidate });
            }
        };

        return pc;
    }

    function setupCallChannel(partner) {
        const channelName = `call_${[currentUser.login, partner].sort().join('_')}`;
        callChannel = _supabase.channel(channelName);
        callChannel.on('broadcast', { event: 'signal' }, (payload) => {
            const msg = payload.payload;
            if (msg.sender === currentUser.login) return;  // игнорируем свои сообщения
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

    window.startCall = async function(type) {
        if (!currentChatLogin) return;
        if (isInCall) { showToast('Уже в звонке'); return; }

        const stream = await getLocalMedia(type);
        if (!stream) return;
        localStream = stream;
        currentCallType = type;

        // Показываем оверлей
        callOverlay.style.display = 'flex';
        callName.textContent = currentChatLogin;
        callStatusText.textContent = 'Соединение...';

        // Создаём видеоэлементы, если их нет
        if (!document.getElementById('localVideo')) {
            const localVid = document.createElement('video');
            localVid.id = 'localVideo'; localVid.autoplay = true; localVid.muted = true; localVid.playsinline = true;
            localVid.style.cssText = 'width:120px; height:90px; border-radius:12px; position:absolute; bottom:20px; left:20px; z-index:101; object-fit:cover; border:1px solid var(--border-glass);';
            callOverlay.appendChild(localVid);
        }
        if (!document.getElementById('remoteVideo')) {
            const remoteVid = document.createElement('video');
            remoteVid.id = 'remoteVideo'; remoteVid.autoplay = true; remoteVid.playsinline = true;
            remoteVid.style.cssText = 'width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:99;';
            callOverlay.appendChild(remoteVid);
        }

        document.getElementById('localVideo').srcObject = stream;

        setupCallChannel(currentChatLogin);
        peerConnection = await createPeerConnection(stream);

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        callChannel.send({ type: 'offer', sdp: offer, sender: currentUser.login });

        isInCall = true;
    };

    // Обработка входящего звонка (автоприём)
    function subscribeToIncomingCalls() {
        // Подписываемся на все потенциальные каналы? Лучше подписаться при вызове.
    }

    // При получении звонка извне (через канал)
    async function acceptIncomingCall(fromLogin, type) {
        if (isInCall) return;
        const stream = await getLocalMedia(type);
        if (!stream) return;
        localStream = stream;
        currentCallType = type;
        currentChatLogin = fromLogin;

        callOverlay.style.display = 'flex';
        callName.textContent = fromLogin;
        callStatusText.textContent = 'Входящий звонок...';

        if (!document.getElementById('localVideo')) {
            const localVid = document.createElement('video');
            localVid.id = 'localVideo'; localVid.autoplay = true; localVid.muted = true; localVid.playsinline = true;
            localVid.style.cssText = 'width:120px; height:90px; border-radius:12px; position:absolute; bottom:20px; left:20px; z-index:101; object-fit:cover; border:1px solid var(--border-glass);';
            callOverlay.appendChild(localVid);
        }
        if (!document.getElementById('remoteVideo')) {
            const remoteVid = document.createElement('video');
            remoteVid.id = 'remoteVideo'; remoteVid.autoplay = true; remoteVid.playsinline = true;
            remoteVid.style.cssText = 'width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0; z-index:99;';
            callOverlay.appendChild(remoteVid);
        }

        document.getElementById('localVideo').srcObject = stream;

        setupCallChannel(fromLogin);
        peerConnection = await createPeerConnection(stream);
        isInCall = true;
    }

    // Слушаем все входящие предложения (подписка на общий канал? Лучше подписаться на personal канал: `user_${currentUser.login}`)
    const incomingChannel = _supabase.channel(`user_${currentUser.login}`);
    incomingChannel.on('broadcast', { event: 'incoming_call' }, (payload) => {
        const { from, type } = payload.payload;
        acceptIncomingCall(from, type);
    });
    incomingChannel.subscribe();

    // Функция отправки приглашения
    async function initiateCall(type) {
        if (!currentChatLogin) return;
        // Отправляем приглашение получателю
        const targetChannel = _supabase.channel(`user_${currentChatLogin}`);
        await targetChannel.subscribe();
        await targetChannel.send({ type: 'broadcast', event: 'incoming_call', payload: { from: currentUser.login, type } });
        // Затем запускаем свой звонок
        window.startCall(type);
    }

    // Переопределяем кнопки в шапке
    window.startCall = function(type) {
        initiateCall(type);
    };

    window.endCall = function() {
        if (callChannel) callChannel.send({ type: 'hangup', sender: currentUser.login });
        endCallInternal();
    };

    function endCallInternal() {
        if (localStream) localStream.getTracks().forEach(t => t.stop());
        if (peerConnection) peerConnection.close();
        if (callChannel) _supabase.removeChannel(callChannel);
        localStream = null; peerConnection = null; callChannel = null;
        isInCall = false;
        callOverlay.style.display = 'none';
        const localVid = document.getElementById('localVideo'); if (localVid) localVid.remove();
        const remoteVid = document.getElementById('remoteVideo'); if (remoteVid) remoteVid.remove();
    }

    bindInputHandlers();
    chatSearchInput.addEventListener('input', () => renderChatListInstant(chatSearchInput.value));
    chatHeaderAvatar.addEventListener('click', openMiniProfile);
    chatHeaderName.addEventListener('click', openMiniProfile);
    await initialLoad();
}
