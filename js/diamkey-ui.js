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

function openCoverSetupModal(profile) {
    const modal = document.getElementById('coverSetupModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');

    const tabs = modal.querySelectorAll('[data-cover-tab]');
    const tabGradients = document.getElementById('coverGradients');
    const tabColors = document.getElementById('coverColors');
    const tabUpload = document.getElementById('coverUpload');
    const saveBtn = document.getElementById('saveCoverSetupBtn');
    const cancelBtn = document.getElementById('cancelCoverSetupBtn');
    let selectedCover = null;
    let currentImageSrc = '';
    let posX = profile.cover_pos_x || 0;
    let posY = profile.cover_pos_y || 0;
    let scale = profile.cover_scale || 1;

    // Сброс всех состояний при открытии
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    // Активируем первую вкладку (градиенты) по умолчанию
    const firstTab = modal.querySelector('[data-cover-tab="gradients"]');
    if (firstTab) firstTab.classList.add('active');
    if (tabGradients) tabGradients.style.display = 'grid';
    if (tabColors) tabColors.style.display = 'none';
    if (tabUpload) tabUpload.style.display = 'none';

    // Удаляем старые обработчики, клонируя элементы, чтобы избежать дублирования
    tabs.forEach(tab => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
    });
    // Заново получаем свежие копии вкладок
    const freshTabs = modal.querySelectorAll('[data-cover-tab]');
    freshTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            freshTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            const tabName = this.dataset.coverTab;
            if (tabGradients) tabGradients.style.display = tabName === 'gradients' ? 'grid' : 'none';
            if (tabColors) tabColors.style.display = tabName === 'colors' ? 'grid' : 'none';
            if (tabUpload) tabUpload.style.display = tabName === 'upload' ? 'block' : 'none';
        });
    });

    // Обработчики выбора обложки (градиенты / цвета)
    modal.querySelectorAll('.cover-option').forEach(opt => {
        opt.addEventListener('click', function() {
            modal.querySelectorAll('.cover-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            selectedCover = this.dataset.cover;
        });
    });

    const uploadBtn = document.getElementById('coverUploadBtn');
    const fileInput = document.getElementById('coverFileInput');
    const previewContainer = document.getElementById('coverPreviewContainer');
    const previewImage = document.getElementById('coverPreviewImage');
    const scaleSlider = document.getElementById('coverScaleSlider');

    if (uploadBtn) uploadBtn.onclick = () => fileInput.click();
    if (fileInput) {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentImageSrc = ev.target.result;
                previewImage.src = currentImageSrc;
                posX = 0; posY = 0; scale = 1;
                applyPreviewTransform();
            };
            reader.readAsDataURL(file);
        };
    }

    function applyPreviewTransform() {
        if (!previewImage) return;
        previewImage.style.transform = `translate(-50%, -50%) translate(${posX}%, ${posY}%) scale(${scale})`;
        if (scaleSlider) scaleSlider.value = scale;
    }

    // Drag внутри preview
    if (previewContainer) {
        let dragging = false, startX, startY, startPosX, startPosY;
        previewContainer.onmousedown = function(e) {
            dragging = true;
            startX = e.clientX;
            startY = e.clientY;
            startPosX = posX;
            startPosY = posY;
            e.preventDefault();
        };
        window.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            const rect = previewContainer.getBoundingClientRect();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const percentX = (dx / rect.width) * 100;
            const percentY = (dy / rect.height) * 100;
            posX = startPosX + percentX;
            posY = startPosY + percentY;
            applyPreviewTransform();
        });
        window.addEventListener('mouseup', function() {
            dragging = false;
        });
        previewContainer.ontouchstart = function(e) {
            if (e.touches.length === 1) {
                dragging = true;
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startPosX = posX;
                startPosY = posY;
            }
        };
        window.addEventListener('touchmove', function(e) {
            if (!dragging) return;
            const rect = previewContainer.getBoundingClientRect();
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            const percentX = (dx / rect.width) * 100;
            const percentY = (dy / rect.height) * 100;
            posX = startPosX + percentX;
            posY = startPosY + percentY;
            applyPreviewTransform();
            e.preventDefault();
        }, { passive: false });
        window.addEventListener('touchend', function() {
            dragging = false;
        });
    }

    if (scaleSlider) {
        scaleSlider.oninput = function() {
            scale = parseFloat(this.value);
            applyPreviewTransform();
        };
    }

    if (saveBtn) {
        saveBtn.onclick = async function() {
            if (selectedCover) {
                await updateProfile({ cover: selectedCover, cover_pos_x: 0, cover_pos_y: 0, cover_scale: 1 });
                currentUser.cover = selectedCover;
                currentUser.cover_pos_x = 0;
                currentUser.cover_pos_y = 0;
                currentUser.cover_scale = 1;
            } else if (currentImageSrc) {
                const coverValue = 'image:' + currentImageSrc;
                await updateProfile({ cover: coverValue, cover_pos_x: posX, cover_pos_y: posY, cover_scale: scale });
                currentUser.cover = coverValue;
                currentUser.cover_pos_x = posX;
                currentUser.cover_pos_y = posY;
                currentUser.cover_scale = scale;
            } else {
                showToast('Выберите обложку');
                return;
            }
            closeModal('coverSetupModal');
            if (document.getElementById('page-profile').classList.contains('active')) renderMyProfile();
            showToast('Обложка обновлена');
        };
    }

    if (cancelBtn) {
        cancelBtn.onclick = function() {
            closeModal('coverSetupModal');
        };
    }

    modal.addEventListener('click', function(e) {
        if (e.target === modal) closeModal('coverSetupModal');
    });

    // Если у пользователя уже есть кастомное изображение, показать его и переключиться на вкладку загрузки
    if (profile.cover && profile.cover.startsWith('image:')) {
        currentImageSrc = profile.cover.replace('image:', '');
        if (previewImage) {
            previewImage.src = currentImageSrc;
            applyPreviewTransform();
        }
        const uploadTab = modal.querySelector('[data-cover-tab="upload"]');
        if (uploadTab) uploadTab.click();
    }
}

function openCoverModal() {
    if (currentUser) openCoverSetupModal(currentUser);
}

async function openBadgeModal() {
    const modal = document.getElementById('badgeModal');
    if (!modal) return;
    modal.style.display = 'flex';
    modal.classList.add('active');

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
                const action = hasBadge ? 'remove' : 'assign';
                const btnClass = hasBadge ? 'remove' : 'assign';
                const icon = hasBadge ? 'fa-times' : 'fa-plus';
                const label = hasBadge ? 'Убрать' : 'Выдать';
                return `
                    <div class="badge-option-card" data-badge-id="${b.id}">
                        <div class="badge-icon-large"><i class="fas ${b.icon}" style="background:${b.gradient}; -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></i></div>
                        <span class="badge-name">${escapeHtml(b.name)}</span>
                        <button class="${btnClass}" data-action="${action}" data-badge-id="${b.id}">
                            <i class="fas ${icon}"></i> ${label}
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
                    const card = btn.closest('.badge-option-card');
                    const newAction = action === 'assign' ? 'remove' : 'assign';
                    const newClass = newAction === 'remove' ? 'remove' : 'assign';
                    const newIcon = newAction === 'remove' ? 'fa-times' : 'fa-plus';
                    const newLabel = newAction === 'remove' ? 'Убрать' : 'Выдать';
                    btn.dataset.action = newAction;
                    btn.className = newClass;
                    btn.innerHTML = `<i class="fas ${newIcon}"></i> ${newLabel}`;
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
