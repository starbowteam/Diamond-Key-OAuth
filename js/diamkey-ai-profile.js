// diamkey-ai-profile.js — AI-ассистент профиля (исправленный)
(function() {
  let observer = null;
  let aiButtonAdded = false;

  // Стили инжектируем
  const style = document.createElement('style');
  style.textContent = `
    .ai-profile-btn {
      position: absolute;
      top: -8px;
      right: -8px;
      width: 32px;
      height: 32px;
      background: rgba(18,18,24,0.9);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border-glass, rgba(255,255,255,0.2));
      border-radius: 50%;
      color: var(--accent, #c0c0d0);
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 0 12px rgba(192,192,208,0.3);
      transition: all 0.2s;
      z-index: 10;
      animation: aiPulse 2.5s infinite;
    }
    .ai-profile-btn:hover {
      background: rgba(255,255,255,0.12);
      box-shadow: 0 0 18px rgba(192,192,208,0.5);
      transform: scale(1.1);
      color: #fff;
    }
    @keyframes aiPulse {
      0%, 100% { box-shadow: 0 0 8px rgba(192,192,208,0.2); }
      50% { box-shadow: 0 0 18px rgba(192,192,208,0.5); }
    }
    .ai-modal-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(12px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }
    .ai-modal-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    .ai-modal-content {
      background: var(--bg-glass, rgba(18,18,24,0.85));
      backdrop-filter: blur(24px);
      border: 1px solid var(--border-glass, rgba(255,255,255,0.12));
      border-radius: 28px;
      padding: 28px;
      max-width: 440px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05);
      animation: aiSlideIn 0.3s ease;
      text-align: left;
    }
    @keyframes aiSlideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-modal-content .ai-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .ai-modal-content .ai-header img {
      width: 48px; height: 48px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid var(--border-glass);
    }
    .ai-modal-content .ai-body {
      color: var(--text-muted, #8e8e9a);
      font-size: 15px;
      line-height: 1.6;
    }
    .ai-modal-content .ai-body strong {
      color: var(--text-primary, #f0f0f0);
    }
    .ai-modal-content .ai-stats {
      display: flex;
      gap: 12px;
      margin: 16px 0;
      flex-wrap: wrap;
    }
    .ai-modal-content .ai-stat-item {
      background: rgba(255,255,255,0.04);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .ai-modal-content .btn-close-ai {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 20px;
      padding: 8px 20px;
      color: var(--text-primary);
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      float: right;
      transition: background 0.2s;
    }
    .ai-modal-content .btn-close-ai:hover {
      background: rgba(255,255,255,0.12);
    }
  `;
  document.head.appendChild(style);

  // Создаём модалку
  const modal = document.createElement('div');
  modal.className = 'ai-modal-overlay';
  modal.innerHTML = `
    <div class="ai-modal-content">
      <div class="ai-header">
        <img src="/assets/diamond-ai.png" alt="AI">
        <span style="font-weight:700; font-size:18px; color:var(--text-primary);">Diamond AI</span>
      </div>
      <div class="ai-body" id="aiBody">
        <div style="text-align:center; padding:20px;">
          <i class="fas fa-spinner fa-pulse" style="font-size:24px; color:var(--accent);"></i>
          <p>Анализирую профиль...</p>
        </div>
      </div>
      <button class="btn-close-ai" id="closeAiModalBtn">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('closeAiModalBtn').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Сбор данных и запрос к Mistral
  async function openAIModal(profileLogin) {
    modal.classList.add('active');
    const body = document.getElementById('aiBody');
    body.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-pulse" style="font-size:24px; color:var(--accent);"></i><p>Анализирую профиль...</p></div>`;

    try {
      const [profile, gpxFiles, wallPosts, badges] = await Promise.all([
        getProfile(profileLogin),
        getGpxFiles(profileLogin),
        getWall(profileLogin),
        getUserBadges(profileLogin)
      ]);

      if (!profile) {
        body.innerHTML = '<p style="color:var(--danger);">Профиль не найден.</p>';
        return;
      }

      let totalDistance = 0;
      gpxFiles.forEach(f => {
        const stats = typeof getGpxStats === 'function' ? getGpxStats(f.content) : { dist: 0 };
        if (stats.dist) totalDistance += stats.dist;
      });

      const profileData = {
        login: profileLogin,
        name: profile.name || profileLogin,
        created_at: profile.created_at,
        gpxCount: gpxFiles.length,
        totalDistance: totalDistance > 1000 ? (totalDistance/1000).toFixed(1) : (totalDistance/1000).toFixed(2),
        wallCount: wallPosts.length,
        badges: badges.map(b => b.badges).filter(Boolean),
        cover: profile.cover || '',
        avatar: profile.avatar || ''
      };

      const { data: configData } = await _supabase.from('service_config').select('mistral_api_key').eq('id',1).maybeSingle();
      if (!configData?.mistral_api_key) {
        body.innerHTML = '<p style="color:var(--danger);">API-ключ не настроен.</p>';
        return;
      }

      const systemPrompt = `Ты — Diamond AI, помощник на сайте DiamKey. Проанализируй профиль пользователя и дай персонализированный дружелюбный отзыв. Данные: логин: ${profileData.login}, имя: ${profileData.name}, зарегистрирован: ${profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('ru-RU') : 'неизвестно'}, GPX-поездок: ${profileData.gpxCount}, общая дистанция: ${profileData.totalDistance} км, записей на стене: ${profileData.wallCount}, бейджи: ${profileData.badges.map(b=>b.name).join(', ') || 'нет'}, обложка: ${profileData.cover ? (profileData.cover.startsWith('image:') ? 'кастомная картинка' : 'градиент') : 'стандартная'}, аватар: ${profileData.avatar ? 'установлен' : 'нет'}. Сделай комплимент, отметь сильные стороны, дай 1-2 совета (больше GPX, оформить обложку, написать на стену). Будь остроумным, но добрым. Отвечай на русском, чистым текстом, без маркдауна, 3-5 предложений.`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + configData.mistral_api_key
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Дай анализ моего профиля, пожалуйста.' }
          ],
          max_tokens: 400,
          temperature: 0.8
        })
      });

      const json = await response.json();
      const reply = json.choices?.[0]?.message?.content || 'Не удалось получить ответ от AI.';

      body.innerHTML = `
        <p style="font-size:15px; line-height:1.5; color:var(--text-primary); margin-bottom:16px;">${escapeHtml(reply)}</p>
        <div class="ai-stats">
          <div class="ai-stat-item"><i class="fas fa-route"></i> <strong>${profileData.gpxCount}</strong> поездок</div>
          <div class="ai-stat-item"><i class="fas fa-road"></i> <strong>${profileData.totalDistance}</strong> км</div>
          <div class="ai-stat-item"><i class="fas fa-comment"></i> <strong>${profileData.wallCount}</strong> записей</div>
          <div class="ai-stat-item"><i class="fas fa-medal"></i> <strong>${profileData.badges.length}</strong> бейджей</div>
        </div>
      `;
    } catch (e) {
      console.error(e);
      body.innerHTML = '<p style="color:var(--danger);">Ошибка загрузки данных.</p>';
    }
  }

  // Прикрепляем кнопку к аватарке
  function attachAIButton() {
    const avatarWrapper = document.querySelector('#page-profile.active .avatar-wrapper, #userProfileView .avatar-wrapper');
    if (!avatarWrapper || !currentUser) return;
    if (avatarWrapper.querySelector('.ai-profile-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'ai-profile-btn';
    btn.title = 'Спросить AI о профиле';
    btn.innerHTML = '<i class="fas fa-exclamation"></i>';

    let profileLogin = currentUser.login;
    const userView = document.getElementById('userProfileView');
    if (userView && userView.style.display !== 'none') {
      const match = window.location.pathname.match(/\/users\/(.+)/);
      if (match) profileLogin = match[1];
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAIModal(profileLogin);
    });

    avatarWrapper.style.position = 'relative';
    avatarWrapper.appendChild(btn);
    aiButtonAdded = true;
  }

  function resetAndAttach() {
    aiButtonAdded = false;
    attachAIButton();
  }

  // Наблюдатель за DOM
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      const profilePage = document.getElementById('page-profile');
      const userView = document.getElementById('userProfileView');
      if ((profilePage && profilePage.classList.contains('active')) || (userView && userView.style.display !== 'none')) {
        attachAIButton();
      } else {
        aiButtonAdded = false;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style'] });
    attachAIButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  window.addEventListener('popstate', resetAndAttach);
})();
