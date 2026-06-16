// ========== DIAMKEY ROUTER ==========
function navigateTo(path) {
    history.pushState(null, null, path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // Скрываем все страницы
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });

    // Сброс вида профиля в users
    const usersPanel = document.getElementById('usersPanel');
    const userProfileView = document.getElementById('userProfileView');
    const userGpx = document.getElementById('userGpxSection');
    const userWall = document.getElementById('userWallSection');
    if (usersPanel) usersPanel.style.display = 'block';
    if (userProfileView) userProfileView.style.display = 'none';
    if (userGpx) userGpx.style.display = 'none';
    if (userWall) userWall.style.display = 'none';

    // Показываем нужную страницу
    if (path === '/' || path === '') {
        document.getElementById('page-home').classList.add('active');
        if (typeof loadHomeData === 'function') loadHomeData();
    } else if (path === '/chats') {
        document.getElementById('page-chats').classList.add('active');
    } else if (path === '/gpx') {
        document.getElementById('page-gpx').classList.add('active');
        if (typeof initGPX === 'function') {
            initGPX();
            if (gpxMap) setTimeout(() => gpxMap.invalidateSize(), 100);
        }
        const gpxId = params.get('id');
        if (gpxId) {
            document.getElementById('loadGpxBtn').style.display = 'none';
            document.getElementById('saveGpxBtn').style.display = 'none';
            setTimeout(() => viewGpxRoute(gpxId), 200);
        } else {
            document.getElementById('loadGpxBtn').style.display = '';
            document.getElementById('saveGpxBtn').style.display = 'none';
        }
        if (!localStorage.getItem('gpx_info_seen')) {
            const modal = document.getElementById('gpxInfoModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        }
    } else if (path === '/users') {
        document.getElementById('page-users').classList.add('active');
        if (typeof loadUsers === 'function') loadUsers();
    } else if (path.startsWith('/users/')) {
        const login = path.split('/users/')[1];
        document.getElementById('page-users').classList.add('active');
        if (typeof showUserProfile === 'function') showUserProfile(login);
    } else if (path === '/profile') {
        if (!currentUser) { navigateTo('/'); return; }
        document.getElementById('page-profile').classList.add('active');
        if (typeof loadMyProfile === 'function') loadMyProfile();
    } else {
        document.getElementById('page-home').classList.add('active');
        if (typeof loadHomeData === 'function') loadHomeData();
    }

    // Подсветка сайдбара (кроме выхода)
    document.querySelectorAll('.sidebar-icon:not(#logoutSidebarBtn)').forEach(btn => {
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
