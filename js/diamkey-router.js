function navigateTo(path) {
    history.pushState(null, null, path);
    handleRoute();
}

function handleRoute() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    
    console.log('[DiamKey] Маршрут:', path);

    document.querySelectorAll('.page.active').forEach(p => {
        p.classList.remove('active');
        p.style.opacity = '0';
        p.style.transform = 'translateY(16px)';
    });

    function activatePage(pageId, instant = false) {
        const page = document.getElementById(pageId);
        if (!page) return;
        if (instant) {
            page.classList.add('active');
            page.style.opacity = '1';
            page.style.transform = 'translateY(0)';
        } else {
            setTimeout(() => {
                page.classList.add('active');
                page.style.opacity = '1';
                page.style.transform = 'translateY(0)';
            }, 60);
        }
    }

    if (path === '/' || path === '') {
        activatePage('page-home');
        if (typeof loadHomeData === 'function') loadHomeData();
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
            console.log('[DiamKey] Загрузка GPX по ID из URL:', gpxId);
            setTimeout(() => {
                if (typeof loadGpxFromId === 'function') loadGpxFromId(gpxId);
            }, 400);
        } else {
            const uploadBtn = document.getElementById('uploadGpxBtn');
            if (currentUser && uploadBtn) uploadBtn.style.display = 'inline-flex';
            else if (uploadBtn) uploadBtn.style.display = 'none';
        }
    } else if (path === '/users') {
        activatePage('page-users');
        if (typeof loadUsers === 'function') loadUsers();
    } else if (path.startsWith('/users/')) {
        const login = path.split('/users/')[1];
        activatePage('page-users', true);
        // Даём браузеру кадр на отрисовку перед заполнением
        setTimeout(() => {
            if (typeof openUserProfile === 'function') openUserProfile(login);
        }, 0);
    } else if (path === '/profile') {
        if (!currentUser) { navigateTo('/'); return; }
        activatePage('page-profile', true);
        setTimeout(() => {
            if (typeof renderMyProfile === 'function') renderMyProfile();
        }, 0);
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
    const logoutBtn = document.getElementById('logoutSidebarBtn');
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';

    logoutBtn?.addEventListener('click', () => {
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
