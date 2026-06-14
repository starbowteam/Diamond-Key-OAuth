async function loadUsers() {
    const { data: users } = await _supabase.from('users').select('login, name, avatar').order('login');
    const container = document.getElementById('usersList');
    if (!container) return;
    function render(filter = '') {
        const filtered = users.filter(u => u.login.toLowerCase().includes(filter.toLowerCase()) || (u.name && u.name.toLowerCase().includes(filter.toLowerCase())));
        container.innerHTML = filtered.map(u => `
            <div class="user-card glass-panel" onclick="viewProfile('${u.login}')">
                ${u.avatar ? `<img src="${u.avatar}" onerror="this.outerHTML='<i class=\\'fas fa-user\\' style=\\'font-size:44px;color:var(--text-muted)\\'></i>'">` : '<i class="fas fa-user" style="font-size:44px;color:var(--text-muted);"></i>'}
                <div>
                    <h4>${escapeHtml(u.name || u.login)}</h4>
                    <span>@${u.login}</span>
                </div>
            </div>
        `).join('');
    }
    render();
    document.getElementById('userSearch').addEventListener('input', (e) => render(e.target.value));
}