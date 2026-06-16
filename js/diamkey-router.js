// ========== DIAMKEY ROUTER ==========
function navigateTo(path) {
    history.pushState(null, null, path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    // Сначала скрываем все страницы с анимацией
    document.querySelectorAll('.page').forEach(p => {
        if (p.classList.contains('active')) {
            p.style.opacity = '0';
            p.style.transform = 'translateY(12px)';
            setTimeout(() => p.classList.remove('active'), 300);
        }
    });

    // Сброс вида профиля в users
    const usersPanel = document.getElementById('usersPanel');
    const userProfileView = document.getElementById('userProfileView');
    if (usersPanel) usersPanel.style.display = 'block';
    if (userProfileView) userProfileView.style.display = 'none';
    const userGpx = document.getElementById('userGpxSection');
    const userWall = document.getElementById('userWallSection');
    if (userGpx) userGpx.style.display = 'none';
    if (userWall) userWall.style.display = 'none';

    // Функция активации страницы с задержкой для анимации
    function activatePage(pageId) {
        const page = document.getElementById(pageId);
        if (!page) return;
        setTimeout(() => {
            page.classList.add('active');
            page.style.opacity = '1';
            page.style.transform = 'translateY(0)';
        }, 50);
    }

    if (path === '/' || path === '') {
        activatePage('page-home');
        if (typeof loadHomeData === 'function') loadHomeData();
    } else if (path === '/chats') {
        activatePage('page-chats');
    } else if (path === '/gpx') {
        activatePage('page-gpx');
        if (typeof initGPX === 'function') {
            initGPX();
            if (gpxMap) setTimeout(() => gpxMap.invalidateSize(), 100);
        }
        // Проверка query параметра id для прямого просмотра GPX
        const gpxId = params.get('id');
        if (gpxId) {
            setTimeout(() => viewGpxRoute(gpxId), 200);
        }
        if (!localStorage.getItem('gpx_info_seen')) {
            const modal = document.getElementById('gpxInfoModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        }
    } else if (path === '/users') {
        activatePage('page-users');
        if (typeof loadUsers === 'function') loadUsers();
    } else if (path.startsWith('/users/')) {
        const login = path.split('/users/')[1];
        activatePage('page-users');
        if (typeof showUserProfile === 'function') showUserProfile(login);
    } else if (path === '/profile') {
        if (!currentUser) { navigateTo('/'); return; }
        activatePage('page-profile');
        if (typeof loadMyProfile === 'function') loadMyProfile();
    } else {
        activatePage('page-home');
        if (typeof loadHomeData === 'function') loadHomeData();
    }

    // Подсветка сайдбара
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.classList.remove('active');
        const href = btn.getAttribute('href');
        if (href === path || (path.startsWith('/users') && href === '/users') || (path.startsWith('/gpx') && href === '/gpx')) {
            btn.classList.add('active');
        }
    });
}

window.addEventListener('popstate', handleRoute);

document.addEventListener('DOMContentLoaded', () => {
    handleRoute();
    if (!currentUser) {
        document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
            if (btn.getAttribute('href') !== '/') btn.style.display = 'none';
        });
        document.getElementById('logoutSidebarBtn').style.display = 'none';
    }
    document.getElementById('logoutSidebarBtn').addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        window.location.href = '/';
    });
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.getAttribute('target') === '_blank') return;
            e.preventDefault();
            navigateTo(btn.getAttribute('href'));
        });
    });
});
