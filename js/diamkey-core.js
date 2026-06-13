const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ3dyb2twaXplZWxmcmptZ29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTAyMDksImV4cCI6MjA5MjcyNjIwOX0.qtFCGBnpwdQbtmpwSZxI_hH3arq4HBAw62vs5h8WmAk';
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[m] || m); }
function showToast(msg) {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

const saved = localStorage.getItem('diamkey_current');
if (saved) try { currentUser = JSON.parse(saved); } catch(e) {}

async function login(login, password) {
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error || !user) return { error: 'Неверный логин или пароль' };
    const session = { login: user.login, email: user.email, name: user.name||'', avatar: user.avatar||'', description: user.description||'', created_at: user.created_at };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
    return { success: true };
}

async function register(login, password) {
    if (password.length < 6) return { error: 'Пароль минимум 6 символов' };
    const { data: exist } = await _supabase.from('users').select('login').eq('login', login).maybeSingle();
    if (exist) return { error: 'Логин уже занят' };
    const email = login + '@diamkey.local';
    const { error } = await _supabase.from('users').insert([{ login, email, password, name: '', avatar: '', description: '' }]);
    if (error) return { error: error.message };
    const session = { login, email, name: '', avatar: '', description: '', created_at: new Date().toISOString() };
    localStorage.setItem('diamkey_current', JSON.stringify(session));
    currentUser = session;
    return { success: true };
}

async function loadProfile() {
    if (!currentUser) return;
    const { data } = await _supabase.from('users').select('name, avatar, description, created_at').eq('login', currentUser.login).maybeSingle();
    if (data) { currentUser.name = data.name || currentUser.login; currentUser.avatar = data.avatar || ''; currentUser.description = data.description || ''; currentUser.created_at = data.created_at; }
}

async function updateProfile(updates) {
    if (!currentUser) return;
    await _supabase.from('users').update(updates).eq('login', currentUser.login);
    if (updates.name) currentUser.name = updates.name;
    if (updates.avatar) currentUser.avatar = updates.avatar;
    if (updates.description) currentUser.description = updates.description;
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('closing');
    setTimeout(() => { modal.style.display = 'none'; modal.classList.remove('active', 'closing'); }, 300);
}
