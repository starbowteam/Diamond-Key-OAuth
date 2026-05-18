// ==================== DIAMKEY PROFILE — публичный профиль, достижения, кастомизация ====================

async function renderProfile(username = null) {
  const page = document.getElementById('pageContent');
  if (!page) return;
  const login = username || (currentUser ? currentUser.login : null);
  if (!login) { page.innerHTML = '<p>Пользователь не найден</p>'; return; }

  const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).maybeSingle();
  if (error || !user) { page.innerHTML = '<p>Пользователь не найден</p>'; return; }

  const isOwner = currentUser && currentUser.login === login;
  const avatarFrame = getAvatarFrame(user);
  const coverStyle = user.cover_image 
    ? `background-image: url(${user.cover_image}); background-size: cover; background-position: center;` 
    : 'background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);';
  const trustPercent = Math.min((user.trust_level || 0) * 10, 100);
  const subscriptionBadge = user.subscription_tier === 'diamond_plus' 
    ? '<span class="badge badge-diamond"><i class="fas fa-gem"></i> Diamond Plus</span>' : '';
  const adminBadge = user.role === 'admin' 
    ? '<span class="badge badge-admin"><i class="fas fa-shield-haltered"></i> Админ</span>' : '';
  const staffBadge = user.role === 'staff' 
    ? '<span class="badge badge-staff"><i class="fas fa-user-cog"></i> Персонал</span>' : '';

  // Рендерим достижения
  const { data: achievements } = await _supabase.from('achievements').select('*').eq('user_login', login);

  page.innerHTML = `
    <div class="profile-cover" style="${coverStyle}">
      <div class="profile-avatar-wrapper" style="border: 3px solid ${avatarFrame}; border-radius: 50%;">
        ${user.avatar ? `<img src="${user.avatar}" alt="Avatar">` : '<i class="fas fa-user-circle" style="font-size: 5rem;"></i>'}
      </div>
    </div>
    <div class="profile-info">
      <h1 class="profile-name ${user.nickname_effect}">${escapeHtml(user.name || user.login)}</h1>
      <p class="profile-status"><i class="fas ${user.fa_icon || 'fa-comment'}"></i> ${escapeHtml(user.status_text || '')}</p>
      <div class="profile-badges">
        ${adminBadge} ${staffBadge} ${subscriptionBadge}
      </div>
      <div class="trust-bar">
        <div class="trust-fill" style="width: ${trustPercent}%;"></div>
        <span>Уровень доверия: ${user.trust_level || 0}/10</span>
      </div>
    </div>
    <div class="achievements-grid">
      ${achievements && achievements.length ? achievements.map(a => `
        <div class="achievement-card">
          <i class="fas ${a.icon}"></i>
          <strong>${escapeHtml(a.title)}</strong>
          <p>${escapeHtml(a.description)}</p>
          <div class="progress"><div style="width:${(a.progress/a.max_progress)*100}%"></div></div>
        </div>
      `).join('') : '<p>Пока нет достижений</p>'}
    </div>
    ${isOwner ? `<button class="btn" onclick="editProfile()"><i class="fas fa-edit"></i> Редактировать</button>` : ''}
  `;
}

function editProfile() {
  // переключает на страницу настроек профиля
  navigate('/profile?edit=true');
}