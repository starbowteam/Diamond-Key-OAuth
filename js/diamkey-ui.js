function updateHeroButton() {
    const btn = document.getElementById('heroActionBtn');
    const statsRow = document.getElementById('homeStatsRow');
    if (!btn) return;
    if (currentUser) {
        btn.innerHTML = '<i class="fas fa-user"></i> Мой профиль';
        btn.onclick = () => { navigateTo('/profile'); };
        if (statsRow) {
            loadHomeStats().then(stats => {
                if (stats) {
                    statsRow.innerHTML = `
                        <div class="stat-badge"><div class="number">${stats.gpxCount}</div><div class="label">GPX-поездок</div></div>
                        <div class="stat-badge"><div class="number">${stats.wallCount}</div><div class="label">Записей на стене</div></div>
                        <div class="stat-badge"><div class="number">${stats.totalUsers}</div><div class="label">Пользователей</div></div>
                    `;
                    statsRow.style.display = 'flex';
                }
            });
        }
    } else {
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Войти / Создать DiamKey';
        btn.onclick = () => {
            const modal = document.getElementById('loginModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        };
        if (statsRow) statsRow.style.display = 'none';
    }
}

function loadHomeData() {
    updateHeroButton();
    if (typeof loadAnnouncement === 'function') loadAnnouncement();
}

// ======== КОЛОКОЛЬЧИК И УВЕДОМЛЕНИЯ ========
async function updateNotificationBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const count = await getUnreadNotificationCount();
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
}

async function openNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;
    const list = document.getElementById('notificationsList');
    list.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    panel.classList.add('show');
    const notifs = await getNotifications();
    if (notifs.length === 0) {
        list.innerHTML = '<p class="text-muted">Нет уведомлений</p>';
    } else {
        list.innerHTML = notifs.map(n => `
            <div class="notification-item ${n.read ? '' : 'unread'}">
                <div class="notif-text">${escapeHtml(n.content)}</div>
                <div class="notif-time">${new Date(n.created_at).toLocaleString()}</div>
            </div>
        `).join('');
    }
    await markNotificationsRead();
    updateNotificationBadge();
}

function closeNotificationsPanel() {
    const panel = document.getElementById('notificationsPanel');
    if (panel) panel.classList.remove('show');
}

function setupNotifications() {
    if (!currentUser) return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || document.getElementById('notifBell')) return;

    // Колокольчик
    const bell = document.createElement('a');
    bell.className = 'sidebar-icon notif-bell';
    bell.id = 'notifBell';
    bell.href = '#';
    bell.innerHTML = '<i class="fas fa-bell"></i><span class="badge" id="notifBadge"></span>';
    bell.addEventListener('click', (e) => {
        e.preventDefault();
        openNotificationsPanel();
    });
    const discordBtn = document.getElementById('discordSidebarIcon')?.parentElement;
    if (discordBtn) sidebar.insertBefore(bell, discordBtn);
    else sidebar.appendChild(bell);

    // Панель
    const panel = document.createElement('div');
    panel.className = 'notifications-panel glass-panel';
    panel.id = 'notificationsPanel';
    panel.innerHTML = `
        <div class="notif-header">
            <h3>Уведомления</h3>
            <button class="btn btn-icon" onclick="closeNotificationsPanel()"><i class="fas fa-times"></i></button>
        </div>
        <div class="notif-list" id="notificationsList"></div>
    `;
    document.body.appendChild(panel);

    // Фоновое обновление бейджа
    setInterval(updateNotificationBadge, 30000);
    updateNotificationBadge();
}

document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('loginModal');
    if (!loginModal) return;

    document.getElementById('tabLogin')?.addEventListener('click', () => {
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('tabRegister').classList.remove('active');
        document.getElementById('loginFormBlock').style.display = 'block';
        document.getElementById('registerFormBlock').style.display = 'none';
    });
    document.getElementById('tabRegister')?.addEventListener('click', () => {
        document.getElementById('tabRegister').classList.add('active');
        document.getElementById('tabLogin').classList.remove('active');
        document.getElementById('registerFormBlock').style.display = 'block';
        document.getElementById('loginFormBlock').style.display = 'none';
    });

    document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
        const res = await login(
            document.getElementById('loginIdentity').value.trim(),
            document.getElementById('loginPassword').value
        );
        if (res.error) return showToast(res.error);
        closeModal('loginModal');
        window.location.href = '/home';
    });

    const regLoginInput = document.getElementById('regLoginInput');
    const regStatus = document.getElementById('regLoginStatus');
    let checkTimeout;
    regLoginInput?.addEventListener('input', () => {
        clearTimeout(checkTimeout);
        const val = regLoginInput.value.trim();
        if (val.length < 3) { regStatus.textContent = ''; return; }
        checkTimeout = setTimeout(async () => {
            const { data } = await _supabase.from('users').select('login').eq('login', val).maybeSingle();
            if (data) {
                regStatus.textContent = '✗ Занят';
                regStatus.className = 'login-status invalid';
            } else {
                regStatus.textContent = '✓ Доступен';
                regStatus.className = 'login-status valid';
            }
        }, 500);
    });

    document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
        const loginVal = regLoginInput.value.trim();
        const pass1 = document.getElementById('regPasswordInput').value;
        const pass2 = document.getElementById('regPasswordConfirm').value;
        if (pass1 !== pass2) return showToast('Пароли не совпадают');
        const res = await register(loginVal, pass1);
        if (res.error) return showToast(res.error);
        closeModal('loginModal');
        window.location.href = '/home';
    });

    const scrollBtn = document.createElement('button');
    scrollBtn.id = 'scrollToTopBtn';
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(scrollBtn);
    window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 400);
    });
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    setupNotifications();
});
