// diamkey-ai-profile.js — AI-ассистент профиля (кнопка в нике)
(function() {
  const style = document.createElement('style');
  style.textContent = `
    .ai-btn-nick {
      width: 26px; height: 26px;
      border-radius: 8px;
      background: rgba(192,192,208,0.15);
      border: 1px solid var(--accent);
      color: var(--accent);
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      margin-left: 6px;
      vertical-align: middle;
    }
    .ai-btn-nick:hover { background: rgba(192,192,208,0.3); color: #fff; }
    .nickname-row {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      padding: 6px 16px;
      font-size: 20px;
      font-weight: 700;
    }
  `;
  document.head.appendChild(style);

  // Модалка AI (та же, что и раньше)
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

      const daysInDiamKey = profile.created_at
        ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : '?';

      const badgeList = badges.map(b => b.badges?.name).filter(Boolean);
      const badgesStr = badgeList.length ? badgeList.join(', ') : 'нет';

      const { data: configData } = await _supabase.from('service_config').select('mistral_api_key').eq('id',1).maybeSingle();
      if (!configData?.mistral_api_key) {
        body.innerHTML = '<p style="color:var(--danger);">API-ключ не настроен.</p>';
        return;
      }

      const systemPrompt = `Ты — Diamond AI, помощник на сайте DiamKey. Проанализируй профиль пользователя и дай персонализированный дружелюбный отзыв. Данные: логин: ${profileLogin}, имя: ${profile.name || profileLogin}, дней в DiamKey: ${daysInDiamKey}, записей на стене: ${wallPosts.length}, бейджи: ${badgesStr}. Сделай комплимент, отметь сильные стороны, дай 1-2 совета. Будь остроумным, но добрым. Отвечай на русском, чистым текстом, без маркдауна, 3-5 предложений.`;

      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + configData.mistral_api_key },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Дай анализ моего профиля.' }],
          max_tokens: 400, temperature: 0.8
        })
      });
      const json = await response.json();
      const reply = json.choices?.[0]?.message?.content || 'Не удалось получить ответ.';

      body.innerHTML = `<p style="font-size:15px; line-height:1.5; color:var(--text-primary); margin-bottom:16px;">${escapeHtml(reply)}</p>
        <div class="ai-stats" style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="ai-stat-item"><i class="fas fa-calendar-alt"></i> <strong>${daysInDiamKey}</strong> дн.</div>
          <div class="ai-stat-item"><i class="fas fa-comment"></i> <strong>${wallPosts.length}</strong> записей</div>
          <div class="ai-stat-item"><i class="fas fa-medal"></i> ${badgeList.length ? badgeList.map(b => `<span style="font-weight:600;">${escapeHtml(b)}</span>`).join(', ') : 'нет бейджей'}</div>
        </div>`;
    } catch (e) {
      console.error(e);
      body.innerHTML = '<p style="color:var(--danger);">Ошибка загрузки данных.</p>';
    }
  }

  // Вставляем кнопку AI в блок ника
  function attachAIButton() {
    const nickEl = document.querySelector('.nickname-badge');
    if (!nickEl || !currentUser) return;
    if (nickEl.parentElement.querySelector('.ai-btn-nick')) return;

    // Оборачиваем ник в .nickname-row
    const row = document.createElement('span');
    row.className = 'nickname-row';
    row.innerHTML = nickEl.innerHTML;
    nickEl.innerHTML = '';
    nickEl.appendChild(row);

    const btn = document.createElement('button');
    btn.className = 'ai-btn-nick';
    btn.title = 'Анализ профиля AI';
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

    row.appendChild(btn);
  }

  // Наблюдатель
  let observer;
  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(() => {
      const profilePage = document.getElementById('page-profile');
      const userView = document.getElementById('userProfileView');
      if ((profilePage && profilePage.classList.contains('active')) || (userView && userView.style.display !== 'none')) {
        attachAIButton();
      } else {
        const existingBtn = document.querySelector('.ai-btn-nick');
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
})();
