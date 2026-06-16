// ========== ОБЪЯВЛЕНИЕ ==========
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

// ========== РЕАКЦИИ ==========
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

// ========== ПОСТРОЕНИЕ ПРОФИЛЯ (КОРНЕВАЯ ФУНКЦИЯ) ==========
async function openUserProfile(login) {
    console.log('[DiamKey] openUserProfile вызвана для', login);
    const pageUsers = document.getElementById('page-users');
    if (!pageUsers) return;

    // Очищаем всё и показываем скелет
    pageUsers.innerHTML = `
        <div class="glass-panel" style="text-align:center; padding:40px;">
            <i class="fas fa-circle-notch fa-spin" style="font-size:24px; color:var(--text-muted);"></i>
            <p class="text-muted" style="margin-top:12px;">Загрузка профиля ${escapeHtml(login)}...</p>
        </div>
    `;

    try {
        const [profileRes, gpxRes, wallRes] = await Promise.all([
            _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
            _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
            _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) {
            pageUsers.innerHTML = `<div class="glass-panel" style="text-align:center; padding:40px;"><p class="text-muted">Пользователь не найден</p></div>`;
            return;
        }

        const gpxFiles = gpxRes.data || [];
        const wallPosts = wallRes.data || [];
        const avatarHTML = profile.avatar 
            ? `<img src="${escapeHtml(profile.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`
            : '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';

        let gpxHTML = '';
        if (gpxFiles.length) {
            const grouped = {};
            gpxFiles.forEach(f => {
                const d = new Date(f.created_at);
                const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(f);
            });
            for (const [month, files] of Object.entries(grouped)) {
                const [year, mon] = month.split('-');
                const monthName = new Date(year, mon-1).toLocaleString('ru', { month: 'long', year: 'numeric' });
                gpxHTML += `<div class="gpx-month-group"><div class="gpx-month-title">${monthName}</div><div class="gpx-cards">`;
                files.forEach(f => {
                    gpxHTML += `
                    <div class="gpx-card glass-panel" onclick="viewGpxRoute('${f.id}')">
                        <i class="fas fa-map-marker-alt"></i>
                        <h4>${escapeHtml(f.name)}</h4>
                        <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
                        <button class="share-btn" onclick="event.stopPropagation(); copyGpxLink('${f.id}')"><i class="fas fa-share-alt"></i></button>
                    </div>`;
                });
                gpxHTML += '</div></div>';
            }
        } else {
            gpxHTML = '<p class="text-muted">Нет поездок</p>';
        }

        let wallHTML = wallPosts.length 
            ? wallPosts.map(p => `
                <div class="wall-post glass-panel" data-post-id="${p.id}">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                        ${p.user_avatar ? `<img src="${escapeHtml(p.user_avatar)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);"></i>'}
                        <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                        <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p>${escapeHtml(p.content)}</p>
                    <div class="wall-post-footer">${renderReactions(p.reactions, p.id)}</div>
                </div>
            `).join('')
            : '<p class="text-muted">Записей пока нет</p>';

        pageUsers.innerHTML = `
            <div class="glass-panel">
                <a href="/users" style="color:var(--accent); text-decoration:none; display:inline-block; margin-bottom:16px;">← Все пользователи</a>
                <div class="profile-header" style="display:flex; gap:24px; align-items:center;">
                    <div class="avatar-wrapper">${avatarHTML}</div>
                    <div>
                        <h2>${escapeHtml(profile.name || login)}</h2>
                        <p style="color:var(--text-muted);">${escapeHtml(profile.description || 'Нет описания')}</p>
                        <small style="color:var(--text-muted);">${profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : ''}</small>
                    </div>
                </div>
            </div>
            <div class="glass-panel"><h3>Поездки с Diamond GPX</h3>${gpxHTML}</div>
            <div class="glass-panel">
                <div class="wall-input" style="display:flex; gap:12px; margin-bottom:20px;">
                    <textarea id="userWallMessage" rows="1" placeholder="Написать на стене..." style="flex:1; background:rgba(255,255,255,0.06); border:1px solid var(--border-glass); border-radius:18px; padding:14px 18px; color:var(--text-primary); resize:none; font-size:15px;"></textarea>
                    <button class="btn" id="postUserWallBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="userWallPosts">${wallHTML}</div>
            </div>
        `;

        // Навешиваем реакции
        pageUsers.querySelectorAll('.reaction-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const postId = this.closest('.wall-post').dataset.postId;
                toggleReaction(postId, this.dataset.type, this);
            });
        });

        // Кнопка отправки сообщения
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

// Свой профиль (аналогично)
async function renderMyProfile() {
    const pageProfile = document.getElementById('page-profile');
    if (!pageProfile || !currentUser) return;

    pageProfile.innerHTML = `<div class="glass-panel" style="text-align:center; padding:40px;"><i class="fas fa-circle-notch fa-spin"></i> Загрузка...</div>`;

    try {
        const login = currentUser.login;
        const [profileRes, gpxRes, wallRes] = await Promise.all([
            _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
            _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
            _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) return;

        const gpxFiles = gpxRes.data || [];
        const wallPosts = wallRes.data || [];
        const avatarHTML = profile.avatar 
            ? `<img src="${escapeHtml(profile.avatar)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`
            : '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';

        let gpxHTML = gpxFiles.length ? buildGpxHTML(gpxFiles) : '<p class="text-muted">Нет поездок</p>';
        let wallHTML = wallPosts.length ? buildWallHTML(wallPosts) : '<p class="text-muted">Записей пока нет</p>';

        pageProfile.innerHTML = `
            <div class="glass-panel">
                <div class="profile-header" style="display:flex; gap:24px; align-items:center;">
                    <div class="avatar-wrapper" id="myAvatarWrapper">${avatarHTML}<div class="avatar-overlay"><i class="fas fa-pencil-alt"></i></div></div>
                    <div>
                        <h2>${escapeHtml(profile.name || login)}</h2>
                        <p class="editable-text" id="myDescription">${escapeHtml(profile.description || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i></p>
                        <small>${profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : ''}</small>
                    </div>
                </div>
            </div>
            <div class="glass-panel"><h3>Поездки с Diamond GPX</h3>${gpxHTML}</div>
            <div class="glass-panel">
                <div class="wall-input" style="display:flex; gap:12px; margin-bottom:20px;">
                    <textarea id="myWallMessage" rows="1" placeholder="Написать на стене..." style="flex:1; background:rgba(255,255,255,0.06); border:1px solid var(--border-glass); border-radius:18px; padding:14px 18px; color:var(--text-primary); resize:none; font-size:15px;"></textarea>
                    <button class="btn" id="postMyWallBtn"><i class="fas fa-paper-plane"></i></button>
                </div>
                <div id="myWallPosts">${wallHTML}</div>
            </div>
        `;

        document.getElementById('myAvatarWrapper').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => { await updateProfile({ avatar: ev.target.result }); renderMyProfile(); };
                reader.readAsDataURL(file);
            };
            input.click();
        };

        document.getElementById('myDescription').onclick = () => {
            document.getElementById('editDescriptionInput').value = profile.description || '';
            document.getElementById('editDescriptionModal').style.display = 'flex';
            document.getElementById('editDescriptionModal').classList.add('active');
        };

        // Реакции и отправка на стене
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
        console.error(e);
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

function buildGpxHTML(files) {
    const grouped = {};
    files.forEach(f => {
        const d = new Date(f.created_at);
        const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(f);
    });
    let html = '';
    for (const [month, files] of Object.entries(grouped)) {
        const [year, mon] = month.split('-');
        const monthName = new Date(year, mon-1).toLocaleString('ru', { month: 'long', year: 'numeric' });
        html += `<div class="gpx-month-group"><div class="gpx-month-title">${monthName}</div><div class="gpx-cards">`;
        files.forEach(f => {
            html += `
            <div class="gpx-card glass-panel" onclick="viewGpxRoute('${f.id}')">
                <i class="fas fa-map-marker-alt"></i>
                <h4>${escapeHtml(f.name)}</h4>
                <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
                <button class="share-btn" onclick="event.stopPropagation(); copyGpxLink('${f.id}')"><i class="fas fa-share-alt"></i></button>
            </div>`;
        });
        html += '</div></div>';
    }
    return html;
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

function copyGpxLink(fileId) { const url = `${location.origin}/gpx?id=${fileId}`; navigator.clipboard.writeText(url).then(() => showToast('Ссылка скопирована')); }
async function viewGpxRoute(fileId) {
    const { data } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (!data?.content) return showToast('Не удалось загрузить маршрут');
    navigateTo(`/gpx?id=${fileId}`);
}
