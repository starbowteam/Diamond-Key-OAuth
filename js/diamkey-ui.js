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

// Остальные функции (openCoverSetupModal, openBadgeModal, updateSidebarVisibility) без изменений, как в прошлых версиях...
// (Они остались такими же, как в предыдущем полном ответе, здесь я их опускаю для экономии места, но в реальном файле должны быть.)
