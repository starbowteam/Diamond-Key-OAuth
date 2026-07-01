// diamkey-wall.js — полный файл: профиль, стена, GPX, Diamond Plus, Database, реакции

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

// Маппинг старых ключей на эмодзи
const EMOJI_MAP = { heart: '❤️', like: '👍', fire: '🔥' };
const BASE_EMOJIS = ['❤️', '👍', '🔥'];

function renderReactions(reactionsObj, postId) {
    const reactions = reactionsObj || {};
    const storageKey = `reacted_${postId}`;
    const userReaction = localStorage.getItem(storageKey);

    // Приводим старые ключи к эмодзи
    const normalized = {};
    for (const [key, count] of Object.entries(reactions)) {
        const emoji = EMOJI_MAP[key] || key;
        normalized[emoji] = (normalized[emoji] || 0) + count;
    }

    let html = '';
    // Базовые три эмодзи всегда показываем (даже если 0)
    BASE_EMOJIS.forEach(emoji => {
        const count = normalized[emoji] || 0;
        const activeClass = (userReaction === emoji) ? ' active' : '';
        html += `<button class="reaction-btn${activeClass}" data-emoji="${emoji}">${emoji} <span>${count}</span></button>`;
    });

    // Кнопка "..."
    html += `<button class="reaction-btn reaction-more" onclick="window.openReactionPicker('${postId}')">···</button>`;

    // Дополнительные эмодзи (не базовые) с ненулевым количеством
    const extraEmojis = Object.entries(normalized).filter(([emoji]) => !BASE_EMOJIS.includes(emoji) && normalized[emoji] > 0);
    extraEmojis.sort((a, b) => b[1] - a[1]);
    extraEmojis.forEach(([emoji, count]) => {
        const activeClass = (userReaction === emoji) ? ' active' : '';
        html += `<button class="reaction-btn${activeClass}" data-emoji="${emoji}">${emoji} <span>${count}</span></button>`;
    });

    return html;
}

// Универсальная функция toggleReaction (поддерживает текстовые и голосовые посты)
async function toggleReaction(postId, emoji) {
    if (!currentUser) return showToast('Войдите');
    const storageKey = `reacted_${postId}`;
    const previousEmoji = localStorage.getItem(storageKey);

    let table, idField, idValue;
    if (typeof postId === 'string' && postId.startsWith('voice_')) {
        table = 'wall_audio';
        idField = 'id';
        idValue = parseInt(postId.replace('voice_', ''));
    } else {
        table = 'profile_wall';
        idField = 'id';
        idValue = parseInt(postId);
    }

    const { data: post, error } = await _supabase.from(table).select('reactions').eq(idField, idValue).maybeSingle();
    if (error || !post) {
        console.warn('Reaction: post not found in', table);
        return;
    }
    let reactions = post.reactions || {};

    // Приводим старые ключи к эмодзи
    const normalized = {};
    for (const [key, count] of Object.entries(reactions)) {
        const e = EMOJI_MAP[key] || key;
        normalized[e] = (normalized[e] || 0) + count;
    }

    if (previousEmoji === emoji) {
        normalized[emoji] = Math.max((normalized[emoji] || 0) - 1, 0);
        if (normalized[emoji] === 0) delete normalized[emoji];
        localStorage.removeItem(storageKey);
    } else {
        if (previousEmoji) {
            normalized[previousEmoji] = Math.max((normalized[previousEmoji] || 0) - 1, 0);
            if (normalized[previousEmoji] === 0) delete normalized[previousEmoji];
        }
        normalized[emoji] = (normalized[emoji] || 0) + 1;
        localStorage.setItem(storageKey, emoji);
    }

    const { error: updateError } = await _supabase.from(table).update({ reactions: normalized }).eq(idField, idValue);
    if (updateError) {
        console.error('[DiamKey] Ошибка обновления реакций:', updateError);
        return showToast('Ошибка');
    }

    // Обновляем DOM
    const postEl = document.querySelector(`.wall-post[data-post-id="${postId}"]`);
    if (postEl) {
        const footer = postEl.querySelector('.wall-post-footer');
        if (footer) {
            footer.innerHTML = renderReactions(normalized, postId);
            footer.querySelectorAll('.reaction-btn[data-emoji]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleReaction(postId, this.dataset.emoji);
                });
            });
        }
    }

    // Уведомление владельцу
    if (table === 'profile_wall') {
        const { data: owner } = await _supabase.from('profile_wall').select('profile_login').eq('id', idValue).maybeSingle();
        if (owner && owner.profile_login !== currentUser.login) {
            await _supabase.from('notifications').insert({
                user_login: owner.profile_login,
                type: 'wall_reaction',
                from_login: currentUser.login,
                content: `${currentUser.name || currentUser.login} поставил(а) ${emoji} на вашу запись`,
                read: false
            });
        }
    } else if (table === 'wall_audio') {
        const { data: owner } = await _supabase.from('wall_audio').select('profile_login').eq('id', idValue).maybeSingle();
        if (owner && owner.profile_login !== currentUser.login) {
            await _supabase.from('notifications').insert({
                user_login: owner.profile_login,
                type: 'wall_reaction',
                from_login: currentUser.login,
                content: `${currentUser.name || currentUser.login} поставил(а) ${emoji} на вашу голосовую заметку`,
                read: false
            });
        }
    }
}

function getBadgeGradientClass(badgeName) {
    const map = {
        'Bronze Buyer': 'badge-bronze', 'Silver Buyer': 'badge-silver', 'Gold Buyer': 'badge-gold',
        'Diamond Buyer': 'badge-diamond', 'Emerald Buyer': 'badge-emerald', 'Amethyst Buyer': 'badge-amethyst',
        'Legendary Buyer': 'badge-legendary', 'Покупатель Века!': 'badge-century', 'Creator | Seller': 'badge-creator-seller',
        'Diamond Lady': 'badge-diamond-lady', 'Control Diamond': 'badge-control-diamond', 'Bot Manager': 'badge-bot-manager',
        'Assistant': 'badge-assistant', 'Ticket Hold': 'badge-ticket-hold', 'Sales Manager': 'badge-sales-manager',
        'Partner Manager': 'badge-partner-manager', 'Advertiser': 'badge-advertiser', 'Diamond Richest': 'badge-diamond-richest',
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
        buttons += `
            <button class="edit-cover-btn" onclick="openCoverSetupModal(currentUser)" style="margin-right:8px;"><i class="fas fa-pen"></i> Обложка</button>
            <button class="edit-cover-btn" onclick="changeAvatar()"><i class="fas fa-camera"></i> Аватар</button>
        `;
    }

    return `
        <div class="profile-cover" id="profileCoverBlock">
            ${coverContent}
            ${buttons}
        </div>
    `;
}

function changeAvatar() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            await updateProfile({ avatar: ev.target.result });
            if (typeof renderMyProfile === 'function') renderMyProfile();
            showToast('Аватар обновлён');
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function getStatusHTML(login, lastSeen) {
    if (!lastSeen) return `<div class="status-badge offline">Не в сети</div>`;
    const now = Date.now();
    const diff = now - new Date(lastSeen).getTime();
    if (diff < 120000) return `<div class="status-badge online">В сети</div>`;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `<div class="status-badge offline">Был(а) ${minutes} мин. назад</div>`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `<div class="status-badge offline">Был(а) ${hours} ч. назад</div>`;
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
                <div class="nickname-badge">
                    ${escapeHtml(profile.name || login)}
                    <button class="ai-btn-nick" onclick="event.stopPropagation(); window.openAIModal('${login}')" title="Анализ профиля AI"><i class="fas fa-info-circle"></i></button>
                </div>
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
            const allPosts = await (typeof getMixedWallPosts === 'function' ? getMixedWallPosts(login, wallPosts) : wallPosts);
            let wallHTML = allPosts.length ? allPosts.map(post => typeof renderPostHTML === 'function' ? renderPostHTML(post) : renderTextPostHTML(post)).join('') : '<div class="empty-wall-message"><h3>Записей пока нет</h3></div>';

            userWallSection.innerHTML = `
                <div class="wall-input" style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.04); border-radius:18px; padding:8px 16px;">
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

            // Привязка реакций
            userWallSection.querySelectorAll('.reaction-btn[data-emoji]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const postId = this.closest('.wall-post').dataset.postId;
                    toggleReaction(postId, this.dataset.emoji);
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
    if (userView) { userView.style.display = 'none'; userView.className = 'glass-panel profile-top'; }
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

        const { data: presence } = await _supabase.from('user_presence').select('last_seen').eq('login', login).maybeSingle();
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

        const coverBlock = renderCoverHTML(profile, true);
        const allPosts = await (typeof getMixedWallPosts === 'function' ? getMixedWallPosts(login, wallPosts) : wallPosts);
        let wallHTML = allPosts.length ? allPosts.map(post => typeof renderPostHTML === 'function' ? renderPostHTML(post) : renderTextPostHTML(post)).join('') : '<div class="empty-wall-message"><h3>Записей пока нет</h3></div>';

        pageProfile.innerHTML = `
            <div class="profile-panel">
                ${coverBlock}
                <div class="avatar-section">
                    <div class="avatar-wrapper">
                        ${avatarHTML(profile.avatar, 100)}
                    </div>
                </div>
                <div class="profile-nickname-center">
                    <div class="nickname-badge">
                        ${escapeHtml(profile.name || login)}
                        <button class="ai-btn-nick" onclick="event.stopPropagation(); window.openAIModal('${login}')" title="Анализ профиля AI"><i class="fas fa-info-circle"></i></button>
                    </div>
                </div>
                <div class="profile-body">
                    <div class="description-card" id="myDescription">${escapeHtml(desc)}</div>
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
                    <div class="action-card diamond-plus-card" onclick="navigateTo('/diamond-plus')" id="diamondPlusCard">
                        <div class="action-card-icon"><i class="fas fa-crown"></i></div>
                        <div class="action-card-text">
                            <span class="action-card-title" id="plusTitle">Diamond Plus</span>
                            <span class="action-card-subtitle">Подписка скоро будет доступна XD</span>
                        </div>
                        <i class="fas fa-chevron-right action-card-arrow"></i>
                    </div>
                </div>
            </div>
            <div class="glass-panel profile-wall">
                <div class="wall-input" style="display:flex; align-items:center; gap:8px;">
                    <textarea id="myWallMessage" rows="1" placeholder="Написать на стене..." style="flex:1; background:rgba(255,255,255,0.06); border:1px solid var(--border-glass); border-radius:18px; padding:14px 18px; color:var(--text-primary); resize:none; font-size:15px;"></textarea>
                    <button class="btn btn-send" id="postMyWallBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="myWallPosts">${wallHTML}</div>
            </div>
        `;

        startPlusGlitch();

        const descEl = document.getElementById('myDescription');
        if (descEl) {
            descEl.addEventListener('click', () => {
                document.getElementById('editDescriptionInput').value = profile.description || '';
                document.getElementById('editDescriptionModal').style.display = 'flex';
                document.getElementById('editDescriptionModal').classList.add('active');
            });
        }

        document.getElementById('saveDescriptionBtn').onclick = async () => {
            const newDesc = document.getElementById('editDescriptionInput').value.trim();
            await updateProfile({ description: newDesc });
            if (descEl) descEl.textContent = newDesc || defaultDescription(profile.name || login);
            closeModal('editDescriptionModal');
            showToast('Описание сохранено');
        };

        // Привязка реакций
        pageProfile.querySelectorAll('.reaction-btn[data-emoji]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const postId = this.closest('.wall-post').dataset.postId;
                toggleReaction(postId, this.dataset.emoji);
            });
        });

        document.getElementById('postMyWallBtn').onclick = async () => {
            const msg = document.getElementById('myWallMessage').value.trim();
            if (!msg) return;
            await _supabase.from('profile_wall').insert([{ 
                user_login: currentUser.login, 
                user_name: currentUser.name || currentUser.login, 
                user_avatar: currentUser.avatar || '', 
                profile_login: login, 
                content: msg,
                reactions: {}
            }]);
            document.getElementById('myWallMessage').value = '';
            showToast('Запись добавлена');
            renderMyProfile();
        };
    } catch (e) {
        console.error('[DiamKey] Ошибка загрузки своего профиля:', e);
        pageProfile.innerHTML = '<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Ошибка загрузки</p></div>';
    }
}

// Вспомогательная функция рендера текстового поста
function renderTextPostHTML(post) {
    return `
      <div class="wall-post glass-panel" data-post-id="${post.id}">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
          ${avatarHTML(post.user_avatar, 32)}
          <strong>${escapeHtml(post.user_name || post.user_login)}</strong>
          <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(post.created_at).toLocaleString()}</span>
        </div>
        <p>${escapeHtml(post.content)}</p>
        <div class="wall-post-footer">${renderReactions(post.reactions, post.id)}</div>
      </div>
    `;
}

function buildWallHTML(posts) {
    return posts.map(p => `
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
}

function attachReactionListeners(container) {
    container.querySelectorAll('.reaction-btn[data-emoji]').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const postId = this.closest('.wall-post').dataset.postId;
            toggleReaction(postId, this.dataset.emoji);
        });
    });
}

function getGpxStats(content) {
    try {
        const parsed = parseGPX(content);
        let allPoints = [];
        parsed.tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
        if (allPoints.length < 2) return { dist: null, ascent: null };
        let totalDist = 0, ascent = 0;
        for (let i = 1; i < allPoints.length; i++) {
            const prev = allPoints[i-1], pt = allPoints[i];
            const d = haversine(prev.lat, prev.lon, pt.lat, pt.lon);
            totalDist += d;
            if (prev.ele !== null && pt.ele !== null && pt.ele > prev.ele) ascent += pt.ele - prev.ele;
        }
        return { dist: totalDist, ascent: ascent };
    } catch (e) {
        return { dist: null, ascent: null };
    }
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ====== ГЛИТЧ-ЭФФЕКТ для Diamond Plus ====== */
let plusGlitchInterval = null;
function startPlusGlitch() {
    if (plusGlitchInterval) clearInterval(plusGlitchInterval);
    const titleEl = document.getElementById('plusTitle');
    if (!titleEl) return;
    const base = "Diamond Plus";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";

    plusGlitchInterval = setInterval(() => {
        let result = "";
        for (let i = 0; i < base.length; i++) {
            if (Math.random() < 0.1) {
                result += chars[Math.floor(Math.random() * chars.length)];
            } else {
                result += base[i];
            }
        }
        titleEl.textContent = result;
    }, 150);
}

/* ====== СТРАНИЦА DIAMOND PLUS (С ЧАСТИЦАМИ) ====== */
async function renderDiamondPlusPage() {
    const page = document.getElementById('page-diamond-plus');
    if (!page) return;

    page.innerHTML = `
        <div class="plus-panel" id="plusPanelContainer">
            <canvas id="particleCanvas"></canvas>
            <div class="plus-header">
                <button class="back-btn-profile" onclick="navigateTo('/profile')"><i class="fas fa-arrow-left"></i> Назад</button>
                <h1>Diamond Plus</h1>
                <p class="plus-subtitle">Подписка, открывающая весь потенциал DiamKey</p>
            </div>
            <div class="plus-grid">
                <div class="plus-card">
                    <div class="plus-card-icon"><i class="fas fa-brain"></i></div>
                    <h3 class="plus-card-title">Diamond AI без цензуры</h3>
                    <p class="plus-card-desc">Искусственный интеллект, который отвечает прямо и без ограничений. Только вы и чистый разум.</p>
                    <p class="plus-card-extra">+ эксклюзивные модели</p>
                </div>
                <div class="plus-card">
                    <div class="plus-card-icon"><i class="fas fa-sliders-h"></i></div>
                    <h3 class="plus-card-title">Расширенные настройки профиля</h3>
                    <p class="plus-card-desc">Уникальные обложки, кастомные шрифты ника, эксклюзивные рамки аватара.</p>
                    <p class="plus-card-extra">+ безумная фантазия к ним</p>
                </div>
                <div class="plus-card">
                    <div class="plus-card-icon"><i class="fas fa-medal"></i></div>
                    <h3 class="plus-card-title">Премиум-бейдж</h3>
                    <p class="plus-card-desc">Серебряный значок Diamond Plus, который виден всем. Вас узнают и уважают.</p>
                    <p class="plus-card-extra">+ приоритетная поддержка</p>
                </div>
                <div class="plus-card">
                    <div class="plus-card-icon"><i class="fas fa-rocket"></i></div>
                    <h3 class="plus-card-title">Ранний доступ</h3>
                    <p class="plus-card-desc">Участвуйте в закрытых бета-тестах новых функций DiamKey и влияйте на развитие экосистемы.</p>
                    <p class="plus-card-extra">+ возможность взлететь</p>
                </div>
                <div class="plus-card">
                    <div class="plus-card-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                    <h3 class="plus-card-title">Расширенное хранилище</h3>
                    <p class="plus-card-desc">До 5 ГБ для ваших данных в дополнениях. Никаких ограничений.</p>
                    <p class="plus-card-extra">+ авто-бэкап данных</p>
                </div>
            </div>
            <div class="faq-section">
                <h2 class="faq-title">Часто спрашивают</h2>
                <div class="faq-item" onclick="this.classList.toggle('open')">
                    <div class="faq-q"><i class="fas fa-chevron-right"></i> Когда спишут деньги?</div>
                    <div class="faq-a">Когда вы оплатите подписку.</div>
                </div>
                <div class="faq-item" onclick="this.classList.toggle('open')">
                    <div class="faq-q"><i class="fas fa-chevron-right"></i> Можно ли отменить в любой момент?</div>
                    <div class="faq-a">Да, подписка отключается в один клик. До конца оплаченного периода все преимущества сохраняются.</div>
                </div>
                <div class="faq-item" onclick="this.classList.toggle('open')">
                    <div class="faq-q"><i class="fas fa-chevron-right"></i> Как получить ранний доступ?</div>
                    <div class="faq-a">Сразу после оформления подписки вы автоматически попадаете в список тестеров.</div>
                </div>
            </div>
            <div class="plus-cta">
                <div class="plus-price">
                    <span class="amount">₽149</span>
                    <span class="period">/ месяц</span>
                </div>
                <button class="plus-btn" onclick="showToast('Скоро будет!')"><i class="fas fa-crown"></i> Оформить подписку</button>
            </div>
        </div>
    `;

    setTimeout(() => {
        initParticles();
    }, 100);
}

/* ====== ЧАСТИЦЫ ДЛЯ DIAMOND PLUS ====== */
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const panel = canvas.parentElement;
    let particles = [];
    const maxParticles = 50;

    function resize() {
        canvas.width = panel.offsetWidth;
        canvas.height = panel.offsetHeight;
    }
    resize();
    window.addEventListener('resize', () => {
        resize();
        particles = [];
        for (let i = 0; i < maxParticles; i++) createParticle();
    });

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 1.5 + 0.5,
            speedY: Math.random() * 0.2 + 0.1,
            speedX: (Math.random() - 0.5) * 0.1,
            opacity: Math.random() * 0.5 + 0.2
        };
    }

    for (let i = 0; i < maxParticles; i++) particles.push(createParticle());

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(192,192,208,${p.opacity})`;
            ctx.fill();
            p.y -= p.speedY;
            p.x += p.speedX;
            if (p.y < -10) {
                p.y = canvas.height + 10;
                p.x = Math.random() * canvas.width;
            }
            if (p.x < -10 || p.x > canvas.width + 10) {
                p.x = Math.random() * canvas.width;
                p.y = canvas.height + 10;
            }
        });
        requestAnimationFrame(draw);
    }
    draw();
}

/* ====== СТРАНИЦА DIAMOND DATABASE ====== */
async function renderDatabasePage() {
    const page = document.getElementById('page-data');
    if (!page) return;

    page.innerHTML = `
        <div class="profile-panel">
            <div class="db-header">
                <h1>Diamond Database</h1>
                <p class="db-subtitle">Ваше персональное облако в экосистеме Diamond</p>
            </div>
            <div class="db-content">
                <div class="db-card">
                    <div class="db-card-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                    <h3 class="db-card-title">Бесплатно для всех</h3>
                    <p class="db-card-desc">Каждый пользователь DiamKey получает 15 ГБ дискового пространства навсегда.</p>
                    <div class="db-card-highlight">15 ГБ</div>
                </div>
                <div class="db-card">
                    <div class="db-card-icon"><i class="fas fa-crown"></i></div>
                    <h3 class="db-card-title">Для Diamond Plus</h3>
                    <p class="db-card-desc">Подписчики получают расширенное хранилище и приоритетный доступ.</p>
                    <div class="db-card-highlight">150 ГБ</div>
                </div>
                <div class="db-card">
                    <div class="db-card-icon"><i class="fas fa-shield-alt"></i></div>
                    <h3 class="db-card-title">Сквозное шифрование</h3>
                    <p class="db-card-desc">Все файлы шифруются на вашем устройстве перед отправкой. Даже владелец сервера не имеет доступа к содержимому — только вы.</p>
                </div>
                <div class="db-card">
                    <div class="db-card-icon"><i class="fas fa-sync-alt"></i></div>
                    <h3 class="db-card-title">Авто-бэкапы</h3>
                    <p class="db-card-desc">Файлы и настройки сохраняются автоматически по расписанию. Восстановление в один клик.</p>
                </div>
                <div class="db-card">
                    <div class="db-card-icon"><i class="fas fa-puzzle-piece"></i></div>
                    <h3 class="db-card-title">Доступ из любого сервиса</h3>
                    <p class="db-card-desc">Diamond AI, DiamKey, Dirmess — все используют одно хранилище для ваших данных.</p>
                </div>
            </div>

            <h2 style="text-align:center; margin-bottom:20px;">Тарифы</h2>
            <div class="db-plans">
                <div class="plan-card">
                    <div class="plan-name">Бесплатный</div>
                    <div class="plan-size">15 ГБ</div>
                    <div class="plan-price">0 ₽ / месяц</div>
                    <ul class="plan-features">
                        <li><i class="fas fa-check"></i> Хранение любых файлов</li>
                        <li><i class="fas fa-check"></i> Доступ через DiamKey</li>
                        <li><i class="fas fa-check"></i> Базовое шифрование</li>
                        <li><i class="fas fa-times" style="color:#e05d5d;"></i> Приоритетная поддержка</li>
                        <li><i class="fas fa-times" style="color:#e05d5d;"></i> Расширенная безопасность</li>
                    </ul>
                </div>
                <div class="plan-card">
                    <span class="plan-badge">Популярный</span>
                    <div class="plan-name">Diamond Plus</div>
                    <div class="plan-size">150 ГБ</div>
                    <div class="plan-price">включено в подписку</div>
                    <ul class="plan-features">
                        <li><i class="fas fa-check"></i> Всё из бесплатного</li>
                        <li><i class="fas fa-check"></i> 150 ГБ пространства</li>
                        <li><i class="fas fa-check"></i> Приоритетная поддержка</li>
                        <li><i class="fas fa-check"></i> Расширенное шифрование</li>
                        <li><i class="fas fa-check"></i> Доступ к бета-функциям</li>
                    </ul>
                </div>
            </div>

            <div class="db-faq-section">
                <h2 class="db-faq-title">Часто спрашивают</h2>
                <div class="db-faq-item" onclick="this.classList.toggle('open')">
                    <div class="db-faq-q"><i class="fas fa-chevron-right"></i> Когда хранилище заработает?</div>
                    <div class="db-faq-a">Я собираю сервер из старого ПК. Как только оборудование будет готово — запущу бета-тест. Ориентировочно — через пару недель.</div>
                </div>
                <div class="db-faq-item" onclick="this.classList.toggle('open')">
                    <div class="db-faq-q"><i class="fas fa-chevron-right"></i> Какие типы файлов можно хранить?</div>
                    <div class="db-faq-a">Любые: документы, фото, видео, архивы, программы, установщики — всё, что вам нужно. Ограничений по типам файлов нет.</div>
                </div>
                <div class="db-faq-item" onclick="this.classList.toggle('open')">
                    <div class="db-faq-q"><i class="fas fa-chevron-right"></i> Кто имеет доступ к моим файлам?</div>
                    <div class="db-faq-a">Только вы. Все данные шифруются на вашем устройстве перед отправкой на сервер. Даже я, как владелец сервера, не могу прочитать ваши файлы — у меня нет ключей шифрования.</div>
                </div>
                <div class="db-faq-item" onclick="this.classList.toggle('open')">
                    <div class="db-faq-q"><i class="fas fa-chevron-right"></i> Можно ли делиться файлами?</div>
                    <div class="db-faq-a">Да, можно будет создавать публичные ссылки и делиться любыми файлами с друзьями.</div>
                </div>
                <div class="db-faq-item" onclick="this.classList.toggle('open')">
                    <div class="db-faq-q"><i class="fas fa-chevron-right"></i> Где физически находится сервер?</div>
                    <div class="db-faq-a">У меня дома, в России. Я сам настраиваю безопасность и мониторинг.</div>
                </div>
            </div>

            <div class="db-cta">
                <button class="btn" onclick="showToast('Скоро будет!')"><i class="fas fa-database"></i> Скоро будет!</button>
            </div>
        </div>
    `;
}

/* ====== GPX-ВЬЮ ====== */
async function renderProfileGpxView(login) {
    const page = document.getElementById('page-profile-gpx');
    if (!page) return;

    try {
        const [profile, gpxFiles] = await Promise.all([
            getProfile(login),
            getGpxFiles(login)
        ]);

        if (!profile) {
            page.innerHTML = '<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Пользователь не найден</p></div>';
            return;
        }

        const isOwnProfile = (currentUser && currentUser.login === login);
        const coverBlock = renderCoverHTML(profile, false, false);

        let totalRides = gpxFiles.length;
        let totalDist = 0, totalAscent = 0;
        gpxFiles.forEach(f => {
            const stats = getGpxStats(f.content);
            if (stats.dist) totalDist += stats.dist;
            if (stats.ascent) totalAscent += stats.ascent;
        });

        const distStr = totalDist > 1000 ? (totalDist / 1000).toFixed(1) + ' км' : totalDist.toFixed(0) + ' м';
        const ascentStr = totalAscent > 0 ? '+' + totalAscent.toFixed(0) + ' м' : '—';

        const backTarget = (currentUser && currentUser.login === login) ? '/profile' : `/users/${login}`;

        page.innerHTML = `
            <div class="profile-panel">
                ${coverBlock}
                <button class="gpx-back-btn" onclick="navigateTo('${backTarget}')"><i class="fas fa-arrow-left"></i> Назад</button>
                <div class="avatar-section">
                    <div class="avatar-wrapper">
                        ${avatarHTML(profile.avatar, 100)}
                    </div>
                </div>
                <div class="path-row" style="display:flex; align-items:center; gap:12px; padding: 12px 32px 0;">
                    <div class="nickname-badge" style="margin-bottom:0; font-size:18px;">${escapeHtml(profile.name || login)}</div>
                    <i class="fas fa-chevron-right" style="color:var(--accent);"></i>
                    <div class="nickname-badge" style="margin-bottom:0; font-size:18px; background:rgba(160,160,176,0.1); border-color:var(--accent);">Дополнения ${escapeHtml(profile.name || login)}</div>
                </div>
                ${totalRides > 0 ? `
                <div class="gpx-stats-row" style="display:flex; gap:16px; justify-content:center; padding: 20px 32px; flex-wrap:wrap;">
                    <div class="stat-badge"><div class="number">${totalRides}</div><div class="label">Поездки</div></div>
                    <div class="stat-badge"><div class="number">${distStr}</div><div class="label">Общая дистанция</div></div>
                    <div class="stat-badge"><div class="number">${ascentStr}</div><div class="label">Набор высоты</div></div>
                </div>
                <div class="gpx-grid" style="display:flex; flex-wrap:wrap; gap:16px; padding:0 32px 24px;">
                    ${gpxFiles.map(f => {
                        const stats = getGpxStats(f.content);
                        let cardStatsHTML = '';
                        if (stats.dist !== null) {
                            const dist = stats.dist > 1000 ? (stats.dist/1000).toFixed(1) + ' км' : Math.round(stats.dist) + ' м';
                            const ascent = stats.ascent > 0 ? '+' + Math.round(stats.ascent) + ' м' : '';
                            cardStatsHTML = `<div class="stats" style="font-size:13px; color:var(--text-muted); display:flex; gap:12px;"><span style="color:var(--text-primary);">${dist}</span>${ascent ? `<span>↑ ${ascent}</span>` : ''}</div>`;
                        }
                        return `
                            <div class="gpx-card" onclick="viewGpxRoute('${f.id}')" style="flex:1 1 200px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:18px; padding:16px; cursor:pointer;" data-file-id="${f.id}">
                                <i class="fas fa-map-marker-alt" style="font-size:24px; color:var(--accent); margin-bottom:8px;"></i>
                                <h4 style="font-size:15px; font-weight:600; margin-bottom:6px;">${escapeHtml(f.name)}</h4>
                                <div class="date" style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">${new Date(f.created_at).toLocaleDateString()}</div>
                                ${cardStatsHTML}
                            </div>
                        `;
                    }).join('')}
                </div>
                ` : '<div class="empty-gpx-message" style="padding:40px; text-align:center; color:var(--text-muted);">Поездок пока нет</div>'}
            </div>
        `;
    } catch (e) {
        console.error('[DiamKey] Ошибка загрузки GPX-профиля:', e);
        page.innerHTML = '<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Ошибка загрузки</p></div>';
    }
}

async function viewGpxRoute(fileId) {
    const { data, error } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (error || !data || !data.content) {
        return showToast('Не удалось загрузить маршрут');
    }
    navigateTo(`/add/gpx?id=${fileId}`);
}

function renderQrConfirm(ticket) {
    const page = document.getElementById('page-qr-confirm');
    if (!page) return;
    const isLoggedIn = !!currentUser;
    let controlsHTML = isLoggedIn ? `
        <div style="margin-bottom:20px;"><span>Вы вошли как <strong>${escapeHtml(currentUser.login)}</strong></span></div>
        <button class="btn btn-success" id="acceptQrBtn"><i class="fas fa-check-circle"></i> Принять</button>
        <button class="btn btn-danger" id="rejectQrBtn"><i class="fas fa-times-circle"></i> Отклонить</button>
    ` : `<p>Сначала войдите в DiamKey</p><button class="btn" onclick="navigateTo('/home')"><i class="fas fa-sign-in-alt"></i> Войти</button>`;

    page.innerHTML = `
        <div class="glass-panel" style="text-align:center; padding:40px; max-width:400px; margin:0 auto;">
            <img src="/assets/favicon.ico" style="width:64px;height:64px;border-radius:50%;margin-bottom:20px;animation: float 3s ease-in-out infinite;">
            <h2>Подтверждение входа</h2>
            <p class="text-muted">Запрос на вход через QR-код</p>
            <div id="qrConfirmControls">${controlsHTML}</div>
            <p class="error-msg" id="qrConfirmError" style="display:none;"></p>
        </div>`;
    if (isLoggedIn) {
        document.getElementById('acceptQrBtn').addEventListener('click', async () => {
            const { error } = await _supabase.from('qr_tickets').update({ login: currentUser.login, status: 'accepted' }).eq('ticket', ticket);
            if (error) {
                document.getElementById('qrConfirmError').textContent = 'Ошибка';
                document.getElementById('qrConfirmError').style.display = 'block';
                return;
            }
            page.innerHTML = '<div class="glass-panel" style="text-align:center;padding:40px;"><h2>Вход подтверждён!</h2></div>';
        });
        document.getElementById('rejectQrBtn').addEventListener('click', async () => {
            await _supabase.from('qr_tickets').update({ status: 'rejected' }).eq('ticket', ticket);
            page.innerHTML = '<div class="glass-panel" style="text-align:center;padding:40px;"><h2>Вход отклонён</h2></div>';
        });
    }
}
