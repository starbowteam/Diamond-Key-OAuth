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

    const loginIdentity = document.getElementById('loginIdentity');
    const regLoginInput = document.getElementById('regLoginInput');

    if (loginIdentity) {
        loginIdentity.setAttribute('maxlength', '20');
        loginIdentity.addEventListener('input', function() {
            this.value = this.value.replace(/\s/g, '').substring(0, 20);
        });
    }
    if (regLoginInput) {
        regLoginInput.setAttribute('maxlength', '20');
        regLoginInput.addEventListener('input', function() {
            this.value = this.value.replace(/\s/g, '').substring(0, 20);
        });
    }

    const regPasswordInput = document.getElementById('regPasswordInput');
    const regPasswordConfirm = document.getElementById('regPasswordConfirm');
    let strengthDiv = null;

    if (regPasswordInput) {
        strengthDiv = document.createElement('div');
        strengthDiv.className = 'password-strength';
        strengthDiv.innerHTML = '<div class="strength-bar"><div class="strength-fill"></div></div><div class="strength-text"></div>';
        regPasswordInput.parentNode.insertBefore(strengthDiv, regPasswordInput.nextSibling);

        regPasswordInput.addEventListener('input', function() {
            const strength = evaluatePasswordStrength(this.value);
            const fill = strengthDiv.querySelector('.strength-fill');
            const text = strengthDiv.querySelector('.strength-text');
            fill.style.width = (strength.score * 25) + '%';
            fill.style.backgroundColor = strength.color;
            text.textContent = strength.label;
            text.style.color = strength.color;
        });
    }

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
        const loginVal = document.getElementById('loginIdentity').value.trim();
        const passwordVal = document.getElementById('loginPassword').value;
        if (!loginVal || !passwordVal) return showToast('Введите логин и пароль');

        const res = await login(loginVal, passwordVal);
        if (res.error) return showToast(res.error);

        showCaptchaModal(() => {
            closeModal('loginModal');
            smoothLoginSuccess();
        });
    });

    document.getElementById('doRegisterBtn')?.addEventListener('click', async () => {
        const loginVal = regLoginInput.value.trim();
        const pass1 = regPasswordInput.value;
        const pass2 = regPasswordConfirm.value;
        if (!loginVal || !pass1 || !pass2) return showToast('Заполните все поля');
        if (pass1 !== pass2) return showToast('Пароли не совпадают');

        const strength = evaluatePasswordStrength(pass1);
        if (strength.score < 2) return showToast('Пароль слишком слабый. Следуйте подсказкам.');

        showCaptchaModal(async () => {
            const res = await register(loginVal, pass1);
            if (res.error) {
                showToast(res.error);
                return;
            }
            closeModal('loginModal');
            smoothLoginSuccess();
        });
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

function showCaptchaModal(onSuccess) {
    const old = document.getElementById('captchaModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'captchaModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.classList.add('active');

    let captchaCode = generateCaptchaCode();
    let timerSeconds = 15;
    let timerInterval = null;

    modal.innerHTML = `
        <div class="modal-content glass-panel" onclick="event.stopPropagation()" style="max-width:400px;">
            <h3><i class="fas fa-shield-alt"></i> Подтверждение входа</h3>
            <p>Введите три цифры:</p>
            <div class="captcha-display">${captchaCode}</div>
            <input type="text" id="captchaInput" placeholder="Цифры" maxlength="3" style="font-size:24px; text-align:center; letter-spacing:4px;">
            <div class="captcha-timer">
                <div class="captcha-timer-bar"><div class="captcha-timer-fill"></div></div>
                <span id="captchaTimerSeconds">${timerSeconds} сек</span>
            </div>
            <button class="btn btn-primary" id="submitCaptchaBtn" style="margin-top:16px;">Подтвердить</button>
            <p class="error-msg" id="captchaError" style="display:none;"></p>
        </div>
    `;
    document.body.appendChild(modal);

    const input = document.getElementById('captchaInput');
    const submitBtn = document.getElementById('submitCaptchaBtn');
    const errorEl = document.getElementById('captchaError');
    const timerFill = modal.querySelector('.captcha-timer-fill');
    const timerSecondsEl = document.getElementById('captchaTimerSeconds');

    function updateTimer() {
        timerSeconds--;
        if (timerSeconds <= 0) {
            clearInterval(timerInterval);
            captchaCode = generateCaptchaCode();
            timerSeconds = 15;
            modal.querySelector('.captcha-display').textContent = captchaCode;
            timerSecondsEl.textContent = timerSeconds + ' сек';
            timerFill.style.width = '100%';
            startTimer();
        } else {
            const percent = (timerSeconds / 15) * 100;
            timerFill.style.width = percent + '%';
            timerSecondsEl.textContent = timerSeconds + ' сек';
        }
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(updateTimer, 1000);
    }
    startTimer();

    submitBtn.addEventListener('click', () => {
        const userInput = input.value.trim();
        if (userInput === captchaCode) {
            clearInterval(timerInterval);
            modal.remove();
            onSuccess();
        } else {
            errorEl.textContent = 'Неверно, попробуйте снова';
            errorEl.style.display = 'block';
            captchaCode = generateCaptchaCode();
            timerSeconds = 15;
            modal.querySelector('.captcha-display').textContent = captchaCode;
            timerSecondsEl.textContent = timerSeconds + ' сек';
            timerFill.style.width = '100%';
            input.value = '';
            startTimer();
        }
    });

    input.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').substring(0, 3);
    });

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            clearInterval(timerInterval);
            modal.remove();
        }
    });
}

function openCoverSetupModal(profile) {
    const container = document.getElementById('coverSetupModalContainer');
    container.innerHTML = '';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'coverSetupModalDynamic';
    modal.style.display = 'flex';
    modal.onclick = function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    };

    modal.innerHTML = `
        <div class="modal-content glass-panel cover-setup-modal" onclick="event.stopPropagation()">
            <h3><i class="fas fa-image"></i> Настроить обложку</h3>
            <div class="auth-tabs" id="coverTabs">
                <button class="auth-tab active" data-tab="gradients">Градиенты</button>
                <button class="auth-tab" data-tab="colors">Цвета</button>
                <button class="auth-tab" data-tab="upload">Загрузить</button>
            </div>

            <div id="coverGradients" class="cover-options-grid" style="display:grid;">
                <div class="cover-option" style="background:linear-gradient(135deg, #2a2a35 0%, #1a1a22 100%);" data-cover="gradient:#2a2a35:#1a1a22"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #1e3c5c 0%, #0f1e33 100%);" data-cover="gradient:#1e3c5c:#0f1e33"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #2d4a3e 0%, #1a2e24 100%);" data-cover="gradient:#2d4a3e:#1a2e24"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #4a2d4a 0%, #2e1a2e 100%);" data-cover="gradient:#4a2d4a:#2e1a2e"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #3d2d4a 0%, #241a2e 100%);" data-cover="gradient:#3d2d4a:#241a2e"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #4a3d2d 0%, #2e241a 100%);" data-cover="gradient:#4a3d2d:#2e241a"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #2d4a4a 0%, #1a2e2e 100%);" data-cover="gradient:#2d4a4a:#1a2e2e"></div>
                <div class="cover-option" style="background:linear-gradient(135deg, #4a2d3d 0%, #2e1a24 100%);" data-cover="gradient:#4a2d3d:#2e1a24"></div>
            </div>

            <div id="coverColors" class="cover-options-grid" style="display:none;">
                <div class="cover-option" style="background:#1a1a2e;" data-cover="color:#1a1a2e"></div>
                <div class="cover-option" style="background:#2d2d44;" data-cover="color:#2d2d44"></div>
                <div class="cover-option" style="background:#16213e;" data-cover="color:#16213e"></div>
                <div class="cover-option" style="background:#0f3460;" data-cover="color:#0f3460"></div>
                <div class="cover-option" style="background:#533483;" data-cover="color:#533483"></div>
                <div class="cover-option" style="background:#e94560;" data-cover="color:#e94560"></div>
                <div class="cover-option" style="background:#1a3a3a;" data-cover="color:#1a3a3a"></div>
                <div class="cover-option" style="background:#3a1a3a;" data-cover="color:#3a1a3a"></div>
            </div>

            <div id="coverUpload" style="display:none;">
                <div class="cover-preview-container" id="coverPreviewContainer">
                    <img id="coverPreviewImage" src="" alt="Preview" draggable="false" style="position:absolute; top:50%; left:50%; transform-origin:center; height:100%; width:auto; min-width:100%;">
                </div>
                <div class="cover-controls">
                    <i class="fas fa-search-minus"></i>
                    <input type="range" id="coverScaleSlider" min="0.5" max="2" step="0.01" value="1">
                    <i class="fas fa-search-plus"></i>
                </div>
                <button class="btn btn-icon" id="coverUploadBtn"><i class="fas fa-upload"></i> Выбрать изображение</button>
            </div>

            <div style="margin-top:20px; display:flex; gap:12px; justify-content:center;">
                <button class="btn btn-primary" id="saveCoverBtn"><i class="fas fa-check"></i> Сохранить</button>
                <button class="btn btn-secondary" id="cancelCoverBtn">Отмена</button>
            </div>
            <input type="file" id="coverFileInput" accept="image/*" style="display:none;">
        </div>
    `;

    container.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    const tabs = modal.querySelectorAll('#coverTabs .auth-tab');
    const gradientDiv = modal.querySelector('#coverGradients');
    const colorsDiv = modal.querySelector('#coverColors');
    const uploadDiv = modal.querySelector('#coverUpload');
    const saveBtn = modal.querySelector('#saveCoverBtn');
    const cancelBtn = modal.querySelector('#cancelCoverBtn');
    const fileInput = modal.querySelector('#coverFileInput');
    const previewImage = modal.querySelector('#coverPreviewImage');
    const previewContainer = modal.querySelector('#coverPreviewContainer');
    const scaleSlider = modal.querySelector('#coverScaleSlider');
    const uploadBtn = modal.querySelector('#coverUploadBtn');

    let selectedCover = null;
    let currentImageSrc = '';
    let posX = profile.cover_pos_x || 0;
    let posY = profile.cover_pos_y || 0;
    let scale = profile.cover_scale || 1;

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            gradientDiv.style.display = tabName === 'gradients' ? 'grid' : 'none';
            colorsDiv.style.display = tabName === 'colors' ? 'grid' : 'none';
            uploadDiv.style.display = tabName === 'upload' ? 'block' : 'none';
        });
    });

    modal.querySelectorAll('.cover-option').forEach(opt => {
        opt.addEventListener('click', function() {
            modal.querySelectorAll('.cover-option').forEach(o => o.classList.remove('selected'));
            this.classList.add('selected');
            selectedCover = this.dataset.cover;
        });
    });

    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
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
    });

    function applyPreviewTransform() {
        previewImage.style.transform = `translate(-50%, -50%) translate(${posX}%, ${posY}%) scale(${scale})`;
        scaleSlider.value = scale;
    }

    let dragging = false, startX, startY, startPosX, startPosY;
    previewContainer.addEventListener('mousedown', (e) => {
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startPosX = posX;
        startPosY = posY;
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
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
    window.addEventListener('mouseup', () => { dragging = false; });
    previewContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            dragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            startPosX = posX;
            startPosY = posY;
        }
    });
    window.addEventListener('touchmove', (e) => {
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
    window.addEventListener('touchend', () => { dragging = false; });

    scaleSlider.addEventListener('input', () => {
        scale = parseFloat(scaleSlider.value);
        applyPreviewTransform();
    });

    saveBtn.addEventListener('click', async () => {
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
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
        if (document.getElementById('page-profile').classList.contains('active')) renderMyProfile();
        showToast('Обложка обновлена');
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    });

    if (profile.cover && profile.cover.startsWith('image:')) {
        currentImageSrc = profile.cover.replace('image:', '');
        previewImage.src = currentImageSrc;
        applyPreviewTransform();
        const uploadTab = modal.querySelector('[data-tab="upload"]');
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

// 61321
