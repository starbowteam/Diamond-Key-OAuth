async function loadUsers() {
    const container = document.getElementById('usersList');
    const sortContainer = document.getElementById('sortContainer');
    if (!container) return;

    container.innerHTML = `<div class="loader-container"><div class="loader-icon"><i class="fas fa-user-astronaut"></i></div><div class="loader-progress"><div class="loader-bar" id="usersLoaderBar" style="width:0%"></div></div><div class="loader-status" id="usersLoaderStatus">Загрузка пользователей...</div></div>`;

    let width = 0;
    const interval = setInterval(() => {
        width += 15;
        if (width > 90) width = 90;
        document.getElementById('usersLoaderBar').style.width = width + '%';
        document.getElementById('usersLoaderStatus').textContent = `Загрузка ${width}%`;
    }, 250);

    const users = await getUsers();
    clearInterval(interval);
    document.getElementById('usersLoaderBar').style.width = '100%';
    document.getElementById('usersLoaderStatus').textContent = 'Готово!';
    await new Promise(r => setTimeout(r, 400));

    sortContainer.innerHTML = `<span class="text-muted">Сортировка:</span> <button class="sort-btn active" data-sort="login">По нику</button> <button class="sort-btn" data-sort="created_at">По дате</button>`;

    // Добавляем фильтр по бейджам
    const badges = await getAllBadges();
    let badgeFilterHTML = '<span class="text-muted" style="margin-left:auto;">Бейдж:</span> <select id="badgeFilterSelect" style="background:rgba(255,255,255,0.06); border:1px solid var(--border-glass); border-radius:12px; color:var(--text-primary); padding:8px 12px; font-size:14px; margin-left:8px;"><option value="">Все</option>';
    badges.forEach(b => {
        badgeFilterHTML += `<option value="${b.id}">${escapeHtml(b.name)}</option>`;
    });
    badgeFilterHTML += '</select>';
    sortContainer.innerHTML += badgeFilterHTML;

    let currentSort = 'login';
    let activeBadgeFilter = null;

    async function filterUsersByBadge(badgeId) {
        if (!badgeId) return users;
        const { data } = await _supabase.from('user_badges').select('user_login').eq('badge_id', badgeId);
        const logins = data ? data.map(d => d.user_login) : [];
        return users.filter(u => logins.includes(u.login));
    }

    async function render() {
        let filtered = await filterUsersByBadge(activeBadgeFilter);
        const sorted = [...filtered].sort((a, b) => currentSort === 'created_at' ? new Date(b.created_at) - new Date(a.created_at) : a.login.localeCompare(b.login));
        container.innerHTML = sorted.map(u => `
            <div class="user-card glass-panel" data-login="${u.login}" style="cursor:pointer;">
                ${u.avatar ? `<img src="${u.avatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:44px;color:var(--text-muted);width:44px;height:44px;display:flex;align-items:center;justify-content:center;"></i>'}
                <div><h4>${escapeHtml(u.name || u.login)}</h4><span>@${u.login}</span></div>
            </div>
        `).join('');

        container.querySelectorAll('.user-card').forEach(card => {
            card.addEventListener('click', () => {
                const login = card.dataset.login;
                navigateTo('/users/' + login);
            });
        });
    }

    sortContainer.querySelectorAll('.sort-btn').forEach(btn => btn.addEventListener('click', () => {
        sortContainer.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSort = btn.dataset.sort;
        render();
    }));

    document.getElementById('badgeFilterSelect').addEventListener('change', async (e) => {
        activeBadgeFilter = e.target.value || null;
        render();
    });

    render();

    document.getElementById('userSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        container.querySelectorAll('.user-card').forEach(c => c.style.display = c.textContent.toLowerCase().includes(term) ? '' : 'none');
    });
}
