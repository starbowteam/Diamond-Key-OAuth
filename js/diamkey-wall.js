async function loadWall() {
    const { data: posts } = await _supabase.from('wall_posts').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('wallPosts');
    container.innerHTML = posts.map(p => `
        <div class="glass-panel" style="margin-bottom: 12px; padding: 16px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <img src="${p.avatar || ''}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user-circle\\' style=\\'font-size:32px; color:var(--text-muted)\\'></i>'">
                <strong>${escapeHtml(p.user_login)}</strong>
                <span class="text-muted" style="margin-left:auto;">${new Date(p.created_at).toLocaleString()}</span>
            </div>
            <p>${escapeHtml(p.content)}</p>
            ${p.image_url ? `<img src="${p.image_url}" style="max-width:100%; border-radius:12px; margin-top:8px;">` : ''}
        </div>
    `).join('');
}

document.getElementById('postWallBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('wallText').value.trim();
    const file = document.getElementById('wallImage').files[0];
    if (!text && !file) return;
    let imageUrl = null;
    if (file) {
        const reader = new FileReader();
        imageUrl = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }
    await _supabase.from('wall_posts').insert([{ user_login: currentUser.login, content: text, image_url: imageUrl }]);
    document.getElementById('wallText').value = '';
    document.getElementById('wallImage').value = '';
    loadWall();
});

async function renderProfile() {
    const info = document.getElementById('profileInfo');
    info.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
            <img src="${currentUser.avatar || ''}" style="width:64px; height:64px; border-radius:50%; object-fit:cover;" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user-circle\\' style=\\'font-size:64px; color:var(--text-muted)\\'></i>'">
            <div><strong>${escapeHtml(currentUser.name || currentUser.login)}</strong><br><span class="text-muted">@${currentUser.login}</span></div>
        </div>
        <p class="text-muted">${currentUser.description || 'Нет описания'}</p>
    `;

    // Статистика
    const { data: chatsData } = await _supabase.from('diamond_chats').select('id, messages').eq('user_login', currentUser.login);
    const totalChats = chatsData ? chatsData.length : 0;
    const totalMessages = chatsData ? chatsData.reduce((sum, c) => sum + (c.messages ? c.messages.length : 0), 0) : 0;
    document.getElementById('profileStats').innerHTML = `
        <div style="display:flex; gap: 20px; flex-wrap: wrap;">
            <div><strong>${totalChats}</strong> чатов в Diamond AI</div>
            <div><strong>${totalMessages}</strong> сообщений в Diamond AI</div>
        </div>
    `;

    // Посты пользователя
    const { data: userPosts } = await _supabase.from('wall_posts').select('*').eq('user_login', currentUser.login).order('created_at', { ascending: false });
    document.getElementById('profilePosts').innerHTML = '<h3 style="margin-top: 20px;">Мои записи</h3>' + userPosts.map(p => `
        <div class="glass-panel" style="margin-bottom: 8px; padding: 12px;">
            <p>${escapeHtml(p.content)}</p>
            ${p.image_url ? `<img src="${p.image_url}" style="max-width:100%; border-radius:8px; margin-top:6px;">` : ''}
        </div>
    `).join('');
}
