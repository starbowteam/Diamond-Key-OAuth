// diamkey-core.js — ядро DiamKey (друзья, чаты, Supabase)
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

// ---------- АВАТАР (глобальная функция) ----------
function avatarHTML(src, size = 100) {
    const fallbackIcon = `<i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-primary);"></i>`;
    if (!src || !src.trim()) return fallbackIcon;

    return `
        <img src="${escapeHtml(src)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:none;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-primary);"></i>
    `;
}

// ---------- КАПЧА ----------
function generateCaptchaCode() {
    let code = '';
    for (let i = 0; i < 3; i++) {
        code += Math.floor(Math.random() * 10).toString();
    }
    return code;
}

// ---------- ОЦЕНКА СЛОЖНОСТИ ПАРОЛЯ ----------
function evaluatePasswordStrength(password) {
    if (!password || password.length < 6) {
        return { level: 'none', score: 0, label: 'Минимум 6 символов', color: '#e05d5d' };
    }
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) {
        return { level: 'weak', score: 1, label: 'Слабый – попробуйте добавить цифры и заглавные буквы', color: '#e05d5d' };
    } else if (score <= 2) {
        return { level: 'medium', score: 2, label: 'Средний – добавьте спецсимволы для надёжности', color: '#f0ad4e' };
    } else if (score <= 3) {
        return { level: 'strong', score: 3, label: 'Сильный – хорошо, но можно ещё спецсимвол', color: '#5cb85c' };
    } else {
        return { level: 'very-strong', score: 4, label: 'Очень сильный – отлично!', color: '#2ecc71' };
    }
}

async function login(login, password) {
    console.log('[DiamKey] Попытка входа:', login);
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error) {
        console.error('[DiamKey] Ошибка входа:', error);
        return { error: 'Ошибка базы данных' };
    }
    if (!user) return { error: 'Неверный логин или пароль' };
    if (!user.secret_word) {
        const sw = generateFastSecret();
        await _supabase.from('users').update({ secret_word: sw }).eq('login', user.login);
        user.secret_word = sw;
    }
    const session = { login: user.login, email: user.email, name: user.name||'', avatar: user.avatar||'', description: user.description||'', created_at: user.created_at };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
    console.log('[DiamKey] Вход успешен:', login);
    return { success: true };
}

function generateFastSecret() {
    return Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15);
}

function generateToken() {
    const adj = ['golden','silver','mystic','shadow','prime','crystal','onyx','brave','frost'];
    const nouns = ['falcon','tiger','phoenix','dragon','wolf','spark','nexus','core','vault','key'];
    const a = adj[Math.floor(Math.random()*adj.length)];
    const b = nouns[Math.floor(Math.random()*nouns.length)];
    const c = nouns[Math.floor(Math.random()*nouns.length)];
    const num = Math.floor(1000+Math.random()*9000);
    return `diamkey_${a}_${b}_${c}_${num}`;
}

async function register(login, password) {
    console.log('[DiamKey] Регистрация:', login);
    if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
    const { data: exist } = await _supabase.from('users').select('login').eq('login', login).maybeSingle();
    if (exist) return { error: 'Логин уже занят' };
    const email = login + '@diamkey.local';
    const token = generateToken();
    const secretWord = generateFastSecret();
    const defaultDesc = `Я ${login}, пришёл к вам в DiamKey! Надеюсь подружиться!`;
    const { error } = await _supabase.from('users').insert([{
        login, email, password, name: '', avatar: '', description: defaultDesc, token, secret_word: secretWord
    }]);
    if (error) {
        console.error('[DiamKey] Ошибка регистрации:', error);
        return { error: error.message };
    }
    const session = { login, email, name: '', avatar: '', description: defaultDesc, created_at: new Date().toISOString() };
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
    if (usersRequestPromise) return usersRequestPromise;
    usersRequestPromise = (async () => {
        try {
            const { data, error } = await _supabase.from('users').select('login, name, avatar, description, created_at').order('login');
            if (error) throw error;
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

async function getProfile(login) {
    const { data } = await _supabase.from('users').select('name, avatar, description, created_at, cover, cover_pos_x, cover_pos_y, cover_scale').eq('login', login).maybeSingle();
    return data;
}

async function getWall(login) {
    const { data } = await _supabase.from('profile_wall').select('*').eq('profile_login', login).order('created_at', { ascending: false });
    return data || [];
}

async function getGpxFiles(login) {
    const { data } = await _supabase.from('gpx_files').select('*').eq('user_login', login).order('created_at', { ascending: false });
    return data || [];
}

async function getAnnouncement() {
    const { data } = await _supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1);
    return data || [];
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

// ======== БЕЙДЖИ ========
async function getAllBadges() {
    const { data } = await _supabase.from('badges').select('*');
    return data || [];
}

async function getUserBadges(login) {
    const { data } = await _supabase.from('user_badges').select('badge_id, badges(*)').eq('user_login', login);
    return data || [];
}

async function assignBadge(userLogin, badgeId) {
    const existing = await _supabase.from('user_badges').select('id').eq('user_login', userLogin).eq('badge_id', badgeId).maybeSingle();
    if (existing.data) return { error: 'Уже выдан' };
    const { error } = await _supabase.from('user_badges').insert({
        user_login: userLogin,
        badge_id: badgeId,
        assigned_by: currentUser?.login
    });
    return { error };
}

async function removeBadge(userLogin, badgeId) {
    const { error } = await _supabase.from('user_badges').delete().eq('user_login', userLogin).eq('badge_id', badgeId);
    return { error };
}

// ======== ОНЛАЙН-СТАТУС ========
async function updatePresence() {
    if (!currentUser) return;
    await _supabase.from('user_presence').upsert({ login: currentUser.login, last_seen: new Date().toISOString() }, { onConflict: 'login' });
}
setInterval(updatePresence, 30000);
if (currentUser) updatePresence();

async function isUserOnline(login) {
    const { data } = await _supabase.from('user_presence').select('last_seen').eq('login', login).maybeSingle();
    if (!data) return false;
    const diff = Date.now() - new Date(data.last_seen).getTime();
    return diff < 120000;
}

// ======== РЕАКЦИИ НА GPX ========
async function toggleGpxReaction(fileId, type) {
    if (!currentUser) return showToast('Войдите');
    const storageKey = `gpx_reacted_${fileId}`;
    const previousType = localStorage.getItem(storageKey);

    const { data: file, error } = await _supabase.from('gpx_files').select('reactions').eq('id', fileId).maybeSingle();
    if (error || !file) return showToast('Ошибка');
    let reactions = file.reactions || {};

    if (previousType === type) {
        reactions[type] = Math.max((reactions[type] || 0) - 1, 0);
        localStorage.removeItem(storageKey);
    } else {
        if (previousType) {
            reactions[previousType] = Math.max((reactions[previousType] || 0) - 1, 0);
        }
        reactions[type] = (reactions[type] || 0) + 1;
        localStorage.setItem(storageKey, type);
    }

    const { error: updateError } = await _supabase.from('gpx_files').update({ reactions }).eq('id', fileId);
    if (updateError) return showToast('Ошибка');

    if (typeof renderProfileGpxView === 'function' && currentUser) {
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/profile/') && currentPath.endsWith('/gpxview')) {
            const login = currentPath.split('/profile/')[1].split('/gpxview')[0];
            renderProfileGpxView(login);
        }
    }
}

// ======== ДРУЗЬЯ (исправленная версия) ========
function getFriendsStorage() {
    const raw = localStorage.getItem('diamkey_friends');
    return raw ? JSON.parse(raw) : {};
}

function saveFriendsStorage(data) {
    localStorage.setItem('diamkey_friends', JSON.stringify(data));
}

// Устанавливает статус для пары (оба направления)
function setFriendPairStatus(login1, login2, status) {
    const friends = getFriendsStorage();
    if (status === null) {
        delete friends[`${login1}_${login2}`];
        delete friends[`${login2}_${login1}`];
    } else {
        friends[`${login1}_${login2}`] = status;
        friends[`${login2}_${login1}`] = status;
    }
    saveFriendsStorage(friends);
    updateFriendNotificationDot();
}

// Получить статус дружбы между текущим пользователем и target
function getFriendStatus(targetLogin) {
    if (!currentUser) return 'none';
    const friends = getFriendsStorage();
    const key1 = `${currentUser.login}_${targetLogin}`;
    const key2 = `${targetLogin}_${currentUser.login}`;
    const status1 = friends[key1];
    const status2 = friends[key2];
    // accepted в любом направлении
    if (status1 === 'accepted' || status2 === 'accepted') return 'accepted';
    // pending: определяем, кто отправил
    if (status1 === 'pending' && status2 === 'pending') {
        // Если оба pending (маловероятно), считаем как исходящую, если первый ключ наш
        return 'pending_sent'; // или можно проверить, кто раньше, но пока так
    }
    if (status1 === 'pending') return 'pending_sent'; // мы отправили
    if (status2 === 'pending') return 'pending_received'; // нам отправили
    return 'none';
}

// Отправить заявку
function sendFriendRequest(targetLogin) {
    if (!currentUser) return;
    setFriendPairStatus(currentUser.login, targetLogin, 'pending');
}

// Принять заявку от fromLogin
function acceptFriendRequest(fromLogin) {
    if (!currentUser) return;
    setFriendPairStatus(currentUser.login, fromLogin, 'accepted');
}

// Отклонить заявку (просто удаляем pending)
function rejectFriendRequest(fromLogin) {
    if (!currentUser) return;
    const status = getFriendStatus(fromLogin);
    if (status === 'pending_received') {
        setFriendPairStatus(currentUser.login, fromLogin, null);
    }
}

// Удалить из друзей (или отменить заявку)
function removeFriend(targetLogin) {
    if (!currentUser) return;
    setFriendPairStatus(currentUser.login, targetLogin, null);
}

// Получить список друзей (accepted)
function getFriendsList() {
    if (!currentUser) return [];
    const friends = getFriendsStorage();
    const list = [];
    for (const [key, status] of Object.entries(friends)) {
        if (status !== 'accepted') continue;
        const [a, b] = key.split('_');
        if (a === currentUser.login) list.push(b);
        else if (b === currentUser.login) list.push(a);
    }
    return [...new Set(list)];
}

// Получить список входящих заявок (от кого pending к нам)
function getIncomingRequests() {
    if (!currentUser) return [];
    const friends = getFriendsStorage();
    const requests = [];
    for (const [key, status] of Object.entries(friends)) {
        if (status !== 'pending') continue;
        const [a, b] = key.split('_');
        if (b === currentUser.login) requests.push(a); // нам отправили (ключ a_b, где b - мы)
        // также если a === currentUser.login и статус pending, это исходящая, не входящая
    }
    return [...new Set(requests)];
}

// Получить список исходящих заявок (кому мы отправили pending)
function getOutgoingRequests() {
    if (!currentUser) return [];
    const friends = getFriendsStorage();
    const requests = [];
    for (const [key, status] of Object.entries(friends)) {
        if (status !== 'pending') continue;
        const [a, b] = key.split('_');
        if (a === currentUser.login) requests.push(b); // мы отправили (ключ a_b, где a - мы)
    }
    return [...new Set(requests)];
}

// Обновление красной точки на иконке "Пользователи"
function updateFriendNotificationDot() {
    const usersIcon = document.querySelector('.sidebar-icon[href="/users"]');
    if (!usersIcon) return;
    const dot = usersIcon.querySelector('.badge-dot');
    const incoming = getIncomingRequests();
    if (incoming.length > 0) {
        if (!dot) {
            const newDot = document.createElement('span');
            newDot.className = 'badge-dot';
            newDot.style.display = 'block';
            usersIcon.appendChild(newDot);
        } else {
            dot.style.display = 'block';
        }
    } else {
        if (dot) dot.style.display = 'none';
    }
}

// Инициализация точки при загрузке
document.addEventListener('DOMContentLoaded', updateFriendNotificationDot);

// ======== СИСТЕМНОЕ СООБЩЕНИЕ ДЛЯ ЧАТОВ ========
function getSystemMessage(contactLogin) {
    return {
        from: 'system',
        text: `Это ваш чат с ${escapeHtml(contactLogin)}! Можете начинать свое общение.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
}
