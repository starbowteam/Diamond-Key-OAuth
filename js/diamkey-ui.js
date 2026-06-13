document.addEventListener('DOMContentLoaded', () => {
    const pages = document.querySelectorAll('.page');
    function switchPage(pageId) {
        const target = document.getElementById(`page-${pageId}`);
        if (!target) return;
        pages.forEach(p => { if (p.classList.contains('active') && p !== target) { p.style.opacity = '0'; setTimeout(() => p.classList.remove('active'), 300); } });
        target.classList.add('active');
        setTimeout(() => { target.style.opacity = '1'; }, 10);
    }

    document.querySelectorAll('.sidebar-icon[data-page]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.tagName === 'A') return;
            e.preventDefault();
            document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchPage(btn.dataset.page);
            if (btn.dataset.page === 'gpx') {
                if (!localStorage.getItem('gpx_info_seen')) {
                    const modal = document.getElementById('gpxInfoModal');
                    if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
                }
            }
            if (btn.dataset.page === 'users') loadUsers();
        });
    });

    document.getElementById('logoutSidebarBtn').addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        window.location.reload();
    });

    if (!currentUser) {
        document.querySelectorAll('.sidebar-icon[data-page]').forEach(b => { if (b.dataset.page !== 'home') b.style.display = 'none'; });
        document.getElementById('logoutSidebarBtn').style.display = 'none';
        document.getElementById('page-home').classList.add('active');
        const guestLogin = document.createElement('button');
        guestLogin.className = 'sidebar-icon';
        guestLogin.innerHTML = '<i class="fas fa-sign-in-alt"></i>';
        guestLogin.title = 'Войти';
        guestLogin.addEventListener('click', () => {
            const modal = document.getElementById('loginModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        });
        document.getElementById('sidebar').appendChild(guestLogin);
    } else {
        loadProfile().then(() => {
            loadAnnouncement();
            loadForum();
            loadProfilePage();
            loadUsers();
        });
    }

    document.getElementById('doLoginBtn').addEventListener('click', async () => {
        const res = await login(document.getElementById('loginIdentity').value.trim(), document.getElementById('loginPassword').value);
        if (res.error) return showToast(res.error);
        closeModal('loginModal');
        window.location.reload();
    });
    document.getElementById('doRegisterBtn').addEventListener('click', async () => {
        const res = await register(document.getElementById('loginIdentity').value.trim(), document.getElementById('loginPassword').value);
        if (res.error) return showToast(res.error);
        closeModal('loginModal');
        window.location.reload();
    });
});
