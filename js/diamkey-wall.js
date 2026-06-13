// Объявление
async function loadAnnouncement() {
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    const { data: creator } = await _supabase.from('users').select('avatar').eq('email', 'abugay12@mail.ru').maybeSingle();
    const avatar = creator?.avatar || '';
    document.getElementById('announcementAvatar').src = avatar;
    const el = document.getElementById('announcementText');
    const dateEl = document.getElementById('announcementDate');
    if (data && data.length) {
        el.textContent = data[0].content;
        dateEl.textContent = new Date(data[0].created_at).toLocaleString();
    }
}

// Форум (мгновенная загрузка)
async function loadForum() {
    const { data: posts } = await _supabase.from('forum').select('*').order('time', { ascending: false });
    const container = document.getElementById('forumMessages');
    container.innerHTML = posts.map(p => `
        <div class="glass-panel" style="padding:14px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <img src="${p.avatar || ''}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none'">
                <strong>${escapeHtml(p.name || p.login)}</strong>
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
    await _supabase.from('forum').insert([{
        email: currentUser.email || '',
        login: currentUser.login,
        name: currentUser.name || currentUser.login,
        avatar: currentUser.avatar || '',
        message: msg,
        time: new Date().toISOString()
    }]);
    document.getElementById('forumMessage').value = '';
    loadForum();
});

// Профиль
async function loadProfilePage() {
    document.getElementById('profileName').textContent = currentUser.name || currentUser.login;
    document.getElementById('profileAvatar').src = currentUser.avatar || '';
    document.getElementById('profileDescription').textContent = currentUser.description || 'Нажмите, чтобы добавить описание';

    // Аватарка
    document.getElementById('profileAvatarWrapper').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                const avatar = ev.target.result;
                await updateProfile({ avatar });
                document.getElementById('profileAvatar').src = avatar;
                showToast('Аватар обновлён');
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    // Описание
    document.getElementById('profileDescription').onclick = () => {
        document.getElementById('editDescriptionInput').value = currentUser.description || '';
        document.getElementById('editDescriptionModal').style.display = 'flex';
    };
    document.getElementById('saveDescriptionBtn').onclick = async () => {
        const desc = document.getElementById('editDescriptionInput').value.trim();
        await updateProfile({ description: desc });
        document.getElementById('profileDescription').textContent = desc || 'Нажмите, чтобы добавить описание';
        document.getElementById('editDescriptionModal').style.display = 'none';
        showToast('Описание обновлено');
    };

    // Статистика
    const { data: chats } = await _supabase.from('diamond_chats').select('id,messages').eq('user_login', currentUser.login);
    const totalChats = chats?.length || 0;
    const totalMessages = chats?.reduce((s,c) => s + (c.messages?.length || 0), 0) || 0;
    const { count: forumCount } = await _supabase.from('forum').select('*', { count: 'exact', head: true }).eq('login', currentUser.login);
    const { count: gpxCount } = await _supabase.from('gpx_files').select('*', { count: 'exact', head: true }).eq('user_login', currentUser.login);
    document.getElementById('profileStats').innerHTML = `
        <div class="stats-grid" style="display:flex; gap:20px; flex-wrap:wrap; margin:20px 0;">
            <div class="glass-panel" style="padding:12px; text-align:center;"><i class="fas fa-comments"></i><br>${forumCount || 0}<br><small>сообщений на форуме</small></div>
            <div class="glass-panel" style="padding:12px; text-align:center;"><i class="fas fa-robot"></i><br>${totalChats} чатов / ${totalMessages} сообщ.<br><small>в Diamond AI</small></div>
            <div class="glass-panel" style="padding:12px; text-align:center;"><i class="fas fa-map-marker-alt"></i><br>${gpxCount || 0}<br><small>GPX-прогулок</small></div>
        </div>
    `;

    // GPX-файлы
    const { data: gpxFiles } = await _supabase.from('gpx_files').select('id,name,created_at').eq('user_login', currentUser.login).order('created_at', { ascending: false });
    document.getElementById('profileGpxFiles').innerHTML = gpxFiles?.length ? gpxFiles.map(f => `
        <div class="glass-panel" style="padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
            <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(f.name)}</span>
            <span class="text-muted">${new Date(f.created_at).toLocaleDateString()}</span>
        </div>
    `).join('') : '<p class="text-muted">Нет сохранённых прогулок</p>';

    // Стена
    const { data: wall } = await _supabase.from('wall_posts').select('*').eq('profile_login', currentUser.login).order('created_at', { ascending: false });
    document.getElementById('profileWall').innerHTML = wall?.map(p => `
        <div class="glass-panel" style="padding:12px;margin-bottom:8px;">
            <strong>${escapeHtml(p.user_login)}</strong>
            <p>${escapeHtml(p.content)}</p>
        </div>
    `).join('') || '';

    document.getElementById('postWallBtn').onclick = async () => {
        const msg = document.getElementById('wallMessage').value.trim();
        if (!msg) return;
        await _supabase.from('wall_posts').insert([{
            user_login: currentUser.login,
            profile_login: currentUser.login,
            content: msg
        }]);
        document.getElementById('wallMessage').value = '';
        loadProfilePage();
    };
}
