function navigateTo(path) {
    history.pushState(null, null, path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    document.querySelectorAll('.page').forEach(p => {
        if (p.classList.contains('active')) {
            p.style.opacity = '0';
            p.style.transform = 'translateY(16px)';
            setTimeout(() => p.classList.remove('active'), 300);
        }
    });

    const usersPanel = document.getElementById('usersPanel');
    const userProfileView = document.getElementById('userProfileView');
    if (usersPanel) usersPanel.style.display = 'block';
    if (userProfileView) userProfileView.style.display = 'none';
    const userGpx = document.getElementById('userGpxSection');
    const userWall = document.getElementById('userWallSection');
    if (userGpx) userGpx.style.display = 'none';
    if (userWall) userWall.style.display = 'none';

    function activatePage(pageId) {
        const page = document.getElementById(pageId);
        if (!page) return;
        setTimeout(() => {
            page.classList.add('active');
            page.style.opacity = '1';
            page.style.transform = 'translateY(0)';
        }, 60);
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
            if (gpxMap) setTimeout(() => gpxMap.invalidateSize(), 150);
        }
        const gpxId = params.get('id');
        if (gpxId) {
            document.getElementById('saveGpxBtn').style.display = 'none';
            const uploadBtn = document.getElementById('uploadGpxBtn');
            if (uploadBtn) uploadBtn.style.display = 'none';
            setTimeout(() => {
                if (typeof viewGpxRoute === 'function') viewGpxRoute(gpxId);
            }, 300);
        } else {
            const uploadBtn = document.getElementById('uploadGpxBtn');
            if (currentUser && uploadBtn) uploadBtn.style.display = 'inline-flex';
            else if (uploadBtn) uploadBtn.style.display = 'none';
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
    const isLoggedIn = !!currentUser;
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        const href = btn.getAttribute('href');
        if (href === '/' || href === 'https://discord.gg/diamondshop') return;
        if (!isLoggedIn) btn.style.display = 'none';
    });
    document.getElementById('logoutSidebarBtn').style.display = isLoggedIn ? 'flex' : 'none';

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
