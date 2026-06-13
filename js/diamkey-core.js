const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ3dyb2twaXplZWxmcmptZ29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTAyMDksImV4cCI6MjA5MjcyNjIwOX0.qtFCGBnpwdQbtmpwSZxI_hH3arq4HBAw62vs5h8WmAk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[m] || m); }
function showToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#222; color:#fff; padding:12px 20px; border-radius:12px; z-index:9999;'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); }

const saved = localStorage.getItem('diamkey_current');
if (saved) try { currentUser = JSON.parse(saved); } catch(e) {}

async function login(login, password) {
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error || !user) return { error: 'Неверный логин или пароль' };
    const sessionUser = { login: user.login, email: user.email, name: user.name||'', avatar: user.avatar||'', description: user.description||'' };
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

async function loadProfile() {
    if (!currentUser) return null;
    const { data } = await _supabase.from('users').select('name, avatar, description').eq('login', currentUser.login).maybeSingle();
    if (data) { currentUser.name = data.name || currentUser.login; currentUser.avatar = data.avatar || ''; currentUser.description = data.description || ''; }
    return currentUser;
}

async function updateProfile(updates) {
    if (!currentUser) return;
    await _supabase.from('users').update(updates).eq('login', currentUser.login);
    if (updates.name) currentUser.name = updates.name;
    if (updates.avatar) currentUser.avatar = updates.avatar;
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
}

async function deleteAccount() {
    if (!currentUser) return;
    await _supabase.from('users').delete().eq('login', currentUser.login);
    localStorage.removeItem('diamkey_current');
    currentUser = null;
    window.location.reload();
}

function redirectToOAuth() {
    const redirect = encodeURIComponent('https://diam-ai.ru');
    window.location.href = `https://diamkey.ru/oauth.html?redirect=${redirect}&app=Diamond+AI`;
}
