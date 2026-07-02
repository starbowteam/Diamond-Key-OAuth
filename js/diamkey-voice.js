// diamkey-voice.js — Голосовые заметки с живой звуковой волной
(function() {
  let mediaRecorder = null;
  let audioChunks = [];
  let recordingSeconds = 0;
  let recordingTimer = null;
  let animationFrameId = null;
  let audioContext = null;
  let analyser = null;
  let source = null;
  let currentAudioUrl = null;
  let currentAudioBlob = null;
  let currentDuration = 0;
  const MAX_DURATION = 60;

  const style = document.createElement('style');
  style.textContent = `
    .wall-input .voice-mic-btn, .wall-input .voice-stop-btn, .wall-input .voice-delete-btn, .wall-input .voice-send-btn, .wall-input .btn-send {
      width: 40px; height: 40px; border-radius: 12px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--border-glass);
      color: var(--text-muted); display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; flex-shrink: 0; font-size: 16px;
    }
    .wall-input .btn-send { background: rgba(192,192,208,0.15); border-color: var(--accent); color: var(--accent); }
    .voice-recording-area, .voice-preview-area { display: flex; align-items: center; gap: 8px; flex: 1; }
    .voice-waveform-large {
      display: flex; align-items: center; gap: 2px; height: 38px; flex: 1;
      background: rgba(255,255,255,0.04); border-radius: 12px; padding: 0 12px; overflow: hidden;
    }
    .voice-bar-large {
      width: 3px; background: var(--accent); border-radius: 2px;
      transition: height 0.05s; min-height: 3px;
    }
    .voice-timer-large { font-family: monospace; font-size: 15px; color: var(--text-primary); min-width: 45px; text-align: center; }
    .voice-preview-player { display: flex; align-items: center; gap: 8px; flex: 1; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 6px 12px; }
    .voice-preview-play { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--accent); background: rgba(255,255,255,0.06); color: var(--accent); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 12px; }
    .voice-preview-time { font-family: monospace; font-size: 13px; color: var(--text-muted); min-width: 35px; }
    .voice-preview-progress { flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; cursor: pointer; overflow: hidden; }
    .voice-preview-fill { height: 100%; width: 0%; background: var(--accent); border-radius: 2px; }
  `;
  document.head.appendChild(style);

  function formatTime(sec) {
    if (isNaN(sec)) return '0:00';
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }

  // Создаём столбики для волны (изначально пустые, заполняются по мере записи)
  let bars = [];
  const BAR_COUNT = 40; // количество столбиков
  let filledBars = 0;   // сколько уже заполнено (по времени)

  function createBars(container) {
    container.innerHTML = '';
    bars = [];
    filledBars = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      const bar = document.createElement('div');
      bar.className = 'voice-bar-large';
      bar.style.height = '3px'; // минимальная высота
      container.appendChild(bar);
      bars.push(bar);
    }
  }

  // Анимация волны через requestAnimationFrame + данные анализатора
  function startWaveAnimation(container) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1;
    canvas.height = 1;
    // Используем analyser из AudioContext
    function updateBars() {
      if (!analyser) return;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Сколько баров уже активны (по времени записи)
      const activeBars = Math.floor((recordingSeconds / MAX_DURATION) * BAR_COUNT);
      // Ограничиваем общее число баров
      const maxBars = Math.min(BAR_COUNT, activeBars + 4);

      for (let i = 0; i < BAR_COUNT; i++) {
        if (i < maxBars) {
          // Берём кусочек данных из спектра
          const dataIndex = Math.floor((i / BAR_COUNT) * dataArray.length);
          const value = dataArray[dataIndex] || 0;
          const height = Math.max(3, (value / 255) * 32);
          bars[i].style.height = height + 'px';
          bars[i].style.opacity = '1';
        } else {
          bars[i].style.height = '3px';
          bars[i].style.opacity = '0.3';
        }
      }
      animationFrameId = requestAnimationFrame(updateBars);
    }
    updateBars();
  }

  function stopWaveAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function startRecordingUI(container) {
    container.setAttribute('data-original-html', container.innerHTML);
    container.innerHTML = `
      <div class="voice-recording-area">
        <div class="voice-waveform-large" id="voiceWaveLarge"></div>
        <span class="voice-timer-large" id="voiceTimerLarge">00:00</span>
        <button class="voice-stop-btn" id="voiceStopBtn"><i class="fas fa-stop"></i></button>
      </div>
    `;
    createBars(document.getElementById('voiceWaveLarge'));
    document.getElementById('voiceStopBtn').addEventListener('click', stopRecording);

    recordingTimer = setInterval(() => {
      recordingSeconds++;
      document.getElementById('voiceTimerLarge').textContent = formatTime(recordingSeconds);
      if (recordingSeconds >= MAX_DURATION) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      clearInterval(recordingTimer);
      stopWaveAnimation();
      // Останавливаем AudioContext
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
        audioContext = null;
        analyser = null;
        source = null;
      }
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
    }
  }

  function showPreviewState(container) {
    container.innerHTML = `
      <div class="voice-preview-area">
        <div class="voice-preview-player">
          <button class="voice-preview-play" id="voicePreviewPlay"><i class="fas fa-play"></i></button>
          <span class="voice-preview-time" id="voicePreviewCurrent">0:00</span>
          <div class="voice-preview-progress" id="voicePreviewProgress">
            <div class="voice-preview-fill" id="voicePreviewFill"></div>
          </div>
          <span class="voice-preview-time" id="voicePreviewDuration">${formatTime(currentDuration)}</span>
        </div>
        <button class="voice-delete-btn" id="voiceDeleteBtn" style="background:rgba(224,93,93,0.1); border-color:rgba(224,93,93,0.3); color:#e05d5d;"><i class="fas fa-trash"></i></button>
        <button class="voice-send-btn" id="voiceSendBtn"><i class="fas fa-paper-plane"></i></button>
      </div>
    `;

    const audio = new Audio(currentAudioUrl);
    const playBtn = document.getElementById('voicePreviewPlay');
    const currentEl = document.getElementById('voicePreviewCurrent');
    const progressBar = document.getElementById('voicePreviewProgress');
    const fill = document.getElementById('voicePreviewFill');
    let isPlaying = false;

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        fill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
        currentEl.textContent = formatTime(audio.currentTime);
      }
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
      fill.style.width = '0%';
      currentEl.textContent = '0:00';
    });
    playBtn.addEventListener('click', () => {
      if (isPlaying) { audio.pause(); isPlaying = false; playBtn.innerHTML = '<i class="fas fa-play"></i>'; }
      else { audio.play(); isPlaying = true; playBtn.innerHTML = '<i class="fas fa-pause"></i>'; }
    });
    progressBar.addEventListener('click', e => {
      if (!audio.duration) return;
      const rect = progressBar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      audio.currentTime = (x / rect.width) * audio.duration;
      fill.style.width = (x / rect.width) * 100 + '%';
    });
    document.getElementById('voiceDeleteBtn').addEventListener('click', () => cancelVoice(container, audio));
    document.getElementById('voiceSendBtn').addEventListener('click', () => sendVoice(container, audio));
  }

  function cancelVoice(container, audio) {
    if (audio) audio.pause();
    currentAudioUrl = null;
    currentAudioBlob = null;
    resetInputUI(container);
  }

  async function sendVoice(container, audio) {
    if (!currentAudioBlob || !currentDuration) return;
    const sendBtnEl = container.querySelector('#voiceSendBtn');
    if (sendBtnEl) sendBtnEl.disabled = true;

    let profileLogin = currentUser.login;
    const userView = document.getElementById('userProfileView');
    if (userView && userView.style.display !== 'none') {
      const match = window.location.pathname.match(/\/users\/(.+)/);
      if (match) profileLogin = match[1];
    }

    try {
      const fileName = `voice_${Date.now()}_${Math.random().toString(36).substr(2,6)}.webm`;
      const { error: uploadError } = await _supabase.storage.from('wall_audio').upload(fileName, currentAudioBlob, { contentType: 'audio/webm', cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = _supabase.storage.from('wall_audio').getPublicUrl(fileName);
      await _supabase.from('wall_audio').insert({
        profile_login: profileLogin,
        user_login: currentUser.login,
        user_name: currentUser.name || currentUser.login,
        user_avatar: currentUser.avatar || '',
        audio_url: publicUrl,
        duration: currentDuration,
        reactions: {}
      });
      showToast('Голосовая заметка добавлена');
      if (audio) audio.pause();
      currentAudioUrl = null;
      currentAudioBlob = null;
      resetInputUI(container);
      if (profileLogin === currentUser.login && typeof renderMyProfile === 'function') renderMyProfile();
      else if (typeof openUserProfile === 'function') openUserProfile(profileLogin);
    } catch (e) {
      console.error(e);
      showToast('Ошибка отправки');
    } finally {
      if (sendBtnEl) sendBtnEl.disabled = false;
    }
  }

  function resetInputUI(container) {
    const originalHTML = container.getAttribute('data-original-html');
    if (originalHTML) {
      container.innerHTML = originalHTML;
      container.removeAttribute('data-original-html');
      setupVoiceInput(container);
    }
  }

  function setupVoiceInput(container) {
    if (!container || container.querySelector('.voice-mic-btn')) return;
    const textarea = container.querySelector('textarea');
    const sendBtn = container.querySelector('button.btn-send');
    if (!textarea || !sendBtn) return;
    const micBtn = document.createElement('button');
    micBtn.className = 'voice-mic-btn';
    micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    micBtn.title = 'Записать голосовое (макс 1 мин)';
    sendBtn.parentNode.insertBefore(micBtn, sendBtn);
    micBtn.addEventListener('click', async () => {
      if (!currentUser) return showToast('Войдите');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        // MediaRecorder для записи
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
          currentAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          currentAudioUrl = URL.createObjectURL(currentAudioBlob);
          currentDuration = recordingSeconds;
          showPreviewState(container);
        };
        mediaRecorder.start();
        recordingSeconds = 0;
        startRecordingUI(container);
        startWaveAnimation(document.getElementById('voiceWaveLarge'));
      } catch (e) {
        console.error(e);
        showToast('Нет доступа к микрофону');
        if (audioContext) {
          audioContext.close().catch(() => {});
          audioContext = null;
        }
      }
    });
  }

  function setupAllInputs() { document.querySelectorAll('.wall-input').forEach(container => setupVoiceInput(container)); }
  const domObserver = new MutationObserver(() => setupAllInputs());
  domObserver.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupAllInputs);
  else setupAllInputs();

  async function getVoicePosts(login) {
    const { data } = await _supabase.from('wall_audio').select('*').eq('profile_login', login).order('created_at', { ascending: false });
    return (data || []).map(msg => ({
      id: `voice_${msg.id}`,
      user_login: msg.user_login,
      user_name: msg.user_name,
      user_avatar: msg.user_avatar,
      content: '',
      reactions: msg.reactions || {},
      created_at: msg.created_at,
      type: 'voice',
      audio_url: msg.audio_url,
      duration: msg.duration
    }));
  }

  function renderVoicePost(msg) {
    return `
      <div class="wall-post glass-panel voice-message" data-post-id="${msg.id}">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          ${avatarHTML(msg.user_avatar, 32)}
          <strong>${escapeHtml(msg.user_name || msg.user_login)}</strong>
          <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(msg.created_at).toLocaleString()}</span>
        </div>
        <div class="voice-message-player" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border-radius:12px;padding:10px;margin-bottom:10px;">
          <button class="voice-msg-play" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--accent);background:rgba(255,255,255,0.06);color:var(--accent);" onclick="toggleVoicePlayback(this, '${escapeHtml(msg.audio_url)}')">
            <i class="fas fa-play"></i>
          </button>
          <span class="voice-msg-time" style="font-family:monospace;">0:00</span>
          <div class="voice-msg-progress" style="flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;" onclick="seekVoice(this, event)">
            <div class="voice-msg-fill" style="height:100%;width:0%;background:var(--accent);border-radius:2px;"></div>
          </div>
          <span class="voice-msg-duration" style="font-family:monospace;">${formatTime(msg.duration)}</span>
        </div>
        <div class="wall-post-footer">${typeof renderReactions === 'function' ? renderReactions(msg.reactions, msg.id) : ''}</div>
      </div>
    `;
  }

  window.toggleVoicePlayback = function(btn, url) {
    if (window._globalVoiceAudio && window._globalVoiceBtn !== btn) {
      window._globalVoiceAudio.pause();
      window._globalVoiceBtn.innerHTML = '<i class="fas fa-play"></i>';
    }
    if (!window._globalVoiceAudio || window._globalVoiceBtn !== btn) {
      const audio = new Audio(url);
      window._globalVoiceAudio = audio;
      window._globalVoiceBtn = btn;
      const fill = btn.parentElement.querySelector('.voice-msg-fill');
      const timeEl = btn.parentElement.querySelector('.voice-msg-time');
      audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
          fill.style.width = (audio.currentTime/audio.duration*100) + '%';
          timeEl.textContent = formatTime(audio.currentTime);
        }
      });
      audio.addEventListener('ended', () => {
        btn.innerHTML = '<i class="fas fa-play"></i>';
        fill.style.width = '0%';
        timeEl.textContent = '0:00';
        window._globalVoiceAudio = null;
      });
      audio.play();
      btn.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      const audio = window._globalVoiceAudio;
      if (audio.paused) { audio.play(); btn.innerHTML = '<i class="fas fa-pause"></i>'; }
      else { audio.pause(); btn.innerHTML = '<i class="fas fa-play"></i>'; }
    }
  };

  window.seekVoice = function(bar, e) {
    if (!window._globalVoiceAudio) return;
    const rect = bar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.min(1, Math.max(0, x / rect.width));
    window._globalVoiceAudio.currentTime = pct * window._globalVoiceAudio.duration;
    bar.querySelector('.voice-msg-fill').style.width = (pct*100) + '%';
  };

  window.integrateVoiceWall = async function() {};

  window.getMixedWallPosts = async function(login, textPosts) {
    const voicePosts = await getVoicePosts(login);
    return [...textPosts, ...voicePosts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  window.renderPostHTML = function(post) {
    if (post.type === 'voice') return renderVoicePost(post);
    return typeof renderTextPostHTML === 'function' ? renderTextPostHTML(post) : '';
  };
})();
