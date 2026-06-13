// ==================== DIAMKEY PROFILE – стена и профиль ====================
async function renderWall() {
    const { data: posts } = await _supabase.from('wall_posts').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('wallPosts');
    container.innerHTML = posts.map(p => `
        <div class="glass-panel" style="margin-bottom: 12px; padding: 16px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                <img src="${p.avatar || 'assets/default-avatar.png'}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'">
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
    renderWall();
});

async function renderProfile() {
    const info = document.getElementById('profileInfo');
    info.innerHTML = `
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
            <img src="${currentUser.avatar || 'assets/default-avatar.png'}" style="width:64px; height:64px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'">
            <div><strong>${escapeHtml(currentUser.name || currentUser.login)}</strong><br><span class="text-muted">@${currentUser.login}</span></div>
        </div>
        <p class="text-muted">${currentUser.description || 'Нет описания'}</p>
    `;
    // Здесь можно добавить статистику Diamond AI и GPX
}