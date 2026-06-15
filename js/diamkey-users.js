async function loadUsers() {
    const container = document.getElementById('usersList');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const { data: users } = await _supabase.from('users').select('login, name, avatar').order('login');
    if (!users) return;
    function render(filter = '') {
        const filtered = users.filter(u => u.login.toLowerCase().includes(filter.toLowerCase()) || (u.name && u.name.toLowerCase().includes(filter.toLowerCase())));
        container.innerHTML = filtered.map(u => `
            <div class="user-card glass-panel" onclick="navigateTo('/users/${u.login}')">
                ${u.avatar ? `<img src="${u.avatar}" onerror="this.outerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:44px;color:var(--text-muted);width:44px;height:44px;display:flex;align-items:center;justify-content:center\\'></i>'">` : '<i class="fas fa-user" style="font-size:44px;color:var(--text-muted);width:44px;height:44px;display:flex;align-items:center;justify-content:center"></i>'}
                <div>
                    <h4>${escapeHtml(u.name || u.login)}</h4>
                    <span>@${u.login}</span>
                </div>
            </div>
        `).join('');
    }
    render();
    const searchInput = document.getElementById('userSearch');
    if (searchInput) searchInput.addEventListener('input', (e) => render(e.target.value));
}
