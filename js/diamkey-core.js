// diamkey-core.js — ядро DiamKey (без друзей, чаты, Supabase)
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

function avatarHTML(src, size = 100) {
    const fallbackIcon = `<i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-primary);"></i>`;
    if (!src || !src.trim()) return fallbackIcon;
    return `
        <img src="${escapeHtml(src)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <i class="fas fa-user" style="font-size:${size * 0.6}px;color:var(--text-muted);width:${size}px;height:${size}px;display:none;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-primary);"></i>
    `;
}

function generateCaptchaCode() { return (Math.floor(100 + Math.random() * 900)).toString(); }

function evaluatePasswordStrength(password) {
    if (!password || password.length < 6) return { level: 'none', score: 0, label: 'Минимум 6 символов', color: '#e05d5d' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 'weak', score: 1, label: 'Слабый', color: '#e05d5d' };
    if (score <= 2) return { level: 'medium', score: 2, label: 'Средний', color: '#f0ad4e' };
    if (score <= 3) return { level: 'strong', score: 3, label: 'Сильный', color: '#5cb85c' };
    return { level: 'very-strong', score: 4, label: 'Очень сильный', color: '#2ecc71' };
}

async function login(login, password) {
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error || !user) return { error: 'Неверный логин или пароль' };
    if (!user.secret_word) {
        const sw = generateFastSecret();
        await _supabase.from('users').update({ secret_word: sw }).eq('login', user.login);
        user.secret_word = sw;
    }
    const session = { login: user.login, email: user.email, name: user.name||'', avatar: user.avatar||'', description: user.description||'', created_at: user.created_at };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
    return { success: true };
}

function generateFastSecret() { return Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15); }
function generateToken() {
    const adj = ['golden','silver','mystic','shadow','prime','crystal','onyx','brave','frost'];
    const nouns = ['falcon','tiger','phoenix','dragon','wolf','spark','nexus','core','vault','key'];
    return `diamkey_${adj[Math.floor(Math.random()*adj.length)]}_${nouns[Math.floor(Math.random()*nouns.length)]}_${nouns[Math.floor(Math.random()*nouns.length)]}_${Math.floor(1000+Math.random()*9000)}`;
}

async function register(login, password) {
    if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
    const { data: exist } = await _supabase.from('users').select('login').eq('login', login).maybeSingle();
    if (exist) return { error: 'Логин уже занят' };
    const email = login + '@diamkey.local';
    const token = generateToken();
    const secretWord = generateFastSecret();
    const defaultDesc = `Я ${login}, пришёл к вам в DiamKey! Надеюсь подружиться!`;
    const { error } = await _supabase.from('users').insert([{ login, email, password, name: '', avatar: '', description: defaultDesc, token, secret_word: secretWord }]);
    if (error) return { error: error.message };
    const session = { login, email, name: '', avatar: '', description: defaultDesc, created_at: new Date().toISOString() };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
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
    }
}

async function updateProfile(updates) {
    if (!currentUser) return;
    const { error } = await _supabase.from('users').update(updates).eq('login', currentUser.login);
    if (!error) {
        if (updates.name) currentUser.name = updates.name;
        if (updates.avatar) currentUser.avatar = updates.avatar;
        if (updates.description) currentUser.description = updates.description;
        localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
    }
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
    setInterval(() => {
        for (let i = 0; i < text.length; i++) {
            if (Math.random() < 0.05) el.textContent = text.substring(0,i) + chars[Math.floor(Math.random()*chars.length)] + text.substring(i+1);
            else el.textContent = text;
        }
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
        } catch (e) { return []; }
        finally { usersRequestPromise = null; }
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

// Статистика для главной (рабочая)
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

async function getAllBadges() {
    const { data } = await _supabase.from('badges').select('*');
    return data || [];
}

async function getUserBadges(login) {
    const { data } = await _supabase.from('user_badges').select('badge_id, badges(*)').eq('user_login', login);
    return data || [];
}

async function assignBadge(userLogin, badgeId) { return { error: null }; }
async function removeBadge(userLogin, badgeId) { return { error: null }; }

async function updatePresence() {
    if (!currentUser) return;
    await _supabase.from('user_presence').upsert({ login: currentUser.login, last_seen: new Date().toISOString() }, { onConflict: 'login' });
}
setInterval(updatePresence, 30000);
if (currentUser) updatePresence();

async function isUserOnline(login) {
    const { data } = await _supabase.from('user_presence').select('last_seen').eq('login', login).maybeSingle();
    if (!data) return false;
    return Date.now() - new Date(data.last_seen).getTime() < 120000;
}

// Система друзей полностью удалена. Чаты работают со всеми пользователями.
