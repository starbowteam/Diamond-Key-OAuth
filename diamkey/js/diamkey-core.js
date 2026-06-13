// ==================== DIAMKEY CORE – авторизация и общие функции ====================
const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ3dyb2twaXplZWxmcmptZ29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTAyMDksImV4cCI6MjA5MjcyNjIwOX0.qtFCGBnpwdQbtmpwSZxI_hH3arq4HBAw62vs5h8WmAk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// Утилиты
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[m] || m); }
function showToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }

// Проверка сессии
const saved = localStorage.getItem('diamkey_current');
if (saved) try { currentUser = JSON.parse(saved); } catch(e) {}

// Авторизация
async function login(login, password) {
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error || !user) return { error: 'Неверный логин или пароль' };
    const sessionUser = { login: user.login, email: user.email, secretWord: user.secret_word, name: user.name||'', avatar: user.avatar||'' };
    localStorage.setItem('diamkey_current', JSON.stringify(sessionUser));
    currentUser = sessionUser;
    return { success: true };
}

async function register(login, password) {
    if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
    const { data: exist } = await _supabase.from('users').select('login').eq('login', login).maybeSingle();
    if (exist) return { error: 'Логин уже занят' };
    const email = login + '@diamkey.local';
    const { error } = await _supabase.from('users').insert([{ login, email, password, name: '', avatar: '' }]);
    if (error) return { error: error.message };
    const sessionUser = { login, email, name: '', avatar: '' };
    localStorage.setItem('diamkey_current', JSON.stringify(sessionUser));
    currentUser = sessionUser;
    return { success: true };
}

function logout() {
    currentUser = null;
    localStorage.removeItem('diamkey_current');
    window.location.reload();
}

// Загрузка профиля
async function loadProfile() {
    if (!currentUser) return null;
    const { data } = await _supabase.from('users').select('name, avatar, description').eq('login', currentUser.login).maybeSingle();
    if (data) {
        currentUser.name = data.name || currentUser.login;
        currentUser.avatar = data.avatar || '';
        currentUser.description = data.description || '';
    }
    return currentUser;
}

// Обновление профиля (аватар/пароль)
async function updateProfile(updates) {
    if (!currentUser) return;
    await _supabase.from('users').update(updates).eq('login', currentUser.login);
    if (updates.avatar) currentUser.avatar = updates.avatar;
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
}

// Показать модалку авторизации
function showAuthModal() {
    const modal = document.getElementById('authModal');
    const content = document.getElementById('authModalContent');
    modal.style.display = 'flex';
    content.innerHTML = `
        <h3>Вход / Регистрация</h3>
        <input id="authLogin" placeholder="Логин">
        <input id="authPassword" type="password" placeholder="Пароль">
        <button class="btn" id="authLoginBtn">Войти</button>
        <button class="btn" id="authRegisterBtn">Зарегистрироваться</button>
        <p class="text-muted" style="margin-top: 8px; cursor: pointer;" onclick="document.getElementById('authModal').style.display='none'">Закрыть</p>
    `;
    document.getElementById('authLoginBtn').onclick = async () => {
        const res = await login(document.getElementById('authLogin').value, document.getElementById('authPassword').value);
        if (res.error) return showToast(res.error);
        modal.style.display = 'none';
        location.reload();
    };
    document.getElementById('authRegisterBtn').onclick = async () => {
        const res = await register(document.getElementById('authLogin').value, document.getElementById('authPassword').value);
        if (res.error) return showToast(res.error);
        modal.style.display = 'none';
        location.reload();
    };
}