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
        if (qrContainer) { qrContainer.innerHTML = ''; qrContainer.style.display = 'none'; clearInterval(qrPollingInterval); qrGenerated = false; }
    });

    tabRegister?.addEventListener('click', () => {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        tabQr?.classList.remove('active');
        registerBlock.style.display = 'block';
        loginBlock.style.display = 'none';
        if (qrBlock) qrBlock.style.display = 'none';
        if (qrContainer) { qrContainer.innerHTML = ''; qrContainer.style.display = 'none'; clearInterval(qrPollingInterval); qrGenerated = false; }
    });

    tabQr?.addEventListener('click', () => {
        tabQr.classList.add('active');
        tabLogin.classList.remove('active');
        tabRegister.classList.remove('active');
        loginBlock.style.display = 'none';
        registerBlock.style.display = 'none';
        if (qrBlock) qrBlock.style.display = 'block';
        if (!qrGenerated) generateQrInModal();
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

    // Кнопка выдачи бейджей (админская)
    document.getElementById('badgeAdminBtn')?.addEventListener('click', () => {
        if (currentUser && currentUser.login === 'viktorshopa') {
            openBadgeModal();
        }
    });

    // Модалка обложки – переключение вкладок
    document.querySelectorAll('[data-cover-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-cover-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.coverTab;
            document.getElementById('coverGradients').style.display = tab === 'gradients' ? 'grid' : 'none';
            document.getElementById('coverColors').style.display = tab === 'colors' ? 'grid' : 'none';
            document.getElementById('coverUpload').style.display = tab === 'upload' ? 'block' : 'none';
        });
    });

    // Выбор обложки
    let selectedCover = null;
    document.querySelectorAll('.cover-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.cover-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedCover = opt.dataset.cover;
        });
    });

    document.getElementById('coverFileInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            selectedCover = ev.target.result; // base64
            document.querySelectorAll('.cover-option').forEach(o => o.classList.remove('selected'));
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('saveCoverBtn')?.addEventListener('click', async () => {
        if (!selectedCover) return;
        await _supabase.from('users').update({ cover: selectedCover }).eq('login', currentUser.login);
        currentUser.cover = selectedCover;
        closeModal('coverModal');
        if (document.getElementById('page-profile').classList.contains('active')) renderMyProfile();
        showToast('Обложка обновлена');
    });
});

function smoothLoginSuccess() {
    const loader = document.getElementById('smoothLoader');
    if (!loader) return;
    loader.classList.add('show');
    setTimeout(() => {
        navigateTo('/home');
        loader.classList.remove('show');
        updateSidebarVisibility();
    }, 1200);
}

function openCoverModal() {
    const modal = document.getElementById('coverModal');
    if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
}

async function openBadgeModal() {
    const modal = document.getElementById('badgeModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');

    // Загружаем список пользователей
    const users = await getUsers();
    const listContainer = document.getElementById('badgeUserList');
    listContainer.innerHTML = users.map(u => `
        <div class="user-row" data-login="${u.login}" style="padding:10px; cursor:pointer; border-radius:12px; display:flex; align-items:center; gap:10px; margin-bottom:4px;">
            ${u.avatar ? `<img src="${u.avatar}" style="width:32px;height:32px;border-radius:50%;">` : '<i class="fas fa-user"></i>'}
            <span>${escapeHtml(u.login)}</span>
        </div>
    `).join('');

    let selectedUser = null;
    listContainer.querySelectorAll('.user-row').forEach(row => {
        row.addEventListener('click', async () => {
            selectedUser = row.dataset.login;
            document.getElementById('selectedBadgeUser').textContent = selectedUser;
            document.getElementById('badgeListContainer').style.display = 'block';

            const badges = await getAllBadges();
            const userBadges = await getUserBadges(selectedUser);
            const userBadgeIds = userBadges.map(b => b.badge_id);

            const optionsContainer = document.getElementById('badgeOptions');
            optionsContainer.innerHTML = badges.map(b => {
                const hasBadge = userBadgeIds.includes(b.id);
                return `
                    <div class="badge-card" style="cursor:pointer; opacity:${hasBadge ? '1' : '0.6'}" data-badge-id="${b.id}">
                        <div class="badge-icon"><i class="fas ${b.icon}" style="background:${b.gradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></i></div>
                        <span class="badge-name">${escapeHtml(b.name)}</span>
                        <button class="btn btn-icon" style="margin-left:auto;" data-action="${hasBadge ? 'remove' : 'assign'}">
                            <i class="fas ${hasBadge ? 'fa-times' : 'fa-plus'}"></i>
                        </button>
                    </div>
                `;
            }).join('');

            optionsContainer.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const badgeId = btn.parentElement.dataset.badgeId;
                    const action = btn.dataset.action;
                    if (action === 'assign') {
                        const { error } = await assignBadge(selectedUser, badgeId);
                        if (error) showToast(error.message || 'Ошибка');
                        else showToast('Бейдж выдан');
                    } else {
                        const { error } = await removeBadge(selectedUser, badgeId);
                        if (error) showToast('Ошибка');
                        else showToast('Бейдж убран');
                    }
                    openBadgeModal(); // обновить
                });
            });
        });
    });

    // Поиск
    document.getElementById('badgeUserSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        listContainer.querySelectorAll('.user-row').forEach(row => {
            row.style.display = row.dataset.login.toLowerCase().includes(term) ? '' : 'none';
        });
    });
}

// Добавляем в updateSidebarVisibility показ админской кнопки
function updateSidebarVisibility() {
    const isLoggedIn = !!currentUser;
    document.querySelectorAll('.sidebar-icon[href]').forEach(btn => {
        const href = btn.getAttribute('href');
        if (href === '/home' || href === 'https://discord.gg/diamondshop') return;
        btn.style.display = isLoggedIn ? '' : 'none';
    });
    const logoutBtn = document.getElementById('logoutSidebarBtn');
    const scannerBtn = document.getElementById('qrScannerBtn');
    const badgeAdminBtn = document.getElementById('badgeAdminBtn');
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
    if (scannerBtn) scannerBtn.style.display = isLoggedIn ? 'flex' : 'none';
    if (badgeAdminBtn) {
        badgeAdminBtn.style.display = (currentUser && currentUser.login === 'viktorshopa') ? 'flex' : 'none';
    }
}
