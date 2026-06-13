// Объявления
async function loadAnnouncement() {
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    const el = document.getElementById('announcementText');
    if (data && data.length) {
        el.textContent = data[0].content;
    } else {
        el.textContent = 'Нет объявлений';
    }
}

// Форум
async function loadForum() {
    const { data: posts } = await _supabase.from('forum').select('*').order('time', { ascending: false });
    const container = document.getElementById('forumPosts');
    container.innerHTML = posts.map(p => `
        <div class="glass-panel" style="margin-bottom:12px; padding:16px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <img src="${p.avatar || ''}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'">
                <strong>${escapeHtml(p.name || p.login)}</strong>
                <span class="text-muted" style="margin-left:auto;">${new Date(p.time).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.message)}</p>
            ${p.image_url ? `<img src="${p.image_url}" style="max-width:100%; border-radius:12px; margin-top:8px;">` : ''}
        </div>
    `).join('');
}

document.getElementById('sendForumBtn')?.addEventListener('click', async () => {
    const msg = document.getElementById('forumMessage').value.trim();
    const file = document.getElementById('forumImage').files[0];
    if (!msg && !file) return;
    let imageUrl = null;
    if (file) {
        const reader = new FileReader();
        imageUrl = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }
    await _supabase.from('forum').insert([{
        email: currentUser.email || '',
        login: currentUser.login,
        name: currentUser.name || currentUser.login,
        avatar: currentUser.avatar || '',
        message: msg,
        image_url: imageUrl,
        time: new Date().toISOString()
    }]);
    document.getElementById('forumMessage').value = '';
    document.getElementById('forumImage').value = '';
    loadForum();
});

// Профиль
async function renderProfile() {
    const info = document.getElementById('profileInfo');
    info.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
            <img src="${currentUser.avatar || ''}" style="width:64px; height:64px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'">
            <div><strong>${escapeHtml(currentUser.name || currentUser.login)}</strong><br><span class="text-muted">@${currentUser.login}</span></div>
        </div>
    `;
    const { data: stats } = await _supabase.from('diamond_chats').select('id, messages').eq('user_login', currentUser.login);
    const chats = stats ? stats.length : 0;
    const messages = stats ? stats.reduce((s,c) => s + (c.messages ? c.messages.length : 0), 0) : 0;
    document.getElementById('profileStats').innerHTML = `<p>Чатов в Diamond AI: <strong>${chats}</strong>, сообщений: <strong>${messages}</strong></p>`;
    const { data: userPosts } = await _supabase.from('forum').select('*').eq('login', currentUser.login).order('time', { ascending: false });
    document.getElementById('profilePosts').innerHTML = userPosts.map(p => `
        <div class="glass-panel" style="margin-bottom:8px; padding:12px;">
            <p>${escapeHtml(p.message)}</p>
            ${p.image_url ? `<img src="${p.image_url}" style="max-width:100%; border-radius:8px; margin-top:6px;">` : ''}
        </div>
    `).join('');
}
