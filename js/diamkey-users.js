async function loadUsers() {
    const container = document.getElementById('usersList');
    const sortContainer = document.getElementById('sortContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="loader-container">
            <div class="loader-icon"><i class="fas fa-user-astronaut"></i></div>
            <div class="loader-progress"><div class="loader-bar" id="usersLoaderBar" style="width:0%"></div></div>
            <div class="loader-status" id="usersLoaderStatus">Загрузка пользователей...</div>
        </div>
    `;

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
    `;

    let currentSort = 'login';
    function render() {
        const sorted = [...users].sort((a, b) => {
            if (currentSort === 'created_at') return new Date(b.created_at) - new Date(a.created_at);
            return a.login.localeCompare(b.login);
        });
        container.innerHTML = sorted.map(u => `
            <div class="user-card glass-panel" onmouseenter="showUserTooltip(event, '${u.login}', '${escapeHtml(u.description||'')}', '${u.avatar||''}')" onmouseleave="hideUserTooltip()" onclick="navigateTo('/users/${u.login}')">
                ${u.avatar ? `<img src="${u.avatar}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;">` : '<i class="fas fa-user" style="font-size:44px;color:var(--text-muted);width:44px;height:44px;display:flex;align-items:center;justify-content:center;"></i>'}
                <div>
                    <h4>${escapeHtml(u.name || u.login)}</h4>
                    <span>@${u.login}</span>
                </div>
            </div>
        `).join('');
    }

    sortContainer.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sortContainer.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            render();
        });
    });

    render();

    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            container.querySelectorAll('.user-card').forEach(card => {
                card.style.display = card.textContent.toLowerCase().includes(term) ? '' : 'none';
            });
        });
    }
}

function showUserTooltip(event, login, desc, avatar) {
    let tooltip = document.getElementById('userTooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'userTooltip';
        tooltip.className = 'user-tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = `<strong>${login}</strong><br><small>${desc||'Нет описания'}</small>`;
    tooltip.style.display = 'block';
    tooltip.style.left = event.clientX + 15 + 'px';
    tooltip.style.top = event.clientY + 15 + 'px';
}

function hideUserTooltip() {
    const tooltip = document.getElementById('userTooltip');
    if (tooltip) tooltip.style.display = 'none';
}
