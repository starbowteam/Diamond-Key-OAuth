async function loadAnnouncement() {
    const body = document.getElementById('announcementBody');
    if (!body) return;
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const data = await getAnnouncement();
    if (data && data.length) {
        const creator = await getProfile('viktorshopa');
        body.innerHTML = `
            ${avatarHTML(creator?.avatar, 48)}
            <div class="announcement-content">
                <p>${escapeHtml(data[0].content)}</p>
                <div class="announcement-footer">
                    <span><strong>viktorshopa</strong> · Создатель Diamond</span>
                    <span>${new Date(data[0].created_at).toLocaleString()}</span>
                </div>
            </div>
        `;
    } else {
        body.innerHTML = '<p class="text-muted">Нет новых объявлений</p>';
    }
}

function renderReactions(reactionsObj, postId, typePrefix = '') {
    const reactions = reactionsObj || {};
    const types = { heart: '❤️', like: '👍', fire: '🔥' };
    const storageKey = `${typePrefix}reacted_${postId}`;
    const userReaction = localStorage.getItem(storageKey);
    let html = '';
    for (const [key, emoji] of Object.entries(types)) {
        const count = reactions[key] || 0;
        const activeClass = (userReaction === key) ? ' active' : '';
        html += `<button class="reaction-btn${activeClass}" data-type="${key}">${emoji} <span>${count}</span></button>`;
    }
    return html;
}

async function toggleReaction(postId, type, btn) {
    if (!currentUser) return showToast('Войдите');
    const storageKey = `reacted_${postId}`;
    const previousType = localStorage.getItem(storageKey);

    const { data: post, error } = await _supabase.from('profile_wall').select('reactions').eq('id', postId).maybeSingle();
    if (error || !post) {
        console.error('[DiamKey] Ошибка получения поста для реакции:', error);
        return showToast('Ошибка');
    }
    let reactions = post.reactions || {};

    if (previousType === type) {
        reactions[type] = Math.max((reactions[type] || 0) - 1, 0);
        localStorage.removeItem(storageKey);
    } else {
        if (previousType) {
            reactions[previousType] = Math.max((reactions[previousType] || 0) - 1, 0);
        }
        reactions[type] = (reactions[type] || 0) + 1;
        localStorage.setItem(storageKey, type);
    }

    const { error: updateError } = await _supabase.from('profile_wall').update({ reactions }).eq('id', postId);
    if (updateError) {
        console.error('[DiamKey] Ошибка обновления реакций:', updateError);
        return showToast('Ошибка');
    }

    const { data: owner } = await _supabase.from('profile_wall').select('profile_login').eq('id', postId).maybeSingle();
    if (owner && owner.profile_login !== currentUser.login) {
        await _supabase.from('notifications').insert({
            user_login: owner.profile_login,
            type: 'wall_reaction',
            from_login: currentUser.login,
            content: `${currentUser.name || currentUser.login} поставил(а) реакцию на вашу запись`,
            read: false
        });
    }

    const postEl = btn.closest('.wall-post');
    if (postEl) {
        const footer = postEl.querySelector('.wall-post-footer');
        if (footer) {
            footer.innerHTML = renderReactions(reactions, postId);
            footer.querySelectorAll('.reaction-btn').forEach(b => {
                b.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleReaction(postId, this.dataset.type, this);
                });
            });
        }
    }
}

function getBadgeGradientClass(badgeName) {
    const map = {
        'Bronze Buyer': 'badge-bronze',
        'Silver Buyer': 'badge-silver',
        'Gold Buyer': 'badge-gold',
        'Diamond Buyer': 'badge-diamond',
        'Emerald Buyer': 'badge-emerald',
        'Amethyst Buyer': 'badge-amethyst',
        'Legendary Buyer': 'badge-legendary',
        'Покупатель Века!': 'badge-century',
        'Creator | Seller': 'badge-creator-seller',
        'Diamond Lady': 'badge-diamond-lady',
        'Control Diamond': 'badge-control-diamond',
        'Bot Manager': 'badge-bot-manager',
        'Assistant': 'badge-assistant',
        'Ticket Hold': 'badge-ticket-hold',
        'Sales Manager': 'badge-sales-manager',
        'Partner Manager': 'badge-partner-manager',
        'Advertiser': 'badge-advertiser',
        'Diamond Richest': 'badge-diamond-richest',
        'Work': 'badge-work'
    };
    return map[badgeName] || '';
}

function applyCoverTransform(img, posX, posY, scale) {
    img.style.transform = `translate(-50%, -50%) translate(${posX}%, ${posY}%) scale(${scale})`;
}

function renderCoverHTML(profile, isOwnProfile, showBackBtn = false) {
    let coverContent = '';
    if (profile.cover && profile.cover.startsWith('image:')) {
        const src = profile.cover.replace('image:', '');
        const scale = profile.cover_scale || 1;
        const posX = profile.cover_pos_x || 0;
        const posY = profile.cover_pos_y || 0;
        coverContent = `<img class="cover-image" src="${escapeHtml(src)}" onload="applyCoverTransform(this, ${posX}, ${posY}, ${scale})">`;
    } else if (profile.cover && (profile.cover.startsWith('gradient:') || profile.cover.startsWith('color:'))) {
        const bg = profile.cover.startsWith('gradient:')
            ? `background: linear-gradient(135deg, ${profile.cover.split(':')[1]}, ${profile.cover.split(':')[2]});`
            : `background: ${profile.cover.split(':')[1]};`;
        coverContent = `<div style="width:100%;height:100%;${bg}"></div>`;
    }

    let buttons = '';
    if (showBackBtn) {
        buttons += '<button class="back-btn-profile" onclick="goBackToUsersList()"><i class="fas fa-arrow-left"></i> Назад</button>';
    }
    if (isOwnProfile && !showBackBtn) {
        buttons += '<button class="edit-cover-btn" onclick="openCoverSetupModal(currentUser)"><i class="fas fa-pen"></i> Обложка</button>';
    }

    return `
        <div class="profile-cover" id="profileCoverBlock">
            ${coverContent}
            ${buttons}
        </div>
    `;
}

function getStatusHTML(login, lastSeen) {
    if (!lastSeen) {
        return `<div class="status-badge offline">Не в сети</div>`;
    }
    const now = Date.now();
    const last = new Date(lastSeen).getTime();
    const diff = now - last;

    if (diff < 120000) {
        return `<div class="status-badge online">В сети</div>`;
    }

    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
        return `<div class="status-badge offline">Был(а) ${minutes} мин. назад</div>`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `<div class="status-badge offline">Был(а) ${hours} ч. назад</div>`;
    }
    const days = Math.floor(hours / 24);
    return `<div class="status-badge offline">Был(а) ${days} д. назад</div>`;
}

function defaultDescription(login) {
    return `Я ${login}, пришёл к вам в DiamKey! Надеюсь подружиться!`;
}

async function renderUserProfileHTML(login, profile, wallPosts, badges) {
    const { data: presence } = await _supabase
        .from('user_presence')
        .select('last_seen')
        .eq('login', login)
        .maybeSingle();

    const statusHTML = getStatusHTML(login, presence?.last_seen);
    const desc = profile.description || defaultDescription(profile.name || login);

    let badgesHTML = '';
    if (badges && badges.length > 0) {
        badgesHTML = badges.map(b => {
            const badge = b.badges;
            const gradientClass = getBadgeGradientClass(badge.name);
            return `
                <div class="badge-item">
                    <div class="badge-icon"><i class="fas ${badge.icon}" style="background:${badge.gradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></i></div>
                    <span class="${gradientClass}">${escapeHtml(badge.name)}</span>
                </div>
            `;
        }).join('');
    } else {
        badgesHTML = '<div class="badges-empty">Бейджиков пока нет!</div>';
    }

    const isOwnProfile = (currentUser && currentUser.login === login);
    const showBackBtn = !isOwnProfile;

    const diamondPlusTitle = 'Diamond Plus';
    const diamondPlusSubtitle = isOwnProfile ? 'Подписка скоро будет доступна XD' : 'Не подписан, подписки не существует XD';
    const diamondPlusClass = isOwnProfile ? 'diamond-plus-card' : '';

    const diamondPlusAction = isOwnProfile ? `onclick="navigateTo('/diamond-plus')"` : `onclick="showToast('В разработке')"`;

    return `
        <div class="profile-panel">
            ${renderCoverHTML(profile, isOwnProfile, showBackBtn)}
            <div class="avatar-section">
                <div class="avatar-wrapper">
                    ${avatarHTML(profile.avatar, 100)}
                </div>
            </div>
            <div class="profile-nickname-center">
                <div class="nickname-badge">${escapeHtml(profile.name || login)}</div>
            </div>
            <div class="profile-body">
                <div class="description-card" id="profileDescription">${escapeHtml(desc)}</div>
                <div class="action-card" onclick="navigateTo('/profile/${login}/gpxview')">
                    <div class="action-card-icon"><i class="fas fa-puzzle-piece"></i></div>
                    <div class="action-card-text">
                        <span class="action-card-title">Дополнения</span>
                        <span class="action-card-subtitle">Поездки, а в будущем и другое =)</span>
                    </div>
                    <i class="fas fa-chevron-right action-card-arrow"></i>
                </div>
                <div>
                    <div class="badges-panel">${badgesHTML}</div>
                    <div class="meta-row">
                        ${statusHTML}
                        <span class="regdate"><i class="fas fa-calendar-alt"></i> ${profile.created_at ? 'В DiamKey с ' + new Date(profile.created_at).toLocaleDateString() : ''}</span>
                    </div>
                </div>
                <div class="action-card ${diamondPlusClass}" ${diamondPlusAction} id="diamondPlusCard">
                    <div class="action-card-icon"><i class="fas fa-crown"></i></div>
                    <div class="action-card-text">
                        <span class="action-card-title" id="plusTitle">${diamondPlusTitle}</span>
                        <span class="action-card-subtitle">${diamondPlusSubtitle}</span>
                    </div>
                    <i class="fas fa-chevron-right action-card-arrow"></i>
                </div>
            </div>
        </div>
    `;
}

async function openUserProfile(login) {
    console.log('[DiamKey] openUserProfile для', login);
    const usersPanel = document.getElementById('usersPanel');
    const userView = document.getElementById('userProfileView');
    const userWallSection = document.getElementById('userWallSection');
    const pageUsers = document.getElementById('page-users');
    if (!pageUsers || !usersPanel || !userView) {
        console.error('[DiamKey] Не найдены контейнеры профиля');
        return;
    }

    if (!pageUsers.classList.contains('active')) {
        await new Promise(resolve => {
            const observer = new MutationObserver(mutations => {
                if (pageUsers.classList.contains('active')) {
                    observer.disconnect();
                    resolve();
                }
            });
            observer.observe(pageUsers, { attributes: true, attributeFilter: ['class'] });
            setTimeout(() => { observer.disconnect(); resolve(); }, 500);
        });
    }

    usersPanel.style.display = 'none';
    userView.style.display = 'block';
    userView.innerHTML = `
        <div style="text-align:center; padding:40px;">
            <i class="fas fa-circle-notch fa-spin" style="font-size:24px; color:var(--text-muted);"></i>
            <p class="text-muted">Загрузка профиля ${escapeHtml(login)}...</p>
        </div>
    `;

    try {
        const [profile, wallPosts, badges] = await Promise.all([
            getProfile(login),
            getWall(login),
            getUserBadges(login)
        ]);

        if (!profile) {
            userView.innerHTML = `<div style="text-align:center; padding:40px;"><p class="text-muted">Пользователь не найден</p></div>`;
            return;
        }

        const profileHTML = await renderUserProfileHTML(login, profile, wallPosts, badges);
        userView.innerHTML = profileHTML;

        const descEl = document.getElementById('profileDescription');
        if (descEl && currentUser && currentUser.login === login) {
            descEl.addEventListener('click', () => {
                document.getElementById('editDescriptionInput').value = profile.description || '';
                document.getElementById('editDescriptionModal').style.display = 'flex';
                document.getElementById('editDescriptionModal').classList.add('active');
            });
            document.getElementById('saveDescriptionBtn').onclick = async () => {
                const desc = document.getElementById('editDescriptionInput').value.trim();
                await updateProfile({ description: desc });
                descEl.textContent = desc || defaultDescription(profile.name || login);
                closeModal('editDescriptionModal');
                showToast('Описание сохранено');
            };
        }

        if (currentUser && currentUser.login === login) {
            startPlusGlitch();
        }

        if (userWallSection) {
            userWallSection.style.display = 'block';
            let wallHTML = '';
            if (wallPosts && wallPosts.length) {
                wallHTML = wallPosts.map(p => `
                    <div class="wall-post glass-panel" data-post-id="${p.id}">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                            ${avatarHTML(p.user_avatar, 32)}
                            <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                            <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(p.created_at).toLocaleString()}</span>
                        </div>
                        <p>${escapeHtml(p.content)}</p>
                        <div class="wall-post-footer">${renderReactions(p.reactions, p.id)}</div>
                    </div>
                `).join('');
            } else {
                wallHTML = '<div class="empty-wall-message"><h3>Записей пока нет</h3></div>';
            }
            userWallSection.innerHTML = `
                <div class="wall-input" style="display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.04); border-radius:18px; padding:8px 16px;">
                    <div style="width:36px; height:36px; border-radius:50%; overflow:hidden; flex-shrink:0;">
                        ${avatarHTML(currentUser?.avatar, 36)}
                    </div>
                    <textarea id="userWallMessage" rows="1" placeholder="Написать на стене..." style="flex:1; background:transparent; border:none; color:var(--text-primary); resize:none; font-size:15px; outline:none; padding:8px 0;"></textarea>
                    <button class="btn btn-send" id="postUserWallBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="userWallPosts">${wallHTML}</div>
            `;

            const postBtn = document.getElementById('postUserWallBtn');
            if (postBtn) {
                postBtn.onclick = async () => {
                    const msg = document.getElementById('userWallMessage')?.value.trim();
                    if (!msg || !currentUser) return;
                    await _supabase.from('profile_wall').insert([{ 
                        user_login: currentUser.login, 
                        user_name: currentUser.name || currentUser.login, 
                        user_avatar: currentUser.avatar || '', 
                        profile_login: login, 
                        content: msg,
                        reactions: {}
                    }]);
                    if (login !== currentUser.login) {
                        await _supabase.from('notifications').insert({
                            user_login: login,
                            type: 'wall_post',
                            from_login: currentUser.login,
                            content: `${currentUser.name || currentUser.login} написал на вашей стене`,
                            read: false
                        });
                    }
                    showToast('Запись добавлена');
                    openUserProfile(login);
                };
            }

            userWallSection.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const postId = this.closest('.wall-post').dataset.postId;
                    toggleReaction(postId, this.dataset.type, this);
                });
            });
        }
    } catch (e) {
        console.error('[DiamKey] Ошибка в openUserProfile:', e);
        userView.innerHTML = `<div style="text-align:center; padding:40px;"><p class="text-muted">Ошибка загрузки</p></div>`;
    }
}

function goBackToUsersList() {
    const usersPanel = document.getElementById('usersPanel');
    const userView = document.getElementById('userProfileView');
    const userWallSection = document.getElementById('userWallSection');
    if (usersPanel) usersPanel.style.display = 'block';
    if (userView) {
        userView.style.display = 'none';
        userView.className = 'glass-panel profile-top';
    }
    if (userWallSection) userWallSection.style.display = 'none';
    navigateTo('/users');
    if (typeof loadUsers === 'function') loadUsers();
}

async function renderMyProfile() {
    const pageProfile = document.getElementById('page-profile');
    if (!pageProfile || !currentUser) return;

    pageProfile.innerHTML = `<div class="glass-panel" style="text-align:center; padding:40px;"><i class="fas fa-circle-notch fa-spin" style="font-size:24px; color:var(--text-muted);"></i> Загрузка...</div>`;

    try {
        const login = currentUser.login;
        const [profile, wallPosts, badges] = await Promise.all([
            getProfile(login),
            getWall(login),
            getUserBadges(login)
        ]);

        if (!profile) return;

        const { data: presence } = await _supabase
            .from('user_presence')
            .select('last_seen')
            .eq('login', login)
            .maybeSingle();

        const statusHTML = getStatusHTML(login, presence?.last_seen);
        const desc = profile.description || defaultDescription(profile.name || login);

        let badgesHTML = '';
        if (badges && badges.length > 0) {
            badgesHTML = badges.map(b => {
                const badge
