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

    sortContainer.innerHTML = `
        <span class="text-muted">Сортировка:</span>
        <button class="sort-btn active" data-sort="login">По нику</button>
        <button class="sort-btn" data-sort="created_at">По дате</button>
        <button class="sort-btn" id="badgeFilterBtn" style="margin-left:auto;">
            <i class="fas fa-filter"></i> Фильтр по бейджу
        </button>
    `;

    let currentSort = 'login';
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
        let filtered = await filterUsersByBadge(activeBadgeFilter?.id);
        const sorted = [...filtered].sort((a, b) =>
            currentSort === 'created_at'
                ? new Date(b.created_at) - new Date(a.created_at)
                : a.login.localeCompare(b.login)
        );
        container.innerHTML = sorted.map(u => `
            <div class="user-card glass-panel" data-login="${u.login}" style="cursor:pointer;">
                ${avatarHTML(u.avatar, 44)}
                <div><h4>${escapeHtml(u.name || u.login)}</h4><span>@${u.login}</span></div>
            </div>
        `).join('');

        container.querySelectorAll('.user-card').forEach(card => {
            card.addEventListener('click', () => {
                navigateTo('/users/' + card.dataset.login);
            });
        });
        updateFilterButton();
    }

    sortContainer.querySelectorAll('.sort-btn[data-sort]').forEach(btn => {
        btn.addEventListener('click', () => {
            sortContainer.querySelectorAll('.sort-btn[data-sort]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
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

function avatarHTML(src, size = 44) {
    const fallbackHTML = `<i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"></i>`;
    if (!src || !src.trim()) return fallbackHTML;

    return `
    <span style="display:inline-block;width:${size}px;height:${size}px;flex-shrink:0;">
        <img src="${escapeHtml(src)}"
             style="width:100%;height:100%;border-radius:50%;object-fit:cover;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <span style="display:none;width:100%;height:100%;">${fallbackHTML}</span>
    </span>`;
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
