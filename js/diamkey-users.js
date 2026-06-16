async function loadUsers() {
    const container = document.getElementById('usersList');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const users = await getUsers();

    // Элемент сортировки
    const sortContainer = document.createElement('div');
    sortContainer.style.cssText = 'display:flex; gap:12px; margin-bottom:16px; align-items:center;';
    sortContainer.innerHTML = `
        <span class="text-muted">Сортировка:</span>
        <button class="btn sort-btn active" data-sort="login">По нику</button>
        <button class="btn sort-btn" data-sort="created_at">По дате</button>
    `;
    container.parentElement.insertBefore(sortContainer, container);

    let currentSort = 'login';

    function render() {
        const sorted = [...users].sort((a, b) => {
            if (currentSort === 'created_at') return new Date(b.created_at) - new Date(a.created_at);
            return a.login.localeCompare(b.login);
        });
        container.innerHTML = sorted.map(u => `
            <div class="user-card glass-panel" data-login="${u.login}"
                 onmouseenter="showUserTooltip(event, '${u.login}', '${escapeHtml(u.description || '')}', '${u.avatar || ''}')"
                 onmouseleave="hideUserTooltip()"
                 onclick="navigateTo('/users/${u.login}')">
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
                const login = card.dataset.login.toLowerCase();
                card.style.display = login.includes(term) ? '' : 'none';
            });
        });
    }
}

// Тултип профиля
function showUserTooltip(event, login, description, avatar) {
    const tooltip = document.getElementById('userTooltip') || document.createElement('div');
    tooltip.id = 'userTooltip';
    tooltip.className = 'user-tooltip';
    tooltip.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            ${avatar ? `<img src="${avatar}" style="width:32px;height:32px;border-radius:50%;">` : ''}
            <strong>${escapeHtml(login)}</strong>
        </div>
        <p style="margin-top:4px;font-size:12px;">${escapeHtml(description || 'Нет описания')}</p>
    `;
    document.body.appendChild(tooltip);
    tooltip.style.display = 'block';
    tooltip.style.left = event.clientX + 15 + 'px';
    tooltip.style.top = event.clientY + 15 + 'px';
}

function hideUserTooltip() {
    const tooltip = document.getElementById('userTooltip');
    if (tooltip) tooltip.style.display = 'none';
}
