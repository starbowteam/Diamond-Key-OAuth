// diamkey-users.js — список пользователей с фильтрами друзей и заявок

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

    // Фильтры: Все, Друзья, Заявки
    sortContainer.innerHTML = `
        <span class="text-muted">Сортировка:</span>
        <button class="sort-btn active" data-filter="all">Все</button>
        <button class="sort-btn" data-filter="friends"><i class="fas fa-user-friends"></i> Друзья</button>
        <button class="sort-btn" data-filter="requests"><i class="fas fa-user-clock"></i> Заявки</button>
        <button class="sort-btn" id="badgeFilterBtn" style="margin-left:auto;">
            <i class="fas fa-filter"></i> Фильтр по бейджу
        </button>
    `;

    let currentFilter = 'all';
    let activeBadgeFilter = null;
    const allBadges = await getAllBadges();

    async function filterUsersByBadge(badgeId) {
        if (!badgeId) return users;
        const { data } = await _supabase.from('user_badges').select('user_login').eq('badge_id', badgeId);
        const logins = data ? data.map(d => d.user_login) : [];
        return users.filter(u => logins.includes(u.login));
    }

    function updateFilterButton() {
        const btn = document.getElementById('badgeFilterBtn');
        if (activeBadgeFilter) {
            btn.innerHTML = `<i class="fas fa-filter"></i> ${escapeHtml(activeBadgeFilter.name)}`;
            btn.classList.add('badge-active');
        } else {
            btn.innerHTML = `<i class="fas fa-filter"></i> Фильтр по бейджу`;
            btn.classList.remove('badge-active');
        }
    }

    async function render() {
        // Применяем фильтр по бейджам
        let filtered = await filterUsersByBadge(activeBadgeFilter?.id);

        // Применяем фильтр друзей/заявок
        if (currentFilter === 'friends') {
            const friendLogins = getFriendsList();
            filtered = filtered.filter(u => friendLogins.includes(u.login));
        } else if (currentFilter === 'requests') {
            const incoming = getIncomingRequests();
            filtered = filtered.filter(u => incoming.includes(u.login));
        }

        // Сортировка
        const sorted = [...filtered].sort((a, b) => a.login.localeCompare(b.login));

        if (sorted.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);"><i class="fas fa-users" style="font-size:32px; margin-bottom:12px;"></i><p>Никого нет</p></div>';
            return;
        }

        container.innerHTML = sorted.map(u => {
            const status = getFriendStatus(u.login);
            let actionHTML = '';

            if (status === 'accepted') {
                actionHTML = `
                    <div class="user-card-actions">
                        <button class="btn-friend-card accepted" onclick="event.stopPropagation(); removeFriend('${u.login}'); loadUsers();"><i class="fas fa-check"></i> Друзья</button>
                        <button class="btn-friend-card remove" onclick="event.stopPropagation(); removeFriend('${u.login}'); loadUsers();"><i class="fas fa-user-times"></i></button>
                    </div>
                `;
            } else if (status === 'pending_sent') {
                actionHTML = `
                    <div class="user-card-actions">
                        <button class="btn-friend-card pending" onclick="event.stopPropagation(); removeFriend('${u.login}'); loadUsers();"><i class="fas fa-clock"></i> Ожидание</button>
                    </div>
                `;
            } else if (status === 'pending_received') {
                actionHTML = `
                    <div class="user-card-actions">
                        <button class="btn-friend-card add" onclick="event.stopPropagation(); acceptFriendRequest('${u.login}'); loadUsers(); updateFriendNotificationDot();"><i class="fas fa-user-check"></i> Принять</button>
                        <button class="btn-friend-card remove" onclick="event.stopPropagation(); rejectFriendRequest('${u.login}'); loadUsers(); updateFriendNotificationDot();"><i class="fas fa-times"></i> Отклонить</button>
                    </div>
                `;
            } else {
                actionHTML = `
                    <div class="user-card-actions">
                        <button class="btn-friend-card add" onclick="event.stopPropagation(); sendFriendRequest('${u.login}'); loadUsers();"><i class="fas fa-user-plus"></i> Добавить в друзья</button>
                    </div>
                `;
            }

            return `
                <div class="user-card glass-panel" data-login="${u.login}" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:18px;" onclick="navigateTo('/users/${u.login}')">
                        ${avatarHTML(u.avatar, 44)}
                        <div>
                            <h4>${escapeHtml(u.name || u.login)}</h4>
                            <span>@${u.login}</span>
                        </div>
                    </div>
                    ${actionHTML}
                </div>
            `;
        }).join('');

        updateFilterButton();
    }

    sortContainer.querySelectorAll('.sort-btn[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            sortContainer.querySelectorAll('.sort-btn[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            render();
        });
    });

    document.getElementById('badgeFilterBtn').addEventListener('click', () => {
        openBadgeFilterModal(allBadges, (badge) => {
            activeBadgeFilter = badge;
            render();
        });
    });

    document.getElementById('userSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        container.querySelectorAll('.user-card').forEach(c =>
            c.style.display = c.textContent.toLowerCase().includes(term) ? '' : 'none'
        );
    });

    await render();
}

function openBadgeFilterModal(badges, onSelect) {
    const existing = document.querySelector('.badge-filter-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal badge-filter-modal';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });

    const content = document.createElement('div');
    content.className = 'modal-content glass-panel';
    content.innerHTML = `
        <h3><i class="fas fa-filter"></i> Фильтр по бейджу</h3>
        <div class="badge-filter-grid" id="badgeFilterGrid"></div>
        <button class="btn reset-filter-btn" id="resetBadgeFilterBtn"><i class="fas fa-times"></i> Сбросить фильтр</button>
        <button class="btn btn-secondary" style="margin-top:8px;" id="closeBadgeFilterBtn">Закрыть</button>
    `;
    modal.appendChild(content);
    document.body.appendChild(modal);

    const grid = document.getElementById('badgeFilterGrid');
    badges.forEach(badge => {
        const item = document.createElement('div');
        item.className = 'badge-filter-item';
        item.innerHTML = `
            <div class="badge-icon"><i class="fas ${badge.icon}" style="background:${badge.gradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></i></div>
            <span>${escapeHtml(badge.name)}</span>
        `;
        item.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
            onSelect({ id: badge.id, name: badge.name });
        });
        grid.appendChild(item);
    });

    document.getElementById('resetBadgeFilterBtn').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
        onSelect(null);
    });
    document.getElementById('closeBadgeFilterBtn').addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });
}
