document.addEventListener('DOMContentLoaded', () => {
    // Сайдбар: переключение вкладок
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
            if (page === 'gpx') {
                if (!localStorage.getItem('gpx_info_seen')) {
                    document.getElementById('gpxInfoModal').style.display = 'flex';
                }
                setTimeout(() => gpxMap?.invalidateSize(), 100);
            }
        });
    });

    // Кнопка "Понял" в GPX-модалке
    document.getElementById('gpxInfoOkBtn').addEventListener('click', () => {
        document.getElementById('gpxInfoModal').style.display = 'none';
        localStorage.setItem('gpx_info_seen', '1');
    });

    // Выход
    document.getElementById('logoutSidebarBtn').addEventListener('click', () => {
        document.getElementById('logoutModal').style.display = 'flex';
    });
    document.getElementById('confirmLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        window.location.reload();
    });

    // Гостевой режим
    if (!currentUser) {
        document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => {
            if (b.dataset.page !== 'home') b.style.display = 'none';
        });
        document.getElementById('logoutSidebarBtn').style.display = 'none';
        document.getElementById('page-home').classList.add('active');
        // Зелёная кнопка входа
        const guestLogin = document.createElement('button');
        guestLogin.className = 'sidebar-icon';
        guestLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        guestLogin.style.background = '#2e7d32';
        guestLogin.title = 'Войти';
        guestLogin.addEventListener('click', () => { document.getElementById('loginModal').style.display = 'flex'; });
        document.getElementById('sidebar').appendChild(guestLogin);
    } else {
        initApp();
    }

    // Локальный вход
    document.getElementById('doLoginBtn').addEventListener('click', async () => {
        const res = await login(
            document.getElementById('loginIdentity').value.trim(),
            document.getElementById('loginPassword').value
        );
        if (res.error) return showToast(res.error);
        document.getElementById('loginModal').style.display = 'none';
        window.location.reload();
    });
    document.getElementById('doRegisterBtn').addEventListener('click', async () => {
        const res = await register(
            document.getElementById('loginIdentity').value.trim(),
            document.getElementById('loginPassword').value
        );
        if (res.error) return showToast(res.error);
        document.getElementById('loginModal').style.display = 'none';
        window.location.reload();
    });
});

async function initApp() {
    await loadProfile();
    loadAnnouncement();
    loadForum();
    initGPX();
    loadProfilePage();
}
