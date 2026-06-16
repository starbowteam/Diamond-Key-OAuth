async function loadUsers() {
    const container = document.getElementById('usersList');
    if (!container) return;
    showPageLoader(container);
    const users = await getUsers();
    updateLoaderProgress(container, 30);
    let percent = 30;
    const interval = setInterval(() => {
        percent += 10;
        if (percent > 90) percent = 90;
        updateLoaderProgress(container, percent);
    }, 100);

    const sortContainer = document.createElement('div');
    sortContainer.style.cssText = 'display:flex; gap:12px; margin-bottom:16px; align-items:center;';
    sortContainer.innerHTML = `
        <span class="text-muted">Сортировка:</span>
        <button class="btn sort-btn active" data-sort="login">По нику</button>
        <button class="btn sort-btn" data-sort="created_at">По дате</button>
    `;
    container.innerHTML = '';
    container.parentElement.insertBefore(sortContainer, container);

    let currentSort = 'login';
    function render() {
        const sorted = [...users].sort((a,b) => {
            if (currentSort === 'created_at') return new Date(b.created_at) - new Date(a.created_at);
            return a.login.localeCompare(b.login);
        });
        container.innerHTML = sorted.map(u => `
            <div class="user-card glass-panel" data-login="${u.login}"
                 onmouseenter="showUserTooltip(event, '${u.login}', '${escapeHtml(u.description || '')}', '${u.avatar || '')}')"
                 onmouseleave="hideUserTooltip()"
                 onclick="navigateTo('/users/${u.login}')">
                ${u.avatar ? `<img src="${u.avatar}">` : '<i class="fas fa-user"></i>'}
                <div><h4>${escapeHtml(u.name || u.login)}</h4><span>@${u.login}</span></div>
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

    clearInterval(interval);
    updateLoaderProgress(container, 100);
    setTimeout(() => render(), 200);

    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            container.querySelectorAll('.user-card').forEach(card => {
                card.style.display = card.dataset.login.includes(term) ? '' : 'none';
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
    tooltip.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            ${avatar ? `<img src="${avatar}" style="width:32px;height:32px;border-radius:50%;">` : ''}
            <strong>${escapeHtml(login)}</strong>
        </div>
        <p style="margin-top:4px;font-size:12px;">${escapeHtml(desc || 'Нет описания')}</p>
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = event.clientX + 15 + 'px';
    tooltip.style.top = event.clientY + 15 + 'px';
}

function hideUserTooltip() {
    const tooltip = document.getElementById('userTooltip');
    if (tooltip) tooltip.style.display = 'none';
}
