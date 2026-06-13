async function loadAnnouncement() {
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    const body = document.getElementById('announcementBody');
    if (data && data.length) {
        const { data: creator } = await _supabase.from('users').select('avatar').eq('email', 'abugay12@mail.ru').maybeSingle();
        body.innerHTML = `
            <img src="${creator?.avatar || ''}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
            <div class="announcement-content">
                <p>${escapeHtml(data[0].content)}</p>
                <div class="announcement-footer">
                    <span>viktorshopa · Создатель Diamond EcoSystem</span>
                    <span>${new Date(data[0].created_at).toLocaleString()}</span>
                </div>
            </div>
        `;
    }
}

// Форум
async function loadForum() {
    const { data: posts } = await _supabase.from('forum').select('*').order('time', { ascending: false });
    const container = document.getElementById('forumMessages');
    container.innerHTML = posts.map(p => `
        <div class="glass-panel" style="padding:14px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <img src="${p.avatar || ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="viewProfile('${p.login}')">
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
            <img src="${temp.avatar || ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">
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

function viewProfile(login) {
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelector('.sidebar-icon[data-page="profile"]').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-profile').classList.add('active');
    currentViewingProfile = login;
    loadProfilePage(login);
}

// Профиль
let currentViewingProfile = null;
async function loadProfilePage(login = null) {
    const targetLogin = login || (currentUser ? currentUser.login : null);
    if (!targetLogin) return;
    const { data: profile } = await _supabase.from('users').select('name, avatar, description, created_at').eq('login', targetLogin).maybeSingle();
    if (!profile) return;
    const isOwner = currentUser && currentUser.login === targetLogin;

    document.getElementById('profileName').textContent = profile.name || targetLogin;
    document.getElementById('profileAvatar').src = profile.avatar || '';
    document.getElementById('profileDescription').textContent = profile.description || 'Нет описания';
    document.getElementById('profileRegDate').textContent = profile.created_at ? 'Создан: ' + new Date(profile.created_at).toLocaleDateString() : '';

    // Редактирование только владельцем
    if (isOwner) {
        document.getElementById('profileAvatarWrapper').style.cursor = 'pointer';
        document.getElementById('profileAvatarWrapper').onclick = () => {
            const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = async (ev) => { await updateProfile({ avatar: ev.target.result }); document.getElementById('profileAvatar').src = ev.target.result; };
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
        document.getElementById('profileAvatarWrapper').style.cursor = 'default';
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
    const { data: gpxFiles } = await _supabase.from('gpx_files').select('id,name,created_at').eq('user_login', targetLogin).order('created_at', { ascending: false });
    document.getElementById('profileGpxFiles').innerHTML = gpxFiles?.length ? `<div class="gpx-cards">${gpxFiles.map(f => `
        <div class="gpx-card glass-panel">
            <i class="fas fa-map-marker-alt"></i>
            <h4>${escapeHtml(f.name)}</h4>
            <div class="gpx-card-date">${new Date(f.created_at).toLocaleDateString()}</div>
        </div>
    `).join('')}</div>` : '<p class="text-muted">Нет поездок</p>';

    // Стена
    const { data: wall } = await _supabase.from('profile_wall').select('*').eq('profile_login', targetLogin).order('created_at', { ascending: false });
    document.getElementById('profileWall').innerHTML = wall?.map(p => `
        <div class="glass-panel" style="padding:12px;margin-bottom:8px;">
            <strong>${escapeHtml(p.user_login)}</strong>
            <p>${escapeHtml(p.content)}</p>
        </div>
    `).join('') || '<p class="text-muted">Записей пока нет</p>';

    document.getElementById('postWallBtn').onclick = async () => {
        const msg = document.getElementById('wallMessage').value.trim();
        if (!msg) return;
        await _supabase.from('profile_wall').insert([{ user_login: currentUser.login, profile_login: targetLogin, content: msg }]);
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
