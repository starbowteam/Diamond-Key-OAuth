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

    document.getElementById('badgeAdminBtn')?.addEventListener('click', () => {
        if (currentUser && currentUser.login === 'viktorshopa') {
            openBadgeModal();
        }
    });

    // Старая модалка обложки больше не нужна, но оставим для совместимости
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

// ================= НОВАЯ НАСТРОЙКА БАННЕРА =================
function openCoverSetupModal(profile) {
    // Создаём модалку динамически, чтобы не менять HTML
    const existing = document.getElementById('coverSetupModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'coverSetupModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.classList.add('active');
    modal.innerHTML = `
        <div class="modal-content glass-panel cover-setup-modal" onclick="event.stopPropagation()">
            <h3><i class="fas fa-image"></i> Настроить обложку</h3>
            <div class="cover-preview-container" id="coverPreviewContainer">
                <img id="coverPreviewImage" src="" alt="Preview" draggable="false">
            </div>
            <div class="cover-controls">
                <i class="fas fa-search-minus"></i>
                <input type="range" id="coverScaleSlider" min="0.5" max="2" step="0.01" value="1">
                <i class="fas fa-search-plus"></i>
            </div>
            <div style="margin-top:20px; display:flex; gap:12px; justify-content:center;">
                <button class="btn btn-icon" id="coverUploadBtn"><i class="fas fa-upload"></i> Загрузить</button>
                <button class="btn btn-primary" id="saveCoverSetupBtn"><i class="fas fa-check"></i> Сохранить</button>
                <button class="btn btn-secondary" id="cancelCoverSetupBtn">Отмена</button>
            </div>
            <input type="file" id="coverFileInput" accept="image/*" style="display:none;">
        </div>
    `;
    document.body.appendChild(modal);

    const container = document.getElementById('coverPreviewContainer');
    const image = document.getElementById('coverPreviewImage');
    const slider = document.getElementById('coverScaleSlider');
    const uploadBtn = document.getElementById('coverUploadBtn');
    const fileInput = document.getElementById('coverFileInput');
    const saveBtn = document.getElementById('saveCoverSetupBtn');
    const cancelBtn = document.getElementById('cancelCoverSetupBtn');

    let currentSrc = '';
    let posX = profile.cover_pos_x || 0;
    let posY = profile.cover_pos_y || 0;
    let scale = profile.cover_scale || 1;

    // Если уже было изображение, загружаем его
    if (profile.cover && profile.cover.startsWith('image:')) {
        currentSrc = profile.cover.replace('image:', '');
        image.src = currentSrc;
    }

    function applyTransform() {
        image.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        slider.value = scale;
    }

    applyTransform();

    // Drag
    let isDragging = false;
    let startX, startY, startPosX, startPosY;

    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startPosX = posX;
        startPosY = posY;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        posX = startPosX + dx;
        posY = startPosY + dy;
        applyTransform();
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
    // Touch events
    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startPosX = posX;
            startPosY = posY;
        }
    });
    window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        posX = startPosX + dx;
        posY = startPosY + dy;
        applyTransform();
        e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    slider.addEventListener('input', () => {
        scale = parseFloat(slider.value);
        applyTransform();
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            currentSrc = ev.target.result;
            image.src = currentSrc;
            posX = 0; posY = 0; scale = 1;
            applyTransform();
        };
        reader.readAsDataURL(file);
    });

    saveBtn.addEventListener('click', async () => {
        if (!currentSrc) {
            showToast('Сначала загрузите изображение');
            return;
        }
        const coverValue = 'image:' + currentSrc;
        await updateProfile({
            cover: coverValue,
            cover_pos_x: posX,
            cover_pos_y: posY,
            cover_scale: scale
        });
        currentUser.cover = coverValue;
        currentUser.cover_pos_x = posX;
        currentUser.cover_pos_y = posY;
        currentUser.cover_scale = scale;
        modal.remove();
        if (document.getElementById('page-profile').classList.contains('active')) {
            renderMyProfile();
        }
        showToast('Обложка обновлена');
    });

    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Старая openCoverModal больше не нужна, оставляем заглушку
function openCoverModal() {
    // можно перенаправить на новую, если ещё где-то вызывается
    if (currentUser) openCoverSetupModal(currentUser);
}

// ================= МОДАЛКА БЕЙДЖЕЙ (улучшенная) =================
async function openBadgeModal() {
    const modal = document.getElementById('badgeModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');

    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        modalContent.className = 'modal-content glass-panel badge-modal-content';
    }

    const users = await getUsers();
    const listContainer = document.getElementById('badgeUserList');
    listContainer.innerHTML = users.map(u => `
        <div class="badge-user-row" data-login="${u.login}">
            ${u.avatar ? `<img src="${u.avatar}" alt="${u.login}">` : '<i class="fas fa-user" style="font-size:24px;color:var(--text-muted);width:36px;height:36px;display:flex;align-items:center;justify-content:center;"></i>'}
            <span>${escapeHtml(u.login)}</span>
        </div>
    `).join('');

    let selectedUser = null;
    listContainer.querySelectorAll('.badge-user-row').forEach(row => {
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
                    <div class="badge-option-card">
                        <div class="badge-info">
                            <div class="badge-icon"><i class="fas ${b.icon}" style="background:${b.gradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></i></div>
                            <span class="badge-name">${escapeHtml(b.name)}</span>
                        </div>
                        <button data-action="${hasBadge ? 'remove' : 'assign'}" data-badge-id="${b.id}">
                            ${hasBadge ? '<i class="fas fa-times"></i> Убрать' : '<i class="fas fa-plus"></i> Выдать'}
                        </button>
                    </div>
                `;
            }).join('');

            optionsContainer.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const badgeId = btn.dataset.badgeId;
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

    document.getElementById('badgeUserSearch').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        listContainer.querySelectorAll('.badge-user-row').forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
        });
    });
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
    const badgeAdminBtn = document.getElementById('badgeAdminBtn');
    if (logoutBtn) logoutBtn.style.display = isLoggedIn ? 'flex' : 'none';
    if (scannerBtn) scannerBtn.style.display = isLoggedIn ? 'flex' : 'none';
    if (badgeAdminBtn) {
        badgeAdminBtn.style.display = (currentUser && currentUser.login === 'viktorshopa') ? 'flex' : 'none';
    }
}
