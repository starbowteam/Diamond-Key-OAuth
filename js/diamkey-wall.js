// ========== DIAMKEY WALL ==========
async function loadAnnouncement() {
    const body = document.getElementById('announcementBody');
    if (!body) return;
    body.innerHTML = '<div class="page-loader"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length) {
        const { data: creator } = await _supabase.from('users').select('avatar').eq('email', 'abugay12@mail.ru').maybeSingle();
        body.innerHTML = `
            <img src="${creator?.avatar || ''}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
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

async function showUserProfile(login) {
    const usersPanel = document.getElementById('usersPanel');
    const userView = document.getElementById('userProfileView');
    const gpxSection = document.getElementById('userGpxSection');
    const wallSection = document.getElementById('userWallSection');
    if (usersPanel) usersPanel.style.display = 'none';
    if (userView) userView.style.display = 'block';
    if (gpxSection) gpxSection.style.display = 'block';
    if (wallSection) wallSection.style.display = 'block';

    let bread = userView.querySelector('.breadcrumbs');
    if (!bread) {
        bread = document.createElement('div');
        bread.className = 'breadcrumbs';
        userView.prepend(bread);
    }
    bread.innerHTML = '<a href="/users">← Все пользователи</a>';

    const [profileRes, gpxRes, wallRes] = await Promise.all([
        _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
        _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
        _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
    ]);
    const profile = profileRes.data;
    if (!profile) return;

    document.getElementById('userName').textContent = profile.name || login;
    const av = document.getElementById('userAvatar');
    if (profile.avatar) {
        av.src = profile.avatar; av.style.display = '';
    } else {
        av.style.display = 'none';
        av.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:40px;color:var(--text-muted);"></i>';
    }
    document.getElementById('userDescription').textContent = profile.description || 'Нет описания';
    document.getElementById('userRegDate').textContent = profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : '';

    const gpxFiles = gpxRes.data || [];
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
                html += `<div class="gpx-card glass-panel" onclick="viewGpxRoute('${f.id}')">
                    <i class="fas fa-map-marker-alt"></i>
                    <h4>${escapeHtml(f.name)}</h4>
                    <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
                    <button class="share-btn" onclick="event.stopPropagation(); copyGpxLink('${f.id}')"><i class="fas fa-share-alt"></i></button>
                </div>`;
            });
            html += `</div></div>`;
        }
        gpxContainer.innerHTML = html;
    } else {
        gpxContainer.innerHTML = '<p class="text-muted">Нет поездок</p>';
    }

    const wallPosts = wallRes.data || [];
    document.getElementById('userWallPosts').innerHTML = wallPosts.length ? wallPosts.map(p => `
        <div class="wall-post glass-panel">
            <div class="wall-post-header">
                ${p.user_avatar ? `<img src="${p.user_avatar}">` : '<i class="fas fa-user"></i>'}
                <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                <span class="wall-post-time">${new Date(p.created_at).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.content)}</p>
            <div class="wall-post-footer">
                <button class="reaction-btn ${p.liked ? 'liked' : ''}" data-id="${p.id}" onclick="toggleWallReaction('${p.id}', this)">
                    <i class="fas fa-heart"></i> <span>${p.likes || 0}</span>
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-muted">Записей пока нет</p>';

    document.getElementById('postUserWallBtn').onclick = async () => {
        const msg = document.getElementById('userWallMessage').value.trim();
        if (!msg || !currentUser) return;
        await _supabase.from('profile_wall').insert([{
            user_login: currentUser.login,
            user_name: currentUser.name || currentUser.login,
            user_avatar: currentUser.avatar || '',
            profile_login: login,
            content: msg,
            likes: 0
        }]);
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

async function loadMyProfile() {
    const login = currentUser.login;
    const [profileRes, gpxRes, wallRes] = await Promise.all([
        _supabase.from('users').select('name, avatar, description, created_at').eq('login', login).maybeSingle(),
        _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false }),
        _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false })
    ]);
    const profile = profileRes.data;
    if (!profile) return;
    document.getElementById('myName').textContent = profile.name || login;
    const av = document.getElementById('myAvatar');
    if (profile.avatar) { av.src = profile.avatar; av.style.display = ''; }
    else { av.style.display = 'none'; av.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:40px;color:var(--text-muted);"></i>'; }
    const descEl = document.getElementById('myDescription');
    descEl.innerHTML = `${escapeHtml(profile.description || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
    descEl.onclick = () => {
        document.getElementById('editDescriptionInput').value = profile.description || '';
        const modal = document.getElementById('editDescriptionModal');
        modal.style.display = 'flex'; modal.classList.add('active');
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
        descEl.innerHTML = `${escapeHtml(desc || 'Нажмите, чтобы добавить описание')} <i class="fas fa-pencil-alt edit-icon"></i>`;
        closeModal('editDescriptionModal');
        showToast('Описание сохранено');
    };

    const gpxFiles = gpxRes.data || [];
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
                html += `<div class="gpx-card glass-panel" onclick="viewGpxRoute('${f.id}')">
                    <i class="fas fa-map-marker-alt"></i>
                    <h4>${escapeHtml(f.name)}</h4>
                    <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
                    <button class="share-btn" onclick="event.stopPropagation(); copyGpxLink('${f.id}')"><i class="fas fa-share-alt"></i></button>
                </div>`;
            });
            html += `</div></div>`;
        }
        gpxContainer.innerHTML = html;
    } else {
        gpxContainer.innerHTML = '<p class="text-muted">Нет поездок</p>';
    }

    const wallPosts = wallRes.data || [];
    document.getElementById('myWallPosts').innerHTML = wallPosts.length ? wallPosts.map(p => `
        <div class="wall-post glass-panel">
            <div class="wall-post-header">
                ${p.user_avatar ? `<img src="${p.user_avatar}">` : '<i class="fas fa-user"></i>'}
                <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                <span class="wall-post-time">${new Date(p.created_at).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.content)}</p>
            <div class="wall-post-footer">
                <button class="reaction-btn ${p.liked ? 'liked' : ''}" data-id="${p.id}" onclick="toggleWallReaction('${p.id}', this)">
                    <i class="fas fa-heart"></i> <span>${p.likes || 0}</span>
                </button>
            </div>
        </div>
    `).join('') : '<p class="text-muted">Записей пока нет</p>';

    document.getElementById('postMyWallBtn').onclick = async () => {
        const msg = document.getElementById('myWallMessage').value.trim();
        if (!msg) return;
        await _supabase.from('profile_wall').insert([{
            user_login: currentUser.login,
            user_name: currentUser.name || currentUser.login,
            user_avatar: currentUser.avatar || '',
            profile_login: login,
            content: msg,
            likes: 0
        }]);
        document.getElementById('myWallMessage').value = '';
        showToast('Запись добавлена');
        loadMyProfile();
    };
}

function copyGpxLink(fileId) {
    const url = `${window.location.origin}/gpx?id=${fileId}`;
    navigator.clipboard.writeText(url).then(() => showToast('🔗 Ссылка на маршрут скопирована'));
}

async function viewGpxRoute(fileId) {
    const { data } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (!data?.content) return showToast('Не удалось загрузить маршрут');
    navigateTo(`/gpx?id=${fileId}`);
}

async function toggleWallReaction(postId, btn) {
    const { data } = await _supabase.from('profile_wall').select('likes').eq('id', postId).maybeSingle();
    const newLikes = (data?.likes || 0) + 1;
    await _supabase.from('profile_wall').update({ likes: newLikes }).eq('id', postId);
    btn.querySelector('span').textContent = newLikes;
    btn.classList.add('liked');
    showToast('❤️ Спасибо за реакцию!');
}
