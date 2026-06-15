// ========== DIAMKEY ROUTER ==========
function navigateTo(path) {
    history.pushState(null, null, path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));

    // Сбрасываем просмотр чужого профиля
    document.getElementById('usersPanel').style.display = 'block';
    document.getElementById('userProfileView').style.display = 'none';
    document.getElementById('userGpxSection').style.display = 'none';
    document.getElementById('userWallSection').style.display = 'none';

    // Активируем нужную страницу
    if (path === '/' || path === '') {
        document.getElementById('page-home').classList.add('active');
        loadHomeData();
    } else if (path === '/forum') {
        document.getElementById('page-forum').classList.add('active');
        loadForum();
    } else if (path === '/gpx') {
        document.getElementById('page-gpx').classList.add('active');
        initGPX();
        if (!localStorage.getItem('gpx_info_seen')) {
            document.getElementById('gpxInfoModal').style.display = 'flex';
            document.getElementById('gpxInfoModal').classList.add('active');
        }
    } else if (path === '/users') {
        document.getElementById('page-users').classList.add('active');
        loadUsers();
    } else if (path.startsWith('/users/')) {
        const login = path.split('/users/')[1];
        document.getElementById('page-users').classList.add('active');
        showUserProfile(login);
    } else if (path === '/profile') {
        document.getElementById('page-profile').classList.add('active');
        loadMyProfile();
    } else {
        // 404 – показываем главную
        document.getElementById('page-home').classList.add('active');
        loadHomeData();
    }

    // Подсветка сайдбара
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('href') === path || (path.startsWith('/users') && btn.getAttribute('href') === '/users')) {
            btn.classList.add('active');
        }
    });
}

window.addEventListener('popstate', handleRoute);

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    handleRoute();
    // Гостевой режим
    if (!currentUser) {
        document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
            if (btn.getAttribute('href') !== '/') btn.style.display = 'none';
        });
        document.getElementById('logoutSidebarBtn').style.display = 'none';
    }
    // Кнопка выхода
    document.getElementById('logoutSidebarBtn').addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        window.location.href = '/';
    });
    // Перехват кликов на ссылки сайдбара
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.getAttribute('target') === '_blank') return;
            e.preventDefault();
            navigateTo(btn.getAttribute('href'));
        });
    });
});
