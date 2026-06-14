// Объявление
async function loadAnnouncement() {
    const body = document.getElementById('announcementBody');
    body.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    if (data && data.length) {
        const { data: creator } = await _supabase.from('users').select('avatar').eq('email', 'abugay12@mail.ru').maybeSingle();
        body.innerHTML = `
            <img src="${creator?.avatar || ''}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.onerror=null; this.innerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:40px;color:var(--text-muted)\\'></i>'">
            <div class="announcement-content">
                <p>${escapeHtml(data[0].content)}</p>
                <div class="announcement-footer">
                    <span>viktorshopa · Создатель Diamond EcoSystem</span>
                    <span>${new Date(data[0].created_at).toLocaleString()}</span>
                </div>
            </div>
        `;
    } else {
        body.innerHTML = '<p class="text-muted">Нет новых объявлений</p>';
    }
}

// Форум
async function loadForum() {
    const container = document.getElementById('forumMessages');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data: posts } = await _supabase.from('forum').select('*').order('time', { ascending: false });
    container.innerHTML = posts.map(p => `
        <div class="glass-panel" style="padding:14px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                ${p.avatar ? `<img src="${p.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="viewProfile('${p.login}')" onerror="this.outerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:28px;color:var(--text-muted);cursor:pointer\\' onclick=\\'viewProfile(\\'${p.login}\\')\\'>'">` : `<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);cursor:pointer" onclick="viewProfile('${p.login}')"></i>`}
                <strong style="cursor:pointer" onclick="viewProfile('${p.login}')">${escapeHtml(p.name || p.login)}</strong>
                <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">${new Date(p.time).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.message)}</p>
        </div>
    `).join('');
    container.scrollTop = 0;
}

document.getElementById('sendForumBtn').addEventListener('click', async () => {
    const msg = document.getElementById('forumMessage').value.trim();
    if (!msg) return;
    const temp = { login: currentUser.login, name: currentUser.name, avatar: currentUser.avatar, message: msg, time: new Date().toISOString() };
    const container = document.getElementById('forumMessages');
    const tempEl = document.createElement('div');
    tempEl.className = 'glass-panel';
    tempEl.style.padding = '14px';
    tempEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            ${temp.avatar ? `<img src="${temp.avatar}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:28px;color:var(--text-muted);"></i>'}
            <strong>${escapeHtml(temp.name || temp.login)}</strong>
            <span class="text-muted" style="margin-left:auto;font-size:0.8rem;">только что</span>
        </div>
        <p>${escapeHtml(temp.message)}</p>
    `;
    container.insertBefore(tempEl, container.firstChild);
    document.getElementById('forumMessage').value = '';
    await _supabase.from('forum').insert([{ email: currentUser.email || '', login: currentUser.login, name: currentUser.name || currentUser.login, avatar: currentUser.avatar || '', message: msg, time: temp.time }]);
    loadForum();
});

// Переход на чужой профиль
function viewProfile(login) {
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelector('.sidebar-icon[data-page="profile"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const profilePage = document.getElementById('page-profile');
    profilePage.classList.add('active');
    profilePage.style.opacity = '1';
    currentViewingProfile = login;
    loadProfilePage(login);
}

// Вернуться к списку пользователей
function goBackToUsers() {
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelector('.sidebar-icon[data-page="users"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const usersPage = document.getElementById('page-users');
    usersPage.classList.add('active');
    usersPage.style.opacity = '1';
    currentViewingProfile = null;
}

// Профиль
let currentViewingProfile = null;
async function loadProfilePage(login = null) {
    const targetLogin = login || (currentUser ? currentUser.login : null);
    if (!targetLogin) return;

    // Показываем загрузку
    document.getElementById('profileName').textContent = 'Загрузка...';
    document.getElementById('profileAvatar').style.display = 'none';
    document.getElementById('profileDescription').textContent = '';
    document.getElementById('profileRegDate').textContent = '';
    document.getElementById('profileStats').innerHTML = '';
    document.getElementById('profileGpxFiles').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    document.getElementById('profileWall').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';

    const { data: profile } = await _supabase.from('users').select('name, avatar, description, created_at').eq('login', targetLogin).maybeSingle();
    if (!profile) return;

    const isOwner = currentUser && currentUser.login === targetLogin;

    // Кнопка «Назад» видна только при просмотре чужого профиля
    const backBtn = document.getElementById('backToUsersBtn');
    if (backBtn) backBtn.style.display = isOwner ? 'none' : 'inline-flex';

    document.getElementById('profileName').textContent = profile.name || targetLogin;
    const avatarEl = document.getElementById('profileAvatar');
    if (profile.avatar) {
        avatarEl.src = profile.avatar;
        avatarEl.style.display = '';
        avatarEl.onerror = function() { this.style.display = 'none'; this.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:40px;color:var(--text-muted);"></i>'; };
    } else {
        avatarEl.style.display = 'none';
        avatarEl.parentElement.innerHTML = '<i class="fas fa-user" style="font-size:40px;color:var(--text-muted);"></i>';
    }
    document.getElementById('profileDescription').textContent = profile.description || (isOwner ? 'Нажмите, чтобы добавить описание' : 'Нет описания');
    document.getElementById('profileRegDate').textContent = profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : '';

    if (isOwner) {
        document.getElementById('profileAvatarWrapper').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => { await updateProfile({ avatar: ev.target.result }); loadProfilePage(targetLogin); };
                reader.readAsDataURL(file);
            };
            input.click();
        };
        document.getElementById('profileDescription').classList.add('editable-text');
        document.getElementById('profileDescription').onclick = () => {
            document.getElementById('editDescriptionInput').value = profile.description || '';
            const modal = document.getElementById('editDescriptionModal'); modal.style.display = 'flex'; modal.classList.add('active');
        };
    } else {
        document.getElementById('profileAvatarWrapper').onclick = null;
        document.getElementById('profileDescription').classList.remove('editable-text');
        document.getElementById('profileDescription').onclick = null;
    }

    // Статистика
    const { data: chats } = await _supabase.from('diamond_chats').select('id,messages').eq('user_login', targetLogin);
    const totalChats = chats?.length || 0;
    const totalMessages = chats?.reduce((s,c) => s + (c.messages?.length || 0), 0) || 0;
    const { count: forumCount } = await _supabase.from('forum').select('*', { count: 'exact', head: true }).eq('login', targetLogin);
    const { count: gpxCount } = await _supabase.from('gpx_files').select('*', { count: 'exact', head: true }).eq('user_login', targetLogin);
    document.getElementById('profileStats').innerHTML = `
        <div><i class="fas fa-comments"></i> ${forumCount || 0} сообщений</div>
        <div><i class="fas fa-robot"></i> ${totalChats} чатов / ${totalMessages} сообщ.</div>
        <div><i class="fas fa-map-marker-alt"></i> ${gpxCount || 0} поездок</div>
    `;

    // GPX-карточки
    const { data: gpxFiles } = await _supabase.from('gpx_files').select('*').eq('user_login', targetLogin).order('created_at', { ascending: false });
    document.getElementById('profileGpxFiles').innerHTML = gpxFiles?.length ? `<div class="gpx-cards">${gpxFiles.map(f => `
        <div class="gpx-card glass-panel" onclick="viewGpxRoute('${f.id}')">
            <i class="fas fa-map-marker-alt"></i>
            <h4>${escapeHtml(f.name)}</h4>
            <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
        </div>
    `).join('')}</div>` : '<p class="text-muted">Нет поездок</p>';

    // Стена
    const { data: wall } = await _supabase.from('profile_wall').select('*').eq('profile_login', targetLogin).order('created_at', { ascending: false });
    document.getElementById('profileWall').innerHTML = wall?.length ? wall.map(p => `
        <div class="glass-panel" style="padding:12px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                ${p.user_avatar ? `<img src="${p.user_avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;" onerror="this.outerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:24px;color:var(--text-muted)\\'></i>'">` : '<i class="fas fa-user" style="font-size:24px;color:var(--text-muted);"></i>'}
                <strong>${escapeHtml(p.user_name || p.user_login)}</strong>
                <span class="text-muted" style="margin-left:auto;font-size:0.75rem;">${new Date(p.created_at).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.content)}</p>
        </div>
    `).join('') : '<p class="text-muted">Записей пока нет</p>';

    document.getElementById('postWallBtn').onclick = async () => {
        const msg = document.getElementById('wallMessage').value.trim();
        if (!msg || !currentUser) return;
        await _supabase.from('profile_wall').insert([{
            user_login: currentUser.login,
            user_name: currentUser.name || currentUser.login,
            user_avatar: currentUser.avatar || '',
            profile_login: targetLogin,
            content: msg
        }]);
        document.getElementById('wallMessage').value = '';
        loadProfilePage(targetLogin);
    };

    document.getElementById('saveDescriptionBtn').onclick = async () => {
        const desc = document.getElementById('editDescriptionInput').value.trim();
        await updateProfile({ description: desc });
        document.getElementById('profileDescription').textContent = desc || 'Нет описания';
        closeModal('editDescriptionModal');
    };
}

async function viewGpxRoute(fileId) {
    const { data } = await _supabase.from('gpx_files').select('content').eq('id', fileId).maybeSingle();
    if (!data || !data.content) return showToast('Не удалось загрузить маршрут');
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelector('.sidebar-icon[data-page="gpx"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const gpxPage = document.getElementById('page-gpx');
    gpxPage.classList.add('active');
    gpxPage.style.opacity = '1';
    initGPX();
    try {
        const parsed = parseGPX(data.content);
        displayGPX(parsed);
        showAIReview(parsed);
        showToast('Маршрут загружен');
    } catch (err) { showToast('Ошибка при отображении маршрута'); }
}