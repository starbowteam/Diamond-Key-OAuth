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

function renderCoverHTML(profile, isOwnProfile) {
    if (profile.cover && profile.cover.startsWith('image:')) {
        const src = profile.cover.replace('image:', '');
        const scale = profile.cover_scale || 1;
        const posX = profile.cover_pos_x || 0;
        const posY = profile.cover_pos_y || 0;
        return `
            <div class="profile-cover" id="profileCoverBlock">
                <img class="cover-image" src="${escapeHtml(src)}" onload="applyCoverTransform(this, ${posX}, ${posY}, ${scale})">
                ${isOwnProfile ? '<div class="cover-hover"><i class="fas fa-pen"></i></div>' : ''}
            </div>
        `;
    } else if (profile.cover && (profile.cover.startsWith('gradient:') || profile.cover.startsWith('color:'))) {
        const bg = profile.cover.startsWith('gradient:')
            ? `background: linear-gradient(135deg, ${profile.cover.split(':')[1]}, ${profile.cover.split(':')[2]});`
            : `background: ${profile.cover.split(':')[1]};`;
        return `
            <div class="profile-cover" id="profileCoverBlock" style="${bg}">
                ${isOwnProfile ? '<div class="cover-hover"><i class="fas fa-pen"></i></div>' : ''}
            </div>
        `;
    } else {
        return `
            <div class="profile-cover" id="profileCoverBlock">
                ${isOwnProfile ? '<div class="cover-hover"><i class="fas fa-pen"></i></div>' : ''}
            </div>
        `;
    }
}

/**
 * Аватар без лишних обёрток, рамка остаётся ровной.
 * Если src пустой – fa-user, иначе img + скрытая иконка для подмены при ошибке.
 */
function avatarHTML(src, size = 100) {
    if (!src || !src.trim()) {
        return `<i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:50%;"></i>`;
    }
    return `
        <img src="${escapeHtml(src)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:none;align-items:center;justify-content:center;border-radius:50%;"></i>
    `;
}

async function renderUserProfileHTML(login, profile, wallPosts, badges) {
    const online = await isUserOnline(login);
    const onlineDot = online ? '<div class="online-dot"></div>' : '';

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
    }

    const isOwnProfile = (currentUser && currentUser.login === login);
    const navigateAction = isOwnProfile
        ? `navigateTo('/profile/${login}/gpxview')`
        : `navigateTo('/profile/${login}/gpxview', true)`;

    const coverBlock = renderCoverHTML(profile, isOwnProfile);

    return `
        ${coverBlock}
        <div class="avatar-section">
            <div class="avatar-wrapper">
                ${avatarHTML(profile.avatar, 100)}
                ${onlineDot}
            </div>
        </div>
        <div class="profile-info">
            <div class="profile-details">
                <h2>${escapeHtml(profile.name || login)}</h2>
                <p class="description" id="profileDescription">${escapeHtml(profile.description || 'Нет описания')}</p>
                <span class="regdate">${profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : ''}</span>
            </div>
            <div class="profile-actions">
                <button class="btn btn-icon back-to-users-btn" onclick="goBackToUsersList()" title="Назад к пользователям"><i class="fas fa-arrow-left"></i></button>
                <button class="btn btn-icon puzzle-btn" onclick="${navigateAction}" title="Поездки GPX"><i class="fas fa-puzzle-piece"></i></button>
            </div>
        </div>
        <div class="badges-row">${badgesHTML}</div>
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
        userView.className = 'profile-panel';

        const coverBlock = document.getElementById('profileCoverBlock');
        if (coverBlock && currentUser && currentUser.login === login) {
            coverBlock.addEventListener('click', () => {
                openCoverSetupModal(profile);
            });
        }

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
                descEl.textContent = desc || 'Нет описания';
                closeModal('editDescriptionModal');
                showToast('Описание сохранено');
            };
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

        const online = await isUserOnline(login);
        const onlineDot = online ? '<div class="online-dot"></div>' : '';

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
        }

        const coverBlock = renderCoverHTML(profile, true);
        let wallHTML = wallPosts.length ? buildWallHTML(wallPosts) : '<div class="empty-wall-message"><h3>Записей пока нет</h3></div>';

        pageProfile.innerHTML = `
            <div class="profile-panel">
                ${coverBlock}
                <div class="avatar-section">
                    <div class="avatar-wrapper" id="myAvatarWrapper">
                        ${avatarHTML(profile.avatar, 100)}
                        ${onlineDot}
                        <div class="avatar-overlay"><i class="fas fa-pencil-alt"></i></div>
                    </div>
                </div>
                <div class="profile-info">
                    <div class="profile-details">
                        <h2>${escapeHtml(profile.name || login)}</h2>
                        <p class="description" id="myDescription">${escapeHtml(profile.description || 'Нажмите, чтобы добавить описание')}</p>
                        <span class="regdate">${profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <div class="profile-actions">
                        <button class="btn btn-icon puzzle-btn" onclick="navigateTo('/profile/${login}/gpxview')" title="Мои GPX-поездки"><i class="fas fa-puzzle-piece"></i></button>
                    </div>
                </div>
                <div class="badges-row">${badgesHTML}</div>
            </div>
            <div class="glass-panel profile-wall">
                <div class="wall-input">
                    <textarea id="myWallMessage" rows="1" placeholder="Написать на стене..." style="flex:1; background:rgba(255,255,255,0.06); border:1px solid var(--border-glass); border-radius:18px; padding:14px 18px; color:var(--text-primary); resize:none; font-size:15px;"></textarea>
                    <button class="btn btn-send" id="postMyWallBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="myWallPosts">${wallHTML}</div>
            </div>
        `;

        const coverBlockEl = document.getElementById('profileCoverBlock');
        if (coverBlockEl) {
            coverBlockEl.addEventListener('click', () => {
                openCoverSetupModal(profile);
            });
        }

        document.getElementById('myAvatarWrapper').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => { await updateProfile({ avatar: ev.target.result }); renderMyProfile(); showToast('Аватар обновлён'); };
                reader.readAsDataURL(file);
            };
            input.click();
        };

        const descEl = document.getElementById('myDescription');
        if (descEl) {
            descEl.addEventListener('click', () => {
                document.getElementById('editDescriptionInput').value = profile.description || '';
                document.getElementById('editDescriptionModal').style.display = 'flex';
                document.getElementById('editDescriptionModal').classList.add('active');
            });
        }

        document.getElementById('saveDescriptionBtn').onclick = async () => {
            const desc = document.getElementById('editDescriptionInput').value.trim();
            await updateProfile({ description: desc });
            if (descEl) descEl.textContent = desc || 'Нажмите, чтобы добавить описание';
            closeModal('editDescriptionModal');
            showToast('Описание сохранено');
        };

        attachReactionListeners(pageProfile);

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
    container.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const postId = this.closest('.wall-post').dataset.postId;
            toggleReaction(postId, this.dataset.type, this);
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
        const coverBlock = renderCoverHTML(profile, isOwnProfile);

        let totalRides = gpxFiles.length;
        let totalDist = 0, totalAscent = 0;
        gpxFiles.forEach(f => {
            const stats = getGpxStats(f.content);
            if (stats.dist) totalDist += stats.dist;
            if (stats.ascent) totalAscent += stats.ascent;
        });

        const distStr = totalDist > 1000 ? (totalDist / 1000).toFixed(1) + ' км' : totalDist.toFixed(0) + ' м';
        const ascentStr = totalAscent > 0 ? '+' + totalAscent.toFixed(0) + ' м' : '—';

        let statsRowHTML = '';
        if (totalRides > 0) {
            statsRowHTML = `
                <div class="user-stats-row" style="margin: 24px 0 8px;">
                    <div class="stat-badge">
                        <div class="number">${totalRides}</div>
                        <div class="label">Поездки</div>
                    </div>
                    <div class="stat-badge">
                        <div class="number">${distStr}</div>
                        <div class="label">Общая дистанция</div>
                    </div>
                    <div class="stat-badge">
                        <div class="number">${ascentStr}</div>
                        <div class="label">Набор высоты</div>
                    </div>
                </div>
            `;
        } else {
            statsRowHTML = '<div class="empty-gpx-message"><p>Поездок пока нет</p></div>';
        }

        const backTarget = (currentUser && currentUser.login === login) ? '/profile' : `/users/${login}`;

        page.innerHTML = `
            <div class="profile-panel">
                ${coverBlock}
                <div class="avatar-section" style="display:flex; align-items:center; gap:20px;">
                    <div class="avatar-wrapper" style="flex-shrink:0;">
                        ${avatarHTML(profile.avatar, 100)}
                    </div>
                    <div style="margin-left:auto;">
                        <button class="btn btn-icon" onclick="navigateTo('${backTarget}')" title="Назад к профилю"><i class="fas fa-arrow-left"></i></button>
                    </div>
                </div>
                <div style="padding: 0 32px 24px;">
                    ${statsRowHTML}
                    ${totalRides > 0 ? `
                        <div class="profile-gpx-grid" id="profileGpxGrid" style="display:flex; flex-wrap:wrap; gap:16px; margin-top:24px;">
                            ${gpxFiles.map(f => {
                                const stats = getGpxStats(f.content);
                                let cardStatsHTML = '';
                                if (stats.dist !== null) {
                                    const dist = stats.dist > 1000 ? (stats.dist/1000).toFixed(1) + ' км' : Math.round(stats.dist) + ' м';
                                    const ascent = stats.ascent > 0 ? '+' + Math.round(stats.ascent) + ' м' : '';
                                    cardStatsHTML = `
                                        <div class="gpx-card-stats">
                                            <span>${dist}</span>
                                            ${ascent ? `<span>↑ ${ascent}</span>` : ''}
                                        </div>
                                    `;
                                }
                                return `
                                    <div class="gpx-card" onclick="viewGpxRoute('${f.id}')" style="flex: 1 1 220px;" data-file-id="${f.id}">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <h4>${escapeHtml(f.name)}</h4>
                                        <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
                                        ${cardStatsHTML}
                                        <div class="gpx-card-reactions" style="margin-top:10px; display:flex; gap:8px; align-items:center;" data-file-id="${f.id}">
                                            ${renderReactions(f.reactions || {}, f.id, 'gpx_')}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        document.querySelectorAll('.gpx-card-reactions .reaction-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.stopPropagation();
                const fileId = this.closest('.gpx-card').dataset.fileId;
                const type = this.dataset.type;
                await toggleGpxReaction(fileId, type);
                const { data: file } = await _supabase.from('gpx_files').select('reactions').eq('id', fileId).maybeSingle();
                if (file) {
                    const reactionsDiv = document.querySelector(`.gpx-card-reactions[data-file-id="${fileId}"]`);
                    if (reactionsDiv) {
                        reactionsDiv.innerHTML = renderReactions(file.reactions, fileId, 'gpx_');
                        reactionsDiv.querySelectorAll('.reaction-btn').forEach(b => {
                            b.addEventListener('click', async function(ev) {
                                ev.stopPropagation();
                                const fid = reactionsDiv.dataset.fileId;
                                const t = this.dataset.type;
                                await toggleGpxReaction(fid, t);
                                const { data: updatedFile } = await _supabase.from('gpx_files').select('reactions').eq('id', fid).maybeSingle();
                                if (updatedFile) {
                                    reactionsDiv.innerHTML = renderReactions(updatedFile.reactions, fid, 'gpx_');
                                }
                            });
                        });
                    }
                }
            });
        });
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
