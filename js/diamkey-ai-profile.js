// diamkey-ai-profile.js — AI-ассистент профиля (исправленный)
(function() {
  let observer = null;

  // Стили
  const style = document.createElement('style');
  style.textContent = `
    .ai-profile-btn {
      position: absolute;
      top: -14px;
      left: 50%;
      transform: translateX(-50%);
      width: 32px;
      height: 32px;
      background: var(--bg-glass, rgba(18,18,24,0.85));
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-glass, rgba(255,255,255,0.12));
      border-radius: 50%;
      color: var(--accent, #c0c0d0);
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      transition: background 0.2s, color 0.2s;
      z-index: 10;
    }
    .ai-profile-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
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

  // Модалка
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
  document.getElementById('closeAiModalBtn').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

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

      // Вычисляем дни в DiamKey
      const daysInDiamKey = profile.created_at
        ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : '?';

      // Подготовка бейджей для вывода
      const badgeList = badges.map(b => b.badges?.name).filter(Boolean);
      const badgesStr = badgeList.length ? badgeList.join(', ') : 'нет';

      const profileData = {
        login: profileLogin,
        name: profile.name || profileLogin,
        daysInDiamKey,
        wallCount: wallPosts.length,
        badgesStr
      };

      const { data: configData } = await _supabase.from('service_config').select('mistral_api_key').eq('id',1).maybeSingle();
      if (!configData?.mistral_api_key) {
        body.innerHTML = '<p style="color:var(--danger);">API-ключ не настроен.</p>';
        return;
      }

      const systemPrompt = `Ты — Diamond AI, помощник на сайте DiamKey. Проанализируй профиль пользователя и дай персонализированный дружелюбный отзыв. Данные: логин: ${profileData.login}, имя: ${profileData.name}, дней в DiamKey: ${profileData.daysInDiamKey}, записей на стене: ${profileData.wallCount}, бейджи: ${profileData.badgesStr}. Сделай комплимент, отметь сильные стороны, дай 1-2 совета. Будь остроумным, но добрым. Отвечай на русском, чистым текстом, без маркдауна, 3-5 предложений.`;

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
          <div class="ai-stat-item"><i class="fas fa-calendar-alt"></i> <strong>${profileData.daysInDiamKey}</strong> дн. в DiamKey</div>
          <div class="ai-stat-item"><i class="fas fa-comment"></i> <strong>${profileData.wallCount}</strong> записей</div>
          <div class="ai-stat-item"><i class="fas fa-medal"></i> ${badgeList.length ? badgeList.map(b => `<span style="font-weight:600;">${escapeHtml(b)}</span>`).join(', ') : 'нет бейджей'}</div>
        </div>
      `;
    } catch (e) {
      console.error(e);
      body.innerHTML = '<p style="color:var(--danger);">Ошибка загрузки данных.</p>';
    }
  }

  // Прикрепление кнопки над аватаркой
  function attachAIButton() {
    const avatarWrapper = document.querySelector('#page-profile.active .avatar-wrapper, #userProfileView .avatar-wrapper');
    if (!avatarWrapper || !currentUser) return;
    if (avatarWrapper.querySelector('.ai-profile-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'ai-profile-btn';
    btn.title = 'Спросить AI о профиле';
    btn.innerHTML = '<i class="fas fa-info-circle"></i>';

    let profileLogin = currentUser.login;
    const userView = document.getElementById('userProfileView');
    if (userView && userView.style.display !== 'none') {
      const match = window.location.pathname.match(/\/users\/(.+)/);
      if (match) profileLogin = match[1];
    }

    btn.addEventListener('click', e => {
      e.stopPropagation();
      openAIModal(profileLogin);
    });

    avatarWrapper.style.position = 'relative';
    avatarWrapper.appendChild(btn);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      const profilePage = document.getElementById('page-profile');
      const userView = document.getElementById('userProfileView');
      if ((profilePage && profilePage.classList.contains('active')) || (userView && userView.style.display !== 'none')) {
        attachAIButton();
      } else {
        const existingBtn = document.querySelector('.ai-profile-btn');
        if (existingBtn) existingBtn.remove();
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

  window.addEventListener('popstate', () => {
    const existingBtn = document.querySelector('.ai-profile-btn');
    if (existingBtn) existingBtn.remove();
    attachAIButton();
  });
})();
