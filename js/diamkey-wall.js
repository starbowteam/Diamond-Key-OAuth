async function loadAnnouncement() {
    const body = document.getElementById('announcementBody');
    if (!body) return;
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length) {
        const { data: creator } = await _supabase.from('users').select('avatar').eq('email', 'abugay12@mail.ru').maybeSingle();
        body.innerHTML = `
            <img src="${creator?.avatar || ''}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--border-glass);">
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

function renderReactions(reactionsObj, postId) {
    const reactions = reactionsObj || {};
    const types = { heart: '❤️', like: '👍', fire: '🔥' };
    const storageKey = `reacted_${postId}`;
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

function renderUserProfileHTML(login, profile, wallPosts) {
    const avatarHTML = profile.avatar 
        ? `<img src="${escapeHtml(profile.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`
        : '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';
    
    let wallHTML = '';
    if (wallPosts && wallPosts.length) {
        wallHTML = wallPosts.map(p => `
            <div class="wall-post glass-panel" data-post-id="${p.id}">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                    ${p.user_avatar ? `<img src="${escapeHtml(p.user_avatar)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);"></i>'}
                    <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                    <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(p.created_at).toLocaleString()}</span>
                </div>
                <p>${escapeHtml(p.content)}</p>
                <div class="wall-post-footer">${renderReactions(p.reactions, p.id)}</div>
            </div>
        `).join('');
    } else {
        wallHTML = '<p class="text-muted">Записей пока нет</p>';
    }

    return `
        <div class="breadcrumbs"><a href="/users">← Все пользователи</a> | <span>${escapeHtml(login)}</span></div>
        <div class="profile-header">
            <div class="avatar-wrapper">${avatarHTML}</div>
            <div class="profile-info">
                <h2>${escapeHtml(profile.name || login)}</h2>
                <p class="editable-text">${escapeHtml(profile.description || 'Нет описания')}</p>
                <span class="profile-regdate">${profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : ''}</span>
            </div>
            <button class="btn btn-icon puzzle-btn" onclick="navigateTo('/profile/${login}/gpxview')" title="Поездки GPX"><i class="fas fa-puzzle-piece"></i></button>
        </div>
        <button class="btn btn-icon" onclick="goBackToUsersList()"><i class="fas fa-arrow-left"></i></button>
        <div class="profile-wall">
            <div class="wall-input">
                <textarea id="userWallMessage" rows="1" placeholder="Написать на стене..."></textarea>
                <button class="btn btn-send" id="postUserWallBtn"><i class="fas fa-paper-plane"></i></button>
            </div>
            <div id="userWallPosts">${wallHTML}</div>
        </div>
    `;
}

async function openUserProfile(login) {
    console.log('[DiamKey] openUserProfile для', login);
    const pageUsers = document.getElementById('page-users');
    if (!pageUsers) {
        console.error('[DiamKey] Контейнер #page-users не найден');
        return;
    }

    if (!pageUsers.classList.contains('active')) {
        console.warn('[DiamKey] Страница ещё не active, ждём активации');
        await new Promise(resolve => {
            const observer = new MutationObserver(mutations => {
                if (pageUsers.classList.contains('active')) {
                    observer.disconnect();
                    resolve();
                }
            });
            observer.observe(pageUsers, { attributes: true, attributeFilter: ['class'] });
            setTimeout(() => {
                observer.disconnect();
                resolve();
            }, 500);
        });
    }

    pageUsers.innerHTML = `
        <div class="glass-panel" style="text-align:center; padding:40px;">
            <i class="fas fa-circle-notch fa-spin" style="font-size:24px; color:var(--text-muted);"></i>
            <p class="text-muted">Загрузка профиля ${escapeHtml(login)}...</p>
        </div>
    `;

    try {
        const [profileRes, wallRes] = await Promise.all([
            _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
            _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) {
            pageUsers.innerHTML = `<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Пользователь не найден</p></div>`;
            return;
        }

        const wallPosts = wallRes.data || [];

        pageUsers.innerHTML = renderUserProfileHTML(login, profile, wallPosts);

        pageUsers.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const postId = this.closest('.wall-post').dataset.postId;
                toggleReaction(postId, this.dataset.type, this);
            });
        });

        const wallInput = pageUsers.querySelector('.wall-input');
        if (wallInput && currentUser) {
            if (!wallInput.querySelector('.wall-author-preview')) {
                const preview = document.createElement('div');
                preview.className = 'wall-author-preview';
                preview.innerHTML = `<img src="${currentUser.avatar || ''}" style="width:28px;height:28px;border-radius:50%;" onerror="this.style.display='none'"><span>${currentUser.name || currentUser.login}</span>`;
                wallInput.prepend(preview);
            }
        }

        const postBtn = pageUsers.querySelector('#postUserWallBtn');
        if (postBtn) {
            postBtn.onclick = async () => {
                const msg = pageUsers.querySelector('#userWallMessage')?.value.trim();
                if (!msg || !currentUser) return;
                await _supabase.from('profile_wall').insert([{ 
                    user_login: currentUser.login, 
                    user_name: currentUser.name || currentUser.login, 
                    user_avatar: currentUser.avatar || '', 
                    profile_login: login, 
                    content: msg,
                    reactions: {}
                }]);
                showToast('Запись добавлена');
                openUserProfile(login);
            };
        }
    } catch (e) {
        console.error('[DiamKey] Ошибка в openUserProfile:', e);
        pageUsers.innerHTML = `<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Ошибка загрузки</p></div>`;
    }
}

function goBackToUsersList() {
    document.getElementById('usersPanel').style.display = 'block';
    const userView = document.getElementById('userProfileView');
    if (userView) userView.style.display = 'none';
    navigateTo('/users');
}

async function renderMyProfile() {
    const pageProfile = document.getElementById('page-profile');
    if (!pageProfile || !currentUser) return;

    pageProfile.innerHTML = `<div class="glass-panel" style="text-align:center; padding:40px;"><i class="fas fa-circle-notch fa-spin" style="font-size:24px; color:var(--text-muted);"></i> Загрузка...</div>`;

    try {
        const login = currentUser.login;
        const [profileRes, wallRes] = await Promise.all([
            _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
            _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) return;

        const wallPosts = wallRes.data || [];
        const avatarHTML = profile.avatar 
            ? `<img src="${escapeHtml(profile.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`
            : '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';

        pageProfile.innerHTML = `
            <div class="glass-panel profile-top">
                <div class="profile-header">
                    <div class="avatar-wrapper" id="myAvatarWrapper">${avatarHTML}<div class="avatar-overlay"><i class="fas fa-pencil-alt"></i></div></div>
                    <div class="profile-info">
                        <h2>${escapeHtml(profile.name || login)}</h2>
                        <p class="editable-text" id="myDescription">${escapeHtml(profile.description || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i></p>
                        <span class="profile-regdate">${profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : ''}</span>
                    </div>
                    <button class="btn btn-icon puzzle-btn" onclick="navigateTo('/profile/${login}/gpxview')" title="Мои GPX-поездки"><i class="fas fa-puzzle-piece"></i></button>
                </div>
            </div>
            <div class="glass-panel profile-wall">
                <div class="wall-input">
                    <textarea id="myWallMessage" rows="1" placeholder="Написать на стене..." style="flex:1; background:rgba(255,255,255,0.06); border:1px solid var(--border-glass); border-radius:18px; padding:14px 18px; color:var(--text-primary); resize:none; font-size:15px;"></textarea>
                    <button class="btn btn-send" id="postMyWallBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="myWallPosts">${wallPosts.length ? buildWallHTML(wallPosts) : '<p class="text-muted">Записей пока нет</p>'}</div>
            </div>
        `;

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

        document.getElementById('myDescription').onclick = () => {
            document.getElementById('editDescriptionInput').value = profile.description || '';
            document.getElementById('editDescriptionModal').style.display = 'flex';
            document.getElementById('editDescriptionModal').classList.add('active');
        };

        document.getElementById('saveDescriptionBtn').onclick = async () => {
            const desc = document.getElementById('editDescriptionInput').value.trim();
            await updateProfile({ description: desc });
            document.getElementById('myDescription').innerHTML = `${escapeHtml(desc || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
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
                ${p.user_avatar ? `<img src="${escapeHtml(p.user_avatar)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);"></i>'}
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

async function renderProfileGpxView(login) {
    const page = document.getElementById('page-profile-gpx');
    if (!page) return;

    try {
        const [profileRes, gpxRes] = await Promise.all([
            _supabase.from('users').select('name, avatar').eq('login', login).maybeSingle(),
            _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) {
            page.innerHTML = '<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Пользователь не найден</p></div>';
            return;
        }

        const gpxFiles = gpxRes.data || [];
        const hasRides = gpxFiles.length > 0;

        const avatarHTML = profile.avatar 
            ? `<img src="${escapeHtml(profile.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`
            : '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';

        let cardsHTML = '';
        if (hasRides) {
            cardsHTML = gpxFiles.map(f => `
                <div class="gpx-card" onclick="viewGpxRoute('${f.id}')">
                    <i class="fas fa-map-marker-alt"></i>
                    <h4>${escapeHtml(f.name)}</h4>
                    <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
                    <button class="share-btn" onclick="event.stopPropagation(); copyGpxLink('${f.id}')"><i class="fas fa-share-alt"></i></button>
                </div>
            `).join('');
        } else {
            cardsHTML = `
                <div class="empty-gpx-message" style="grid-column: 1 / -1;">
                    <i class="fas fa-map-signs"></i>
                    <h3>Пользователь не загружал свои прогулки</h3>
                    <p>Как только появятся GPX-файлы, они отобразятся здесь</p>
                </div>
            `;
        }

        page.innerHTML = `
            <div class="glass-panel">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">
                    <div class="profile-header" style="margin-bottom:0;">
                        <div class="avatar-wrapper">${avatarHTML}</div>
                        <div class="profile-info">
                            <h2>${escapeHtml(profile.name || login)}</h2>
                        </div>
                    </div>
                    <button class="btn btn-icon" onclick="navigateTo('/profile/${login}')" title="Назад к профилю"><i class="fas fa-arrow-left"></i></button>
                </div>
                <h3><i class="fas fa-map-marker-alt"></i> Поездки ${escapeHtml(profile.name || login)}</h3>
                <div class="profile-gpx-grid" id="profileGpxGrid">
                    ${cardsHTML}
                </div>
            </div>
        `;
    } catch (e) {
        console.error('[DiamKey] Ошибка загрузки GPX-профиля:', e);
        page.innerHTML = '<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Ошибка загрузки</p></div>';
    }
}

async function viewGpxRoute(fileId) {
    console.log('[DiamKey] Открытие GPX из профиля:', fileId);
    const { data, error } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (error || !data || !data.content) {
        console.error('[DiamKey] Ошибка загрузки GPX:', error);
        return showToast('Не удалось загрузить маршрут');
    }
    navigateTo(`/add/gpx?id=${fileId}`);
}

function copyGpxLink(fileId) {
    const url = `${location.origin}/add/gpx?id=${fileId}`;
    navigator.clipboard.writeText(url).then(() => showToast('Ссылка скопирована'));
}
