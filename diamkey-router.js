// ==================== DIAMKEY ROUTER — маршрутизация и инициализация ====================

// Сопоставление путей с функциями отрисовки
const routes = {
  '/': renderHomePage,
  '/profile': renderProfilePage,
  '/subscription': renderSubscriptionPage,
  '/docs': renderDocsPage,
  '/admin': renderAdminPage,
};

// Динамический путь для публичного профиля /@username
function matchRoute(path) {
  if (routes[path]) return routes[path];
  if (path.startsWith('/@')) {
    const username = path.substring(2);
    return () => renderProfilePage(username);
  }
  return null;
}

// Главная страница (вход/регистрация)
function renderHomePage() {
  const page = document.getElementById('pageContent');
  if (!page) return;
  page.innerHTML = `
    <div class="hero">
      <h1>DiamKey</h1>
      <p>Единый ключ ко всем сервисам Diamond</p>
    </div>
    <div class="auth-tabs">
      <button class="btn auth-tab active" id="tabLogin">Вход</button>
      <button class="btn auth-tab" id="tabRegister">Регистрация</button>
    </div>
    <div id="authForms">
      <div id="loginForm">
        <div class="input-group">
          <label>Логин</label>
          <input type="text" id="loginInput" placeholder="Введите логин">
        </div>
        <div class="input-group">
          <label>Пароль</label>
          <input type="password" id="loginPassword" placeholder="········">
        </div>
        <button class="btn btn-primary" id="doLogin">Войти</button>
      </div>
      <div id="registerForm" style="display:none;">
        <div class="input-group">
          <label>Логин</label>
          <input type="text" id="regLogin" placeholder="Придумайте логин">
        </div>
        <div class="input-group">
          <label>Пароль</label>
          <input type="password" id="regPassword" placeholder="Минимум 6 символов">
        </div>
        <button class="btn btn-primary" id="doRegister">Создать</button>
      </div>
    </div>
  `;

  // Переключение вкладок
  document.getElementById('tabLogin').addEventListener('click', () => {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabRegister').classList.remove('active');
  });
  document.getElementById('tabRegister').addEventListener('click', () => {
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('tabRegister').classList.add('active');
    document.getElementById('tabLogin').classList.remove('active');
  });

  // Действия
  document.getElementById('doLogin').addEventListener('click', () => {
    const login = document.getElementById('loginInput').value.trim();
    const pass = document.getElementById('loginPassword').value;
    login(login, pass);
  });
  document.getElementById('doRegister').addEventListener('click', () => {
    const login = document.getElementById('regLogin').value.trim();
    const pass = document.getElementById('regPassword').value;
    register(login, pass);
  });
}

// Страница профиля (личный или публичный)
function renderProfilePage(username = null) {
  if (username || (currentUser && !window.location.search.includes('edit'))) {
    renderProfile(username);
  } else if (currentUser && window.location.search.includes('edit')) {
    renderProfileEdit();
  } else {
    document.getElementById('pageContent').innerHTML = '<p>Пожалуйста, войдите</p>';
  }
}

function renderProfileEdit() {
  const page = document.getElementById('pageContent');
  page.innerHTML = `
    <h2>Редактирование профиля</h2>
    <div class="input-group"><label>Статус</label><input id="editStatus" value="${escapeHtml(currentUser.status_text || '')}"></div>
    <div class="input-group"><label>Рамка аватара</label>
      <select id="editFrame">
        <option value="default">Обычная</option>
        <option value="gold">Золотая</option>
        <option value="silver">Серебряная</option>
        <option value="neon">Неоновая</option>
      </select>
    </div>
    <button class="btn btn-primary" id="saveProfile">Сохранить</button>
  `;
  document.getElementById('saveProfile').addEventListener('click', async () => {
    const status = document.getElementById('editStatus').value;
    const frame = document.getElementById('editFrame').value;
    await _supabase.from('users').update({ status_text: status, avatar_frame: frame }).eq('login', currentUser.login);
    currentUser.status_text = status;
    currentUser.avatar_frame = frame;
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
    navigate('/profile');
  });
}

// Страница документов
async function renderDocsPage() {
  const page = document.getElementById('pageContent');
  if (!currentUser) {
    page.innerHTML = '<p>Войдите для доступа к документам</p>';
    return;
  }
  const { data } = await _supabase.from('knowledge_docs').select('*').eq('user_login', currentUser.login);
  page.innerHTML = `
    <h2>Мои документы</h2>
    ${data?.length ? data.map(d => `<div class="card">${escapeHtml(d.title)}</div>`).join('') : '<p>Нет документов</p>'}
  `;
}

// Навигация
function navigate(path) {
  history.pushState(null, '', path);
  handleRoute();
}

function handleRoute() {
  const path = window.location.pathname;
  const route = matchRoute(path);
  if (route) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('pageContent').classList.add('active');
    route();
  } else {
    document.getElementById('pageContent').innerHTML = '<h2>404 — Страница не найдена</h2>';
  }
}

// Бургер-меню
document.getElementById('burgerMenu').addEventListener('click', () => {
  document.getElementById('navLinks').classList.toggle('active');
});

// Инициализация приложения
(async function() {
  const saved = localStorage.getItem('diamkey_current');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      updateAuthUI();
    } catch(e) {
      currentUser = null;
    }
  }

  // Обработка переходов
  window.addEventListener('popstate', handleRoute);
  handleRoute();

  // Запускаем сервисы (статусы, уведомления)
  initServices();
})();