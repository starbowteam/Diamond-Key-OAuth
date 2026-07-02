// diamkey-ai-profile.js — AI модалка профиля (описание в третьем лице)
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
    .ai-modal-overlay {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.8); backdrop-filter: blur(10px);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
      opacity: 0; visibility: hidden; transition: opacity 0.25s, visibility 0.25s;
    }
    .ai-modal-overlay.active { opacity: 1; visibility: visible; }
    .ai-modal-content {
      background: var(--bg-glass, rgba(18,18,24,0.85));
      backdrop-filter: blur(24px);
      border: 1px solid var(--border-glass, rgba(255,255,255,0.12));
      border-radius: 28px;
      padding: 28px;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .ai-modal-content .ai-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
    }
    .ai-modal-content .ai-header img {
      width: 48px; height: 48px; border-radius: 50%; object-fit: cover;
      border: 1px solid var(--border-glass);
    }
    .ai-modal-content .ai-body { color: var(--text-muted); font-size: 15px; line-height: 1.6; }
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
    }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'ai-modal-overlay';
  modal.id = 'aiModal';
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
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('active');
  });

  window.openAIModal = async function(profileLogin) {
    modal.classList.add('active');
    const body = document.getElementById('aiBody');
    if (!body) return;
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

      // Промпт для описания профиля в третьем лице
      const systemPrompt = `Ты — Diamond AI, система анализа профилей. Твоя задача — составить краткое описание профиля пользователя DiamKey в третьем лице, как будто это видит другой человек. Не используй обращений (не "ты", не "вы"). Не давай советов. Просто опиши профиль: логин, сколько дней в DiamKey, количество записей на стене, бейджи, обложку, аватар. Будь дружелюбным, но лаконичным. Отвечай на русском, чистым текстом, без маркдауна. 2-4 предложения.

Данные профиля:
- Логин: ${profileLogin}
- Имя: ${profile.name || profileLogin}
- Дней в DiamKey: ${daysInDiamKey}
- Записей на стене: ${wallPosts.length}
- Бейджи: ${badgesStr}
- Обложка: ${profile.cover ? (profile.cover.startsWith('image:') ? 'кастомное изображение' : 'градиент') : 'стандартная'}
- Аватар: ${profile.avatar ? 'установлен' : 'нет'}`;

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
            { role: 'user', content: 'Дай описание профиля.' }
          ],
          max_tokens: 400,
          temperature: 0.7
        })
      });

      const json = await response.json();
      const reply = json.choices?.[0]?.message?.content || 'Не удалось получить ответ от AI.';

      body.innerHTML = `
        <p style="font-size:15px; line-height:1.5; color:var(--text-primary); margin-bottom:16px;">${escapeHtml(reply)}</p>
        <div class="ai-stats" style="display:flex; gap:12px; flex-wrap:wrap;">
          <div class="ai-stat-item"><i class="fas fa-calendar-alt"></i> <strong>${daysInDiamKey}</strong> дн. в DiamKey</div>
          <div class="ai-stat-item"><i class="fas fa-comment"></i> <strong>${wallPosts.length}</strong> записей</div>
          <div class="ai-stat-item"><i class="fas fa-medal"></i> ${badgeList.length ? badgeList.map(b => `<span style="font-weight:600;">${escapeHtml(b)}</span>`).join(', ') : 'нет бейджей'}</div>
        </div>
      `;
    } catch (e) {
      console.error('AI Profile Error:', e);
      body.innerHTML = '<p style="color:var(--danger);">Ошибка загрузки данных.</p>';
    }
  };
})();
