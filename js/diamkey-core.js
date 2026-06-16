const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ3dyb2twaXplZWxmcmptZ29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTAyMDksImV4cCI6MjA5MjcyNjIwOX0.qtFCGBnpwdQbtmpwSZxI_hH3arq4HBAw62vs5h8WmAk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[m] || m);
}

function showToast(msg) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9999;';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.textContent = msg;
    toast.style.cssText = 'background:rgba(20,20,25,0.95);color:white;padding:12px 24px;border-radius:30px;margin-bottom:10px;backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);';
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

const saved = localStorage.getItem('diamkey_current');
if (saved) try { currentUser = JSON.parse(saved); } catch(e) { console.log('[DiamKey] Ошибка парсинга сохранённой сессии'); }

async function login(login, password) {
    console.log('[DiamKey] Попытка входа:', login);
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error) {
        console.error('[DiamKey] Ошибка входа:', error);
        return { error: 'Ошибка базы данных' };
    }
    if (!user) return { error: 'Неверный логин или пароль' };
    const session = { login: user.login, email: user.email, name: user.name||'', avatar: user.avatar||'', description: user.description||'', created_at: user.created_at };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
    console.log('[DiamKey] Вход успешен:', login);
    return { success: true };
}

async function register(login, password) {
    console.log('[DiamKey] Регистрация:', login);
    if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
    const { data: exist } = await _supabase.from('users').select('login').eq('login', login).maybeSingle();
    if (exist) return { error: 'Логин уже занят' };
    const email = login + '@diamkey.local';
    const { error } = await _supabase.from('users').insert([{ login, email, password, name: '', avatar: '', description: '' }]);
    if (error) {
        console.error('[DiamKey] Ошибка регистрации:', error);
        return { error: error.message };
    }
    const session = { login, email, name: '', avatar: '', description: '', created_at: new Date().toISOString() };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
    console.log('[DiamKey] Регистрация успешна:', login);
    return { success: true };
}

async function loadProfile() {
    if (!currentUser) return;
    const { data } = await _supabase.from('users').select('name, avatar, description, created_at').eq('login', currentUser.login).maybeSingle();
    if (data) {
        currentUser.name = data.name || currentUser.login;
        currentUser.avatar = data.avatar || '';
        currentUser.description = data.description || '';
        currentUser.created_at = data.created_at;
    } else {
        console.warn('[DiamKey] Профиль не найден в базе');
    }
}

async function updateProfile(updates) {
    if (!currentUser) return;
    const { error } = await _supabase.from('users').update(updates).eq('login', currentUser.login);
    if (error) {
        console.error('[DiamKey] Ошибка обновления профиля:', error);
        return;
    }
    if (updates.name) currentUser.name = updates.name;
    if (updates.avatar) currentUser.avatar = updates.avatar;
    if (updates.description) currentUser.description = updates.description;
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function startCipherEffect() {
    const el = document.getElementById('cipherTitle');
    if (!el) return;
    const text = 'DIAMKEY';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let display = text.split('');
    setInterval(() => {
        for (let i = 0; i < display.length; i++) {
            if (Math.random() < 0.05) display[i] = chars[Math.floor(Math.random() * chars.length)];
            else display[i] = text[i];
        }
        el.textContent = display.join('');
    }, 150);
}
startCipherEffect();

let cachedUsers = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60000;
let usersRequestPromise = null;

async function getUsers() {
    if (cachedUsers && Date.now() - cacheTimestamp < CACHE_DURATION) return cachedUsers;
    // Защита от дублирующихся запросов
    if (usersRequestPromise) return usersRequestPromise;

    usersRequestPromise = (async () => {
        try {
            const { data, error } = await _supabase.from('users').select('login, name, avatar, description, created_at').order('login');
            if (error) {
                if (error.code === '20' || error.message?.includes('abort')) {
                    // AbortError — просто вернём кеш или пустой массив
                    console.warn('[DiamKey] AbortError при загрузке пользователей, использую кеш');
                    return cachedUsers || [];
                }
                throw error;
            }
            cachedUsers = data || [];
            cacheTimestamp = Date.now();
            return cachedUsers;
        } catch (e) {
            console.error('[DiamKey] Ошибка загрузки пользователей:', e);
            return [];
        } finally {
            usersRequestPromise = null;
        }
    })();

    return usersRequestPromise;
}

async function loadHomeStats() {
    const results = {};
    try {
        if (currentUser) {
            const gpxRes = await _supabase.from('gpx_files').select('id', { count: 'exact' }).eq('user_login', currentUser.login);
            results.gpxCount = gpxRes.count || 0;
            const wallRes = await _supabase.from('profile_wall').select('id', { count: 'exact' }).eq('profile_login', currentUser.login);
            results.wallCount = wallRes.count || 0;
        }
        const usersCountRes = await _supabase.from('users').select('id', { count: 'exact', head: true });
        results.totalUsers = usersCountRes.count || 0;
    } catch (e) {
        console.error('[DiamKey] Ошибка загрузки статистики:', e);
    }
    return results;
}
