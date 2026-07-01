// diamkey-voice.js — Голосовые заметки на стене DiamKey
// Зависимости: _supabase, currentUser, showToast, escapeHtml, avatarHTML, formatDate

let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let currentAudioUrl = null;
let currentDuration = 0;

// Функция для инициализации голосового блока на стене (вызывается при отрисовке стены)
function initVoiceBlock(container) {
  if (!container) return;
  
  // Уже есть блок записи?
  if (container.querySelector('.voice-recorder-block')) return;
  
  const voiceBlock = document.createElement('div');
  voiceBlock.className = 'voice-recorder-block';
  voiceBlock.innerHTML = `
    <div class="voice-recorder glass-panel-inner" style="margin-bottom:12px;">
      <div class="voice-recorder-header" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <i class="fas fa-microphone" style="color:var(--accent);"></i>
        <span style="font-weight:600; font-size:14px;">Голосовая заметка</span>
      </div>
      <div class="voice-controls" style="display:flex; align-items:center; gap:12px;">
        <button class="voice-record-btn" id="voiceRecordBtn" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#e05d5d,#c0392b);border:none;color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:box-shadow 0.2s,transform 0.1s;">
          <i class="fas fa-microphone"></i>
        </button>
        <span class="voice-timer" id="voiceTimer" style="font-family:monospace;font-size:16px;font-weight:600;">00:00</span>
        <div class="voice-waveform" id="voiceWaveform" style="display:flex;align-items:center;gap:2px;height:24px;">
          ${Array.from({length:12}, () => '<div class="voice-bar" style="width:3px;background:var(--accent);border-radius:2px;height:6px;transition:height 0.15s;"></div>').join('')}
        </div>
        <button class="voice-stop-btn" id="voiceStopBtn" style="display:none;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid var(--border-glass);color:var(--text-primary);font-size:16px;cursor:pointer;align-items:center;justify-content:center;">
          <i class="fas fa-stop"></i>
        </button>
      </div>
      <div class="voice-preview" id="voicePreview" style="display:none;margin-top:12px;">
        <div class="audio-player" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border:1px solid var(--border-glass);border-radius:12px;padding:10px 14px;">
          <button class="voice-play-btn" id="voicePlayBtn" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--accent);background:rgba(255,255,255,0.06);color:var(--accent);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;">
            <i class="fas fa-play"></i>
          </button>
          <span class="voice-current-time" style="font-family:monospace;font-size:13px;color:var(--text-muted);min-width:38px;">0:00</span>
          <div class="voice-progress-bar" id="voiceProgressBar" style="flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;cursor:pointer;overflow:hidden;">
            <div class="voice-progress-fill" id="voiceProgressFill" style="height:100%;width:0%;background:var(--accent);border-radius:2px;transition:width 0.1s linear;"></div>
          </div>
          <span class="voice-duration" id="voiceDuration" style="font-family:monospace;font-size:13px;color:var(--text-muted);min-width:38px;">0:00</span>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">
          <button class="btn" id="voiceDiscardBtn" style="padding:6px 14px;font-size:13px;"><i class="fas fa-times"></i> Отменить</button>
          <button class="btn btn-primary" id="voiceSendBtn" style="padding:6px 14px;font-size:13px;"><i class="fas fa-paper-plane"></i> Отправить</button>
        </div>
      </div>
    </div>
  `;
  
  // Вставляем перед полем ввода текста (если есть) или в начало стены
  const textarea = container.querySelector('textarea');
  if (textarea) {
    textarea.parentNode.insertBefore(voiceBlock, textarea.parentNode.firstChild);
  } else {
    container.prepend(voiceBlock);
  }
  
  // Привязываем события
  const recordBtn = voiceBlock.querySelector('#voiceRecordBtn');
  const stopBtn = voiceBlock.querySelector('#voiceStopBtn');
  const playBtn = voiceBlock.querySelector('#voicePlayBtn');
  const sendBtn = voiceBlock.querySelector('#voiceSendBtn');
  const discardBtn = voiceBlock.querySelector('#voiceDiscardBtn');
  const progressBar = voiceBlock.querySelector('#voiceProgressBar');
  const progressFill = voiceBlock.querySelector('#voiceProgressFill');
  const timerEl = voiceBlock.querySelector('#voiceTimer');
  const waveform = voiceBlock.querySelector('#voiceWaveform');
  const preview = voiceBlock.querySelector('#voicePreview');
  const durationEl = voiceBlock.querySelector('#voiceDuration');
  const currentTimeEl = voiceBlock.querySelector('.voice-current-time');
  
  let audio = null;
  let isPlaying = false;
  let progressInterval = null;
  
  function updateTimer() {
    const mins = Math.floor(recordingSeconds / 60).toString().padStart(2,'0');
    const secs = (recordingSeconds % 60).toString().padStart(2,'0');
    timerEl.textContent = `${mins}:${secs}`;
  }
  
  function animateWaveform() {
    const bars = waveform.querySelectorAll('.voice-bar');
    bars.forEach(bar => {
      bar.style.height = Math.floor(Math.random() * 18 + 4) + 'px';
    });
  }
  
  let waveformInterval = null;
  
  recordBtn.addEventListener('click', async () => {
    if (!currentUser) return showToast('Войдите');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        currentDuration = recordingSeconds;
        currentAudioUrl = URL.createObjectURL(blob);
        // Отображаем превью
        preview.style.display = 'block';
        durationEl.textContent = formatTime(recordingSeconds);
        currentTimeEl.textContent = '0:00';
        progressFill.style.width = '0%';
        recordBtn.style.display = 'none';
        stopBtn.style.display = 'none';
        timerEl.textContent = '00:00';
        clearInterval(waveformInterval);
        // Сбрасываем бары
        waveform.querySelectorAll('.voice-bar').forEach(b => b.style.height = '6px');
        // Настраиваем аудио для плеера
        if (audio) {
          audio.pause();
          audio = null;
        }
        audio = new Audio(currentAudioUrl);
        audio.addEventListener('timeupdate', () => {
          if (audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = progress + '%';
            currentTimeEl.textContent = formatTime(audio.currentTime);
          }
        });
        audio.addEventListener('ended', () => {
          isPlaying = false;
          playBtn.innerHTML = '<i class="fas fa-play"></i>';
          progressFill.style.width = '0%';
          currentTimeEl.textContent = '0:00';
        });
        audio.addEventListener('loadedmetadata', () => {
          durationEl.textContent = formatTime(audio.duration);
        });
      };
      mediaRecorder.start();
      recordingSeconds = 0;
      updateTimer();
      recordingTimer = setInterval(() => {
        recordingSeconds++;
        updateTimer();
        animateWaveform();
      }, 1000);
      waveformInterval = setInterval(animateWaveform, 200);
      recordBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    } catch (e) {
      console.error('Ошибка доступа к микрофону:', e);
      showToast('Нет доступа к микрофону');
    }
  });
  
  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      clearInterval(recordingTimer);
      clearInterval(waveformInterval);
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
      mediaRecorder = null;
    }
  });
  
  playBtn.addEventListener('click', () => {
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      playBtn.innerHTML = '<i class="fas fa-play"></i>';
    } else {
      audio.play();
      isPlaying = true;
      playBtn.innerHTML = '<i class="fas fa-pause"></i>';
    }
  });
  
  progressBar.addEventListener('click', (e) => {
    if (!audio || !audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = percent * audio.duration;
    progressFill.style.width = (percent * 100) + '%';
  });
  
  discardBtn.addEventListener('click', () => {
    preview.style.display = 'none';
    recordBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    currentAudioUrl = null;
    currentDuration = 0;
    if (audio) {
      audio.pause();
      audio = null;
    }
  });
  
  sendBtn.addEventListener('click', async () => {
    if (!currentAudioUrl || !currentDuration) return showToast('Нет записи');
    if (!currentUser) return showToast('Войдите');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    try {
      // Определяем, на чьей стене мы находимся (берём логин из URL или профиля)
      let profileLogin;
      const userProfileView = document.getElementById('userProfileView');
      if (userProfileView && userProfileView.style.display !== 'none') {
        // Открыта чужая стена, берём логин из URL
        const match = window.location.pathname.match(/\/users\/(.+)/);
        profileLogin = match ? match[1] : currentUser.login;
      } else if (document.getElementById('page-profile')?.classList.contains('active')) {
        profileLogin = currentUser.login;
      } else {
        // По умолчанию своя стена
        profileLogin = currentUser.login;
      }
      
      // Конвертируем blob в файл и загружаем в Supabase Storage
      const blob = await fetch(currentAudioUrl).then(r => r.blob());
      const fileName = `voice_${Date.now()}_${Math.random().toString(36).substr(2,6)}.webm`;
      const { data: uploadData, error: uploadError } = await _supabase.storage
        .from('wall_audio')
        .upload(fileName, blob, {
          contentType: 'audio/webm',
          cacheControl: '3600'
        });
      
      if (uploadError) throw uploadError;
      
      // Получаем публичный URL
      const { data: { publicUrl } } = _supabase.storage
        .from('wall_audio')
        .getPublicUrl(fileName);
      
      // Сохраняем запись в таблицу wall_audio
      const { error: insertError } = await _supabase
        .from('wall_audio')
        .insert({
          profile_login: profileLogin,
          user_login: currentUser.login,
          user_name: currentUser.name || currentUser.login,
          user_avatar: currentUser.avatar || '',
          audio_url: publicUrl,
          duration: currentDuration
        });
      
      if (insertError) throw insertError;
      
      showToast('Голосовая заметка добавлена');
      // Очищаем блок
      preview.style.display = 'none';
      recordBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
      currentAudioUrl = null;
      currentDuration = 0;
      if (audio) {
        audio.pause();
        audio = null;
      }
      timerEl.textContent = '00:00';
      
      // Перерисовываем стену (вызываем функцию из diamkey-wall.js)
      if (profileLogin === currentUser.login) {
        if (typeof renderMyProfile === 'function') renderMyProfile();
        else if (typeof openUserProfile === 'function') openUserProfile(currentUser.login);
      } else {
        if (typeof openUserProfile === 'function') openUserProfile(profileLogin);
      }
    } catch (e) {
      console.error('Ошибка отправки голосового:', e);
      showToast('Ошибка отправки');
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Отправить';
    }
  });
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2,'0')}`;
}

// Рендер голосового сообщения в списке постов
function renderVoiceMessage(msg) {
  return `
    <div class="wall-post glass-panel voice-message" data-audio-url="${escapeHtml(msg.audio_url)}" style="padding:16px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        ${avatarHTML(msg.user_avatar, 32)}
        <strong>${escapeHtml(msg.user_name || msg.user_login)}</strong>
        <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${formatDate(msg.created_at)}</span>
      </div>
      <div class="voice-message-player" style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,0.04);border-radius:12px;padding:10px;">
        <button class="voice-msg-play" style="width:36px;height:36px;border-radius:50%;border:1px solid var(--accent);background:rgba(255,255,255,0.06);color:var(--accent);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;" onclick="toggleVoicePlayback(this, '${escapeHtml(msg.audio_url)}')">
          <i class="fas fa-play"></i>
        </button>
        <span class="voice-msg-time" style="font-family:monospace;font-size:14px;color:var(--text-muted);">0:00</span>
        <div class="voice-msg-progress" style="flex:1;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;cursor:pointer;" onclick="seekVoice(this, event)">
          <div class="voice-msg-fill" style="height:100%;width:0%;background:var(--accent);border-radius:2px;"></div>
        </div>
        <span class="voice-msg-duration" style="font-family:monospace;font-size:14px;color:var(--text-muted);">${formatTime(msg.duration)}</span>
      </div>
    </div>
  `;
}

// Глобальные переменные для управления воспроизведением
let globalVoiceAudio = null;
let globalVoiceButton = null;
let globalVoiceInterval = null;

function toggleVoicePlayback(button, url) {
  // Если уже играет другое аудио, остановить
  if (globalVoiceAudio && globalVoiceButton !== button) {
    globalVoiceAudio.pause();
    globalVoiceButton.innerHTML = '<i class="fas fa-play"></i>';
    clearInterval(globalVoiceInterval);
  }
  
  if (!globalVoiceAudio || globalVoiceButton !== button) {
    globalVoiceAudio = new Audio(url);
    globalVoiceButton = button;
    const fillEl = button.parentElement.querySelector('.voice-msg-fill');
    const timeEl = button.parentElement.querySelector('.voice-msg-time');
    globalVoiceAudio.addEventListener('timeupdate', () => {
      if (globalVoiceAudio.duration) {
        const progress = (globalVoiceAudio.currentTime / globalVoiceAudio.duration) * 100;
        if (fillEl) fillEl.style.width = progress + '%';
        if (timeEl) timeEl.textContent = formatTime(globalVoiceAudio.currentTime);
      }
    });
    globalVoiceAudio.addEventListener('ended', () => {
      button.innerHTML = '<i class="fas fa-play"></i>';
      if (fillEl) fillEl.style.width = '0%';
      if (timeEl) timeEl.textContent = '0:00';
      globalVoiceAudio = null;
      globalVoiceButton = null;
    });
    globalVoiceAudio.play();
    button.innerHTML = '<i class="fas fa-pause"></i>';
  } else {
    // Это уже играет, переключаем play/pause
    if (globalVoiceAudio.paused) {
      globalVoiceAudio.play();
      button.innerHTML = '<i class="fas fa-pause"></i>';
    } else {
      globalVoiceAudio.pause();
      button.innerHTML = '<i class="fas fa-play"></i>';
    }
  }
}

function seekVoice(progressBar, event) {
  if (!globalVoiceAudio) return;
  const rect = progressBar.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const percent = Math.max(0, Math.min(1, x / rect.width));
  globalVoiceAudio.currentTime = percent * globalVoiceAudio.duration;
}

// Функция загрузки голосовых заметок и добавления их в стену
async function loadVoicePosts(login, container) {
  try {
    const { data: voicePosts, error } = await _supabase
      .from('wall_audio')
      .select('*')
      .eq('profile_login', login)
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (voicePosts && voicePosts.length > 0) {
      voicePosts.forEach(msg => {
        const voiceHtml = renderVoiceMessage(msg);
        const div = document.createElement('div');
        div.innerHTML = voiceHtml;
        container.appendChild(div.firstElementChild);
      });
    }
  } catch (e) {
    console.error('Ошибка загрузки голосовых заметок:', e);
  }
}

// Хук для интеграции в существующий код стены (вызывается после рендера текстовых постов)
async function integrateVoiceWall(login, wallContainer) {
  if (!wallContainer) return;
  // Добавляем блок записи голоса
  initVoiceBlock(wallContainer);
  // Подгружаем существующие голосовые заметки
  await loadVoicePosts(login, wallContainer);
}