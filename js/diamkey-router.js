function navigateTo(path, replace = false) {
    if (replace) { history.replaceState(null, null, path); }
    else { history.pushState(null, null, path); }
    handleRoute();
}

function updateSidebarVisibility() {
    const isLoggedIn = !!currentUser;
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        const href = btn.getAttribute('href');
        if (href === '/home' || href === 'https://discord.gg/diamondshop') return;
        btn.style.display = isLoggedIn ? '' : 'none';
    });
    const logoutBtn = document.getElementById('logoutSidebarBtn');
    const scannerBtn = document.getElementById('qrScannerBtn');
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
    if (scannerBtn) scannerBtn.style.display = isLoggedIn ? 'flex' : 'none';
}

function handleRoute() {
    let path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    console.log('[DiamKey] Маршрут:', path);

    if (path === '/' || path === '') {
        history.replaceState(null, null, '/home');
        path = '/home';
    }

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

    if (path === '/home') {
        activatePage('page-home');
        if (typeof loadHomeData === 'function') loadHomeData();
    } else if (path === '/add') {
        activatePage('page-add');
    } else if (path === '/add/gpx') {
        activatePage('page-add-gpx', true);
        if (typeof initGPX === 'function') {
            initGPX();
            if (gpxMap) setTimeout(() => gpxMap.invalidateSize(), 150);
        }
        const gpxId = params.get('id');
        if (gpxId) {
            document.getElementById('saveGpxBtn').style.display = 'none';
            const uploadBtn = document.getElementById('uploadGpxBtn');
            if (uploadBtn) uploadBtn.style.display = 'none';
            setTimeout(() => { if (typeof loadGpxFromId === 'function') loadGpxFromId(gpxId); }, 400);
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
        setTimeout(() => { if (typeof openUserProfile === 'function') openUserProfile(login); }, 0);
    } else if (path === '/profile') {
        if (!currentUser) { navigateTo('/home'); return; }
        activatePage('page-profile', true);
        setTimeout(() => { if (typeof renderMyProfile === 'function') renderMyProfile(); }, 0);
    } else if (path.startsWith('/profile/') && path.endsWith('/gpxview')) {
        const login = path.split('/profile/')[1].split('/gpxview')[0];
        activatePage('page-profile-gpx', true);
        setTimeout(() => { if (typeof renderProfileGpxView === 'function') renderProfileGpxView(login); }, 0);
    } else if (path === '/qr-confirm') {
        activatePage('page-qr-confirm', true);
        const ticket = params.get('ticket');
        if (ticket && typeof renderQrConfirm === 'function') renderQrConfirm(ticket);
    } else if (path === '/diamond-plus') {
        activatePage('page-diamond-plus', true);
        if (typeof renderDiamondPlusPage === 'function') renderDiamondPlusPage();
    } else {
        activatePage('page-home');
        if (typeof loadHomeData === 'function') loadHomeData();
    }

    // Подсветка активной иконки
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.classList.remove('active');
        const href = btn.getAttribute('href');
        if (href === path || (path.startsWith('/add') && href === '/add') || (path.startsWith('/users') && href === '/users') || (path.startsWith('/profile') && href === '/profile')) {
            btn.classList.add('active');
        }
    });
}

window.addEventListener('popstate', handleRoute);

document.addEventListener('DOMContentLoaded', () => {
    handleRoute();
    updateSidebarVisibility();

    const logoutBtn = document.getElementById('logoutSidebarBtn');
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        currentUser = null;
        updateSidebarVisibility();
        window.location.href = '/home';
    });

    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.getAttribute('target') === '_blank') return;
            e.preventDefault();
            navigateTo(btn.getAttribute('href'));
        });
    });
});
