document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('sidebar');

    // Переключение вкладок
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.tagName === 'A') return;
            e.preventDefault();
            document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            const target = document.getElementById(`page-${page}`);
            if (target) target.classList.add('active');
            if (page === 'gpx' && typeof gpxMap !== 'undefined') setTimeout(() => gpxMap.invalidateSize(), 100);
        });
    });

    // Кнопка выхода
    document.getElementById('logoutSidebarBtn')?.addEventListener('click', () => {
        document.getElementById('logoutModal').style.display = 'flex';
    });
    document.getElementById('confirmLogoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        currentUser = null;
        window.location.reload();
    });

    // Гостевой режим
    if (!currentUser) {
        // Скрываем все вкладки кроме home
        document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => {
            if (b.dataset.page !== 'home') b.style.display = 'none';
        });
        document.getElementById('logoutSidebarBtn').style.display = 'none';
        document.getElementById('page-home').classList.add('active');

        // Зелёная кнопка входа
        const guestLogin = document.createElement('button');
        guestLogin.className = 'sidebar-icon guest-login-btn';
        guestLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        guestLogin.title = 'Войти';
        guestLogin.addEventListener('click', () => { document.getElementById('loginModal').style.display = 'flex'; });
        sidebar.appendChild(guestLogin);
    } else {
        // Инициализация приложения
        loadProfile().then(() => {
            loadAnnouncement();
            loadForum();
            initGPX();
            renderProfile();
            loadSettings();
        });
    }

    // Модалка входа
    document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
        const res = await login(
            document.getElementById('loginIdentity').value.trim(),
            document.getElementById('loginPassword').value
        );
        if (res.error) return showToast(res.error);
        document.getElementById('loginModal').style.display = 'none';
        window.location.reload();
    });
    document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
        const res = await register(
            document.getElementById('loginIdentity').value.trim(),
            document.getElementById('loginPassword').value
        );
        if (res.error) return showToast(res.error);
        document.getElementById('loginModal').style.display = 'none';
        window.location.reload();
    });
});
