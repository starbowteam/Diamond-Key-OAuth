async function loadUsers() {
    const container = document.getElementById('usersList');
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    if (cache.users) { renderUserList(cache.users); return; }
    const { data: users } = await _supabase.from('users').select('login, name, avatar').order('login');
    cache.users = users || [];
    renderUserList(cache.users);
}

function renderUserList(users) {
    const container = document.getElementById('usersList');
    const filter = document.getElementById('userSearch')?.value || '';
    const filtered = users.filter(u => u.login.toLowerCase().includes(filter.toLowerCase()) || (u.name && u.name.toLowerCase().includes(filter.toLowerCase())));
    container.innerHTML = filtered.map(u => `
        <div class="user-card glass-panel" onclick="viewProfile('${u.login}')">
            ${u.avatar ? `<img src="${u.avatar}" onerror="this.outerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:44px;color:var(--text-muted);width:44px;height:44px;display:flex;align-items:center;justify-content:center\\'></i>'">` : '<i class="fas fa-user" style="font-size:44px;color:var(--text-muted);width:44px;height:44px;display:flex;align-items:center;justify-content:center"></i>'}
            <div>
                <h4>${escapeHtml(u.name || u.login)}</h4>
                <span>@${u.login}</span>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (cache.users) renderUserList(cache.users);
        });
    }
});
