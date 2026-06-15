// ========== DIAMKEY ROUTER ==========
function navigateTo(path) {
    history.pushState(null, null, path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    // Сброс вида профиля в users
    const usersPanel = document.getElementById('usersPanel');
    const userProfileView = document.getElementById('userProfileView');
    if (usersPanel) usersPanel.style.display = 'block';
    if (userProfileView) userProfileView.style.display = 'none';
    const userGpx = document.getElementById('userGpxSection');
    const userWall = document.getElementById('userWallSection');
    if (userGpx) userGpx.style.display = 'none';
    if (userWall) userWall.style.display = 'none';

    if (path === '/' || path === '') {
        document.getElementById('page-home').classList.add('active');
        if (typeof loadHomeData === 'function') loadHomeData();
    } else if (path === '/forum') {
        document.getElementById('page-forum').classList.add('active');
        if (typeof loadForum === 'function') loadForum();
    } else if (path === '/gpx') {
        document.getElementById('page-gpx').classList.add('active');
        if (typeof initGPX === 'function') {
            initGPX();
            if (gpxMap) setTimeout(() => gpxMap.invalidateSize(), 100);
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

    // Подсветка сайдбара
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('href') === path || (path.startsWith('/users') && btn.getAttribute('href') === '/users')) {
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
