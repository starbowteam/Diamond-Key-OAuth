// ========== DIAMKEY WALL (профили, стена, GPX, объявление) ==========

// Объявление
async function loadAnnouncement() {
    const body = document.getElementById('announcementBody');
    if (!body) return;
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length) {
        const { data: creator } = await _supabase.from('users').select('avatar').eq('email', 'abugay12@mail.ru').maybeSingle();
        body.innerHTML = `
            <img src="${creator?.avatar || ''}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
            <div class="announcement-content">
                <p>${escapeHtml(data[0].content)}</p>
                <div class="announcement-footer">
                    <span>viktorshopa · Создатель Diamond</span>
                    <span>${new Date(data[0].created_at).toLocaleString()}</span>
                </div>
            </div>
        `;
    } else {
        body.innerHTML = '<p class="text-muted">Нет новых объявлений</p>';
    }
}

// Профиль пользователя
async function showUserProfile(login) {
    const usersPanel = document.getElementById('usersPanel');
    const userView = document.getElementById('userProfileView');
    const gpxSection = document.getElementById('userGpxSection');
    const wallSection = document.getElementById('userWallSection');
    if (usersPanel) usersPanel.style.display = 'none';
    if (userView) userView.style.display = 'block';
    if (gpxSection) gpxSection.style.display = 'block';
    if (wallSection) wallSection.style.display = 'block';

    // Хлебные крошки
    const breadcrumbs = document.createElement('div');
    breadcrumbs.className = 'breadcrumbs';
    breadcrumbs.innerHTML = '<a href="/users">← Все пользователи</a>';
    userView.prepend(breadcrumbs);

    const [profileRes, gpxFilesRes, wallRes] = await Promise.all([
        _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
        _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
        _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
    ]);

    const profile = profileRes.data;
    if (!profile) return;

    document.getElementById('userName').textContent = profile.name || login;
    const avatarEl = document.getElementById('userAvatar');
    if (profile.avatar) {
        avatarEl.src = profile.avatar;
        avatarEl.style.display = '';
    } else {
        avatarEl.style.display = 'none';
        avatarEl.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:40px;color:var(--text-muted);"></i>';
    }
    document.getElementById('userDescription').textContent = profile.description || 'Нет описания';
    document.getElementById('userRegDate').textContent = profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : '';

    // GPX с группировкой по месяцам
    const gpxFiles = gpxFilesRes.data || [];
    const gpxContainer = document.getElementById('userGpxFiles');
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

    // Стена с автосаджестом автора и реакциями
    const wallPosts = wallRes.data || [];
    document.getElementById('userWallPosts').innerHTML = wallPosts.length ? wallPosts.map(p => `
        <div class="wall-post glass-panel">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                ${p.user_avatar ? `<img src="${p.user_avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:24px;color:var(--text-muted);"></i>'}
                <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                <span class="text-muted" style="margin-left:auto;font-size:0.75rem;">${new Date(p.created_at).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.content)}</p>
            <div class="wall-post-footer">
                <button class="reaction-btn ${p.liked_by_user ? 'liked' : ''}" data-id="${p.id}" onclick="toggleWallReaction('${p.id}', this)">
                    <i class="fas fa-heart"></i> <span>${p.likes || 0}</span>
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-muted">Записей пока нет</p>';

    // Автосаджест
    const wallInput = document.querySelector('#page-users .wall-input');
    if (wallInput && currentUser) {
        const preview = document.createElement('div');
        preview.className = 'wall-author-preview';
        preview.innerHTML = `
            <img src="${currentUser.avatar || ''}" onerror="this.style.display='none'">
            <span>${currentUser.name || currentUser.login}</span>
        `;
        wallInput.prepend(preview);
    }

    document.getElementById('postUserWallBtn').onclick = async () => {
        const msg = document.getElementById('userWallMessage').value.trim();
        if (!msg || !currentUser) return;
        await _supabase.from('profile_wall').insert([{ user_login: currentUser.login, user_name: currentUser.name || currentUser.login, user_avatar: currentUser.avatar || '', profile_login: login, content: msg, likes: 0 }]);
        document.getElementById('userWallMessage').value = '';
        showToast('Запись добавлена');
        showUserProfile(login);
    };
}

function goBackToUsersList() {
    document.getElementById('usersPanel').style.display = 'block';
    document.getElementById('userProfileView').style.display = 'none';
    document.getElementById('userGpxSection').style.display = 'none';
    document.getElementById('userWallSection').style.display = 'none';
    navigateTo('/users');
}

// Мой профиль
async function loadMyProfile() {
    const login = currentUser.login;
    const [profileRes, gpxFilesRes, wallRes] = await Promise.all([
        _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
        _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
        _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
    ]);

    const profile = profileRes.data;
    if (!profile) return;

    document.getElementById('myName').textContent = profile.name || login;
    const avatarEl = document.getElementById('myAvatar');
    if (profile.avatar) {
        avatarEl.src = profile.avatar;
        avatarEl.style.display = '';
    } else {
        avatarEl.style.display = 'none';
        avatarEl.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:40px;color:var(--text-muted);"></i>';
    }

    // Описание с иконкой редактирования
    const descEl = document.getElementById('myDescription');
    descEl.innerHTML = `${escapeHtml(profile.description || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
    descEl.onclick = () => {
        document.getElementById('editDescriptionInput').value = profile.description || '';
        const modal = document.getElementById('editDescriptionModal');
        modal.style.display = 'flex';
        modal.classList.add('active');
    };

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
        document.getElementById('myDescription').innerHTML = `${escapeHtml(desc || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
        closeModal('editDescriptionModal');
        showToast('Описание сохранено');
    };

    // GPX с группировкой и кнопкой «Поделиться»
    const gpxFiles = gpxFilesRes.data || [];
    const gpxContainer = document.getElementById('myGpxFiles');
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

    // Стена с реакциями
    const wallPosts = wallRes.data || [];
    document.getElementById('myWallPosts').innerHTML = wallPosts.length ? wallPosts.map(p => `
        <div class="wall-post glass-panel">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                ${p.user_avatar ? `<img src="${p.user_avatar}" style="width:24px;height:24px;border-radius:50%;">` : '<i class="fas fa-user"></i>'}
                <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                <span class="text-muted" style="margin-left:auto;font-size:0.75rem;">${new Date(p.created_at).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.content)}</p>
            <div class="wall-post-footer">
                <button class="reaction-btn ${p.liked_by_user ? 'liked' : ''}" data-id="${p.id}" onclick="toggleWallReaction('${p.id}', this)">
                    <i class="fas fa-heart"></i> <span>${p.likes || 0}</span>
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-muted">Записей пока нет</p>';

    document.getElementById('postMyWallBtn').onclick = async () => {
        const msg = document.getElementById('myWallMessage').value.trim();
        if (!msg) return;
        await _supabase.from('profile_wall').insert([{ user_login: currentUser.login, user_name: currentUser.name || currentUser.login, user_avatar: currentUser.avatar || '', profile_login: login, content: msg, likes: 0 }]);
        document.getElementById('myWallMessage').value = '';
        showToast('Запись добавлена');
        loadMyProfile();
    };
}

// Функция копирования ссылки на GPX
function copyGpxLink(fileId) {
    const url = `${window.location.origin}/gpx?id=${fileId}`;
    navigator.clipboard.writeText(url).then(() => showToast('Ссылка на маршрут скопирована'));
}

// Прямой просмотр GPX по ID
async function viewGpxRoute(fileId) {
    const { data } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (!data || !data.content) return showToast('Не удалось загрузить маршрут');
    navigateTo(`/gpx?id=${fileId}`);
}

// Предпросмотр GPX перед публикацией (встроен в initGPX)
function previewGpxBeforeSave(content) {
    const parsed = parseGPX(content);
    let allPoints = [];
    parsed.tracks.forEach(t => t.segments.forEach(seg => allPoints.push(...seg)));
    const distance = allPoints.length > 1 ? allPoints.reduce((sum, p, i, arr) => i>0 ? sum + haversine(arr[i-1].lat, arr[i-1].lon, p.lat, p.lon) : 0, 0) : 0;
    const msg = `Найдено треков: ${parsed.tracks.length}, точек: ${allPoints.length}, дистанция: ${(distance/1000).toFixed(1)} км. Опубликовать?`;
    // Покажем простой confirm (можно заменить на кастомную модалку)
    if (confirm(msg)) {
        document.getElementById('gpxNameModal').style.display = 'flex';
        document.getElementById('gpxNameModal').classList.add('active');
    }
}

// Реакции на стене (лайк)
async function toggleWallReaction(postId, btn) {
    const { data } = await _supabase.from('profile_wall').select('likes').eq('id', postId).maybeSingle();
    const currentLikes = data?.likes || 0;
    const newLikes = currentLikes + 1;  // просто увеличиваем, без проверки уникальности
    await _supabase.from('profile_wall').update({ likes: newLikes }).eq('id', postId);
    btn.querySelector('span').textContent = newLikes;
    btn.classList.add('liked');
    showToast('❤️ Спасибо за реакцию!');
}
