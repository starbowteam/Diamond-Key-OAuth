function updateHeroButton() {
    const btn = document.getElementById('heroActionBtn');
    const statsRow = document.getElementById('homeStatsRow');
    if (!btn) return;
    if (currentUser) {
        btn.innerHTML = '<i class="fas fa-user"></i> Мой профиль';
        btn.onclick = () => { navigateTo('/profile'); };
        if (statsRow) {
            loadHomeStats().then(stats => {
                if (stats) {
                    statsRow.innerHTML = `
                        <div class="stat-badge"><div class="number">${stats.gpxCount}</div><div class="label">GPX-поездок</div></div>
                        <div class="stat-badge"><div class="number">${stats.wallCount}</div><div class="label">Записей на стене</div></div>
                        <div class="stat-badge"><div class="number">${stats.totalUsers}</div><div class="label">Пользователей</div></div>
                    `;
                    statsRow.style.display = 'flex';
                }
            });
        }
    } else {
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Войти / Создать DiamKey';
        btn.onclick = () => {
            const modal = document.getElementById('loginModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        };
        if (statsRow) statsRow.style.display = 'none';
    }
}

function loadHomeData() {
    updateHeroButton();
    if (typeof loadAnnouncement === 'function') loadAnnouncement();
}

document.addEventListener('DOMContentLoaded', () => {
    const loginModal = document.getElementById('loginModal');
    if (!loginModal) return;

    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const tabQr = document.getElementById('tabQr');
    const loginBlock = document.getElementById('loginFormBlock');
    const registerBlock = document.getElementById('registerFormBlock');
    const qrBlock = document.getElementById('qrFormBlock');
    const qrContainer = document.getElementById('qrContainer');

    tabLogin?.addEventListener('click', () => {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        tabQr?.classList.remove('active');
        loginBlock.style.display = 'block';
        registerBlock.style.display = 'none';
        if (qrBlock) qrBlock.style.display = 'none';
        if (qrContainer) { qrContainer.innerHTML = ''; qrContainer.style.display = 'none'; clearInterval(qrPollingInterval); }
    });

    tabRegister?.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        tabQr?.classList.remove('active');
        registerBlock.style.display = 'block';
        loginBlock.style.display = 'none';
        if (qrBlock) qrBlock.style.display = 'none';
        if (qrContainer) { qrContainer.innerHTML = ''; qrContainer.style.display = 'none'; clearInterval(qrPollingInterval); }
    });

    tabQr?.addEventListener('click', () => {
        tabQr.classList.add('active');
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        loginBlock.style.display = 'none';
        registerBlock.style.display = 'none';
        if (qrBlock) qrBlock.style.display = 'block';
        // Не очищаем qrContainer, чтобы кнопка "Показать QR" осталась
    });

    document.getElementById('startQrBtn')?.addEventListener('click', () => {
        startQrLogin();
    });

    document.getElementById('doLoginBtn')?.addEventListener('click', async () => {
        const res = await login(
            document.getElementById('loginIdentity').value.trim(),
            document.getElementById('loginPassword').value
        );
        if (res.error) return showToast(res.error);
        closeModal('loginModal');
        smoothLoginSuccess();
    });

    const regLoginInput = document.getElementById('regLoginInput');
    const regStatus = document.getElementById('regLoginStatus');
    let checkTimeout;
    regLoginInput?.addEventListener('input', () => {
        clearTimeout(checkTimeout);
        const val = regLoginInput.value.trim();
        if (val.length < 3) { regStatus.textContent = ''; return; }
        checkTimeout = setTimeout(async () => {
            const { data } = await _supabase.from('users').select('login').eq('login', val).maybeSingle();
            if (data) {
                regStatus.textContent = '✗ Занят';
                regStatus.className = 'login-status invalid';
            } else {
                regStatus.textContent = '✓ Доступен';
                regStatus.className = 'login-status valid';
            }
        }, 500);
    });

    document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
        const loginVal = regLoginInput.value.trim();
        const pass1 = document.getElementById('regPasswordInput').value;
        const pass2 = document.getElementById('regPasswordConfirm').value;
        if (pass1 !== pass2) return showToast('Пароли не совпадают');
        const res = await register(loginVal, pass1);
        if (res.error) return showToast(res.error);
        closeModal('loginModal');
        smoothLoginSuccess();
    });

    const scrollBtn = document.createElement('button');
    scrollBtn.id = 'scrollToTopBtn';
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    document.body.appendChild(scrollBtn);
    window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 400);
    });
    scrollBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});

function smoothLoginSuccess() {
    const loader = document.getElementById('smoothLoader');
    if (!loader) return;
    loader.classList.add('show');
    setTimeout(() => {
        navigateTo('/home');
        loader.classList.remove('show');
    }, 1200);
}
