document.addEventListener('DOMContentLoaded', () => {
    const authScreen = document.getElementById('authScreen');
    const appShell = document.getElementById('appShell');

    // Переключение табов входа/регистрации
    document.getElementById('tabLogin').addEventListener('click', () => {
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('tabRegister').classList.remove('active');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    });
    document.getElementById('tabRegister').addEventListener('click', () => {
        document.getElementById('tabRegister').classList.add('active');
        document.getElementById('tabLogin').classList.remove('active');
        document.getElementById('registerForm').style.display = 'block';
        document.getElementById('loginForm').style.display = 'none';
    });

    // OAuth ссылка
    document.getElementById('oauthLink').addEventListener('click', (e) => { e.preventDefault(); redirectToOAuth(); });

    // Локальный вход
    document.getElementById('doLoginBtn').addEventListener('click', async () => {
        const res = await login(document.getElementById('loginIdentity').value.trim(), document.getElementById('loginPassword').value);
        if (res.error) return showToast(res.error);
        authScreen.style.display = 'none';
        appShell.style.display = 'flex';
        initApp();
    });
    document.getElementById('doRegisterBtn').addEventListener('click', async () => {
        const res = await register(document.getElementById('regLogin').value.trim(), document.getElementById('regPassword').value);
        if (res.error) return showToast(res.error);
        authScreen.style.display = 'none';
        appShell.style.display = 'flex';
        initApp();
    });

    // Если уже авторизован – сразу показываем основной интерфейс
    if (currentUser) {
        authScreen.style.display = 'none';
        appShell.style.display = 'flex';
        initApp();
    }

    // Сайдбар
    document.querySelectorAll('.sidebar-icon').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.tagName === 'A') return;
            e.preventDefault();
            document.querySelectorAll('.sidebar-icon').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
        });
    });

    // Кнопка выхода (показываем модалку)
    document.getElementById('logoutBtn').addEventListener('click', () => {
        document.getElementById('logoutModal').style.display = 'flex';
    });
    document.getElementById('confirmLogoutBtn').addEventListener('click', () => {
        localStorage.removeItem('diamkey_current');
        currentUser = null;
        window.location.reload();
    });
});

async function initApp() {
    await loadProfile();
    loadWall();
    initGPX();
    renderProfile();
    loadSettings();
}

// Смена языка (сохраняется в localStorage)
function setLanguage(lang) {
    localStorage.setItem('diamkey_lang', lang);
    // Простейшая реализация: можно расширить
    showToast('Язык изменён (обновите страницу)');
}
