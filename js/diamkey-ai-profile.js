// diamkey-ai-profile.js — AI-ассистент профиля
// Кнопка над аватаркой (1/4 размера) и модалка с анализом через Mistral

(function() {
  let observer = null;
  let aiButtonAdded = false;

  // Стили для кнопки и модалки добавляем динамически, чтобы не трогать style.css
  const style = document.createElement('style');
  style.textContent = `
    .ai-profile-btn {
      position: absolute;
      bottom: -4px;
      right: -4px;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #ff9a56, #ff3c7e);
      border: 2px solid var(--bg-primary, #0a0a0f);
      border-radius: 50%;
      color: white;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 0 12px rgba(255,156,86,0.5);
      transition: transform 0.2s;
      z-index: 10;
      animation: aiPulse 2s infinite;
    }
    .ai-profile-btn:hover {
      transform: scale(1.15);
    }
    @keyframes aiPulse {
      0%, 100% { box-shadow: 0 0 8px rgba(255,156,86,0.4); }
      50% { box-shadow: 0 0 20px rgba(255,60,126,0.8); }
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
      background: rgba(18,18,24,0.9);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 28px;
      padding: 28px;
      max-width: 440px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      animation: aiSlideIn 0.3s ease;
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
      gap: 16px;
      margin: 16px 0;
      flex-wrap: wrap;
    }
    .ai-modal-content .ai-stat-item {
      background: rgba(255,255,255,0.04);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
    }
    .ai-modal-content .btn-close-ai {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px;
      padding: 8px 20px;
      color: var(--text-primary);
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      float: right;
    }
  `;
  document.head.appendChild(style);

  // Создаём модалку один раз
  const modal = document.createElement('div');
  modal.className = 'ai-modal-overlay';
  modal.innerHTML = `
    <div class="ai-modal-content">
      <div class="ai-header">
        <img src="/assets/diamond-ai.png" alt="AI">
        <span style="font-weight:700; font-size:18px;">Diamond AI</span>
      </div>
      <div class="ai-body" id="aiBody">
        <div style="text-align:center; padding:20px;">
          <i class="fas fa-spinner fa-pulse" style="font-size:24px; color:var(--accent);"></i>
          <p>Анализирую профиль...</p>
        </div>
      </div>
      <button class="btn-close-ai" onclick="document.querySelector('.ai-modal-overlay').classList.remove('active')">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  // Закрытие по клику на фон
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Получение системного промпта для AI
  async function getAISystemPrompt(profileData) {
    return `Ты — Diamond AI, встроенный помощник в DiamKey. Ты анализируешь профиль пользователя и даёшь персонализированный, дружелюбный и немного весёлый отзыв. Ты видишь следующие данные:
- Логин: ${profileData.login}
- Имя: ${profileData.name || 'не указано'}
- Дата регистрации: ${profileData.created_at ? new Date(profileData.created_at).toLocaleDateString('ru-RU') : 'неизвестно'}
- Количество GPX-поездок: ${profileData.gpxCount}
- Общая дистанция: ${profileData.totalDistance} км
- Записей на стене: ${profileData.wallCount}
- Бейджи: ${profileData.badges.map(b => b.name).join(', ') || 'нет'}
- Обложка: ${profileData.cover ? (profileData.cover.startsWith('image:') ? 'кастомное изображение' : 'градиент') : 'стандартная'}
- Аватар: ${profileData.avatar ? 'установлен' : 'нет'}

Твоя задача: сделать комплимент профилю, отметить сильные стороны, дать 1-2 совета по улучшению профиля или активности, предложить загрузить ещё GPX или написать на стену. Будь остроумным, но добрым. Отвечай на русском, чистым текстом, без маркдауна. Длина ответа — 3-5 предложений.`;
  }

  // Функция открытия модалки и запроса к AI
  async function openAIModal(profileLogin) {
    modal.classList.add('active');
    const body = document.getElementById('aiBody');
    body.innerHTML = `<div style="text-align:center; padding:20px;"><i class="fas fa-spinner fa-pulse" style="font-size:24px; color:var(--accent);"></i><p>Анализирую профиль...</p></div>`;

    try {
      // Собираем данные профиля
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
        const stats = getGpxStats ? getGpxStats(f.content) : { dist: 0 };
        if (stats.dist) totalDistance += stats.dist;
      });

      const profileData = {
        login: profileLogin,
        name: profile.name || profileLogin,
        created_at: profile.created_at,
        gpxCount: gpxFiles.length,
        totalDistance: totalDistance > 1000 ? (totalDistance / 1000).toFixed(1) : (totalDistance / 1000).toFixed(2),
        wallCount: wallPosts.length,
        badges: badges.map(b => b.badges).filter(Boolean),
        cover: profile.cover || '',
        avatar: profile.avatar || ''
      };

      // Запрос к Mistral
      const { data: configData, error: configError } = await _supabase
        .from('service_config')
        .select('mistral_api_key')
        .eq('id', 1)
        .maybeSingle();

      if (configError || !configData?.mistral_api_key) {
        body.innerHTML = '<p style="color:var(--danger);">API-ключ не настроен.</p>';
        return;
      }

      const systemPrompt = await getAISystemPrompt(profileData);

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

      // Красиво выводим ответ с дополнительной статистикой
      body.innerHTML = `
        <div style="margin-bottom:16px;">
          <p style="font-size:15px; line-height:1.5; color:var(--text-primary);">${escapeHtml(reply)}</p>
        </div>
        <div class="ai-stats">
          <div class="ai-stat-item"><i class="fas fa-route"></i> <strong>${profileData.gpxCount}</strong> поездок</div>
          <div class="ai-stat-item"><i class="fas fa-road"></i> <strong>${profileData.totalDistance}</strong> км</div>
          <div class="ai-stat-item"><i class="fas fa-comment"></i> <strong>${profileData.wallCount}</strong> записей</div>
          <div class="ai-stat-item"><i class="fas fa-medal"></i> <strong>${profileData.badges.length}</strong> бейджей</div>
        </div>
      `;
    } catch (e) {
      console.error('AI Profile Error:', e);
      body.innerHTML = '<p style="color:var(--danger);">Ошибка загрузки данных.</p>';
    }
  }

  // Функция добавления кнопки к аватарке
  function attachAIButton() {
    if (aiButtonAdded) return;

    // Ищем активную страницу профиля (свою или чужую)
    const avatarWrapper = document.querySelector('#page-profile.active .avatar-wrapper, #userProfileView .avatar-wrapper');
    if (!avatarWrapper || !currentUser) return;

    // Убедимся, что кнопка ещё не добавлена
    if (avatarWrapper.querySelector('.ai-profile-btn')) return;

    const btn = document.createElement('div');
    btn.className = 'ai-profile-btn';
    btn.title = 'Спросить AI о профиле';
    btn.innerHTML = '<i class="fas fa-exclamation"></i>';

    // Определяем, чей профиль смотрим
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

  // Сброс флага при смене страницы, чтобы заново искать аватарку
  function resetAIObserver() {
    aiButtonAdded = false;
    observer.disconnect();
    startObserver();
  }

  // Наблюдаем за изменениями DOM, чтобы подхватить момент, когда профиль отрисован
  function startObserver() {
    observer = new MutationObserver(() => {
      const profilePage = document.getElementById('page-profile');
      const userView = document.getElementById('userProfileView');
      if ((profilePage && profilePage.classList.contains('active')) || (userView && userView.style.display !== 'none')) {
        attachAIButton();
      } else {
        aiButtonAdded = false;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // Первичная проверка
    attachAIButton();
  }

  // Запуск после полной загрузки
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // При смене маршрута (SPA) сбрасываем, чтобы кнопка пересоздалась
  window.addEventListener('popstate', resetAIObserver);
  // Также перехватываем вызов navigateTo, если он глобальный, но можно обойтись popstate
})();