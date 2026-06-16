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

async function showUserProfile(login) {
    console.log('[DiamKey] Загрузка профиля:', login);
    const usersPanel = document.getElementById('usersPanel');
    const userView = document.getElementById('userProfileView');
    const gpxSection = document.getElementById('userGpxSection');
    const wallSection = document.getElementById('userWallSection');
    if (usersPanel) usersPanel.style.display = 'none';
    if (userView) userView.style.display = 'block';
    if (gpxSection) gpxSection.style.display = 'block';
    if (wallSection) wallSection.style.display = 'block';

    document.getElementById('userBreadcrumbs').innerHTML = `<a href="/users">← Все пользователи</a> | <span>${escapeHtml(login)}</span>`;

    try {
        const [profileRes, gpxFilesRes, wallRes] = await Promise.all([
            _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
            _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
            _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) {
            console.warn('[DiamKey] Профиль не найден:', login);
            showToast('Пользователь не найден');
            goBackToUsersList();
            return;
        }

        const nameEl = document.getElementById('userName');
        if (nameEl) nameEl.textContent = profile.name || login;
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl) {
            if (profile.avatar) {
                avatarEl.src = profile.avatar;
                avatarEl.style.display = '';
            } else {
                avatarEl.style.display = 'none';
                if (avatarEl.parentElement) avatarEl.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';
            }
        }
        const descEl = document.getElementById('userDescription');
        if (descEl) descEl.textContent = profile.description || 'Нет описания';
        const regDateEl = document.getElementById('userRegDate');
        if (regDateEl) regDateEl.textContent = profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : '';

        const gpxFiles = gpxFilesRes.data || [];
        const gpxContainer = document.getElementById('userGpxFiles');
        if (gpxContainer) {
            if (gpxFiles.length) {
                const grouped = {};
                gpxFiles.forEach(f => {
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
                gpxContainer.innerHTML = html;
            } else {
                gpxContainer.innerHTML = '<p class="text-muted">Нет поездок</p>';
            }
        }

        const wallPosts = wallRes.data || [];
        const wallContainer = document.getElementById('userWallPosts');
        if (wallContainer) {
            wallContainer.innerHTML = wallPosts.length ? wallPosts.map(p => `
                <div class="wall-post glass-panel" data-post-id="${p.id}">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                        ${p.user_avatar ? `<img src="${p.user_avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);"></i>'}
                        <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                        <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p>${escapeHtml(p.content)}</p>
                    <div class="wall-post-footer">${renderReactions(p.reactions, p.id)}</div>
                </div>
            `).join('') : '<p class="text-muted">Записей пока нет</p>';

            wallContainer.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const postId = this.closest('.wall-post').dataset.postId;
                    toggleReaction(postId, this.dataset.type, this);
                });
            });
        }

        const wallInput = document.querySelector('#userWallSection .wall-input');
        if (wallInput && currentUser) {
            if (!wallInput.querySelector('.wall-author-preview')) {
                const preview = document.createElement('div');
                preview.className = 'wall-author-preview';
                preview.innerHTML = `<img src="${currentUser.avatar || ''}" style="width:28px;height:28px;border-radius:50%;" onerror="this.style.display='none'"><span>${currentUser.name || currentUser.login}</span>`;
                wallInput.prepend(preview);
            }
        }

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
                const userWallMessage = document.getElementById('userWallMessage');
                if (userWallMessage) userWallMessage.value = '';
                showToast('Запись добавлена');
                showUserProfile(login);
            };
        }
    } catch (e) {
        console.error('[DiamKey] Ошибка загрузки профиля:', e);
        showToast('Ошибка загрузки профиля');
    }
}

function goBackToUsersList() {
    document.getElementById('usersPanel').style.display = 'block';
    document.getElementById('userProfileView').style.display = 'none';
    document.getElementById('userGpxSection').style.display = 'none';
    document.getElementById('userWallSection').style.display = 'none';
    navigateTo('/users');
}

async function loadMyProfile() {
    const login = currentUser.login;
    console.log('[DiamKey] Загрузка своего профиля:', login);
    try {
        const [profileRes, gpxFilesRes, wallRes] = await Promise.all([
            _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
            _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
            _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
        ]);

        const profile = profileRes.data;
        if (!profile) return;

        document.getElementById('myName').textContent = profile.name || login;
        const avatarEl = document.getElementById('myAvatar');
        if (avatarEl) {
            if (profile.avatar) {
                avatarEl.src = profile.avatar;
                avatarEl.style.display = '';
            } else {
                avatarEl.style.display = 'none';
                if (avatarEl.parentElement) avatarEl.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:48px;color:var(--text-muted);"></i>';
            }
        }

        const descEl = document.getElementById('myDescription');
        if (descEl) {
            descEl.innerHTML = `${escapeHtml(profile.description || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
            descEl.onclick = () => {
                document.getElementById('editDescriptionInput').value = profile.description || '';
                const modal = document.getElementById('editDescriptionModal');
                modal.style.display = 'flex';
                modal.classList.add('active');
            };
        }

        document.getElementById('myRegDate').textContent = profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : '';

        document.getElementById('myAvatarWrapper').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => { await updateProfile({ avatar: ev.target.result }); loadMyProfile(); showToast('Аватар обновлён'); };
                reader.readAsDataURL(file);
            };
            input.click();
        };

        document.getElementById('saveDescriptionBtn').onclick = async () => {
            const desc = document.getElementById('editDescriptionInput').value.trim();
            await updateProfile({ description: desc });
            if (descEl) descEl.innerHTML = `${escapeHtml(desc || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
            closeModal('editDescriptionModal');
            showToast('Описание сохранено');
        };

        const gpxFiles = gpxFilesRes.data || [];
        const gpxContainer = document.getElementById('myGpxFiles');
        if (gpxContainer) {
            if (gpxFiles.length) {
                const grouped = {};
                gpxFiles.forEach(f => {
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
                gpxContainer.innerHTML = html;
            } else {
                gpxContainer.innerHTML = '<p class="text-muted">Нет поездок</p>';
            }
        }

        const wallPosts = wallRes.data || [];
        const wallContainer = document.getElementById('myWallPosts');
        if (wallContainer) {
            wallContainer.innerHTML = wallPosts.length ? wallPosts.map(p => `
                <div class="wall-post glass-panel" data-post-id="${p.id}">
                    <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
                        ${p.user_avatar ? `<img src="${p.user_avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);"></i>'}
                        <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                        <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(p.created_at).toLocaleString()}</span>
                    </div>
                    <p>${escapeHtml(p.content)}</p>
                    <div class="wall-post-footer">${renderReactions(p.reactions, p.id)}</div>
                </div>
            `).join('') : '<p class="text-muted">Записей пока нет</p>';

            wallContainer.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const postId = this.closest('.wall-post').dataset.postId;
                    toggleReaction(postId, this.dataset.type, this);
                });
            });
        }

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
            loadMyProfile();
        };
    } catch (e) {
        console.error('[DiamKey] Ошибка загрузки своего профиля:', e);
    }
}

function copyGpxLink(fileId) {
    const url = `${window.location.origin}/gpx?id=${fileId}`;
    navigator.clipboard.writeText(url).then(() => showToast('Ссылка скопирована'));
}

async function viewGpxRoute(fileId) {
    console.log('[DiamKey] Открытие GPX из профиля:', fileId);
    const { data, error } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (error || !data || !data.content) {
        console.error('[DiamKey] Ошибка загрузки GPX:', error);
        return showToast('Не удалось загрузить маршрут');
    }
    navigateTo(`/gpx?id=${fileId}`);
}

function previewGpxBeforeSave(content) {
    const parsed = parseGPX(content);
    let allPoints = [];
    parsed.tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    let totalDist = 0;
    for (let i = 1; i < allPoints.length; i++) totalDist += haversine(allPoints[i-1].lat, allPoints[i-1].lon, allPoints[i].lat, allPoints[i].lon);
    if (confirm(`Найдено треков: ${parsed.tracks.length}, точек: ${allPoints.length}, дистанция: ${(totalDist/1000).toFixed(1)} км. Опубликовать?`)) {
        document.getElementById('gpxNameModal').style.display = 'flex';
        document.getElementById('gpxNameModal').classList.add('active');
    } else {
        currentGpxContent = null;
        document.getElementById('saveGpxBtn').style.display = 'none';
    }
} //67
