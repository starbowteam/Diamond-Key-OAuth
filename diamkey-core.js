
const SUPABASE_URL = 'https://pqgwrokpizeelfrjmgoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZ3dyb2twaXplZWxmcmptZ29jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTAyMDksImV4cCI6MjA5MjcyNjIwOX0.qtFCGBnpwdQbtmpwSZxI_hH3arq4HBAw62vs5h8WmAk';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentPage = 'home';

const locales = {
  ru: {
    welcome: 'Добро пожаловать в DiamKey',
    login: 'Вход',
    register: 'Регистрация',
    profile: 'Профиль',
    subscription: 'Diamond Plus',
    docs: 'Мои документы',
    admin: 'Админка',
    logout: 'Выйти',
    save: 'Сохранить',
    cancel: 'Отмена',
    send: 'Отправить',
    back: 'Назад',
    errorNetwork: 'Ошибка сети',
    errorLogin: 'Неверный логин или пароль',
    errorRegister: 'Ошибка регистрации',
    loginPlaceholder: 'Логин',
    passwordPlaceholder: 'Пароль',
    newChat: 'Новый чат',
    search: 'Поиск...',
    noResults: 'Ничего не найдено',
    today: 'Сегодня',
    yesterday: 'Вчера',
    older: 'Давно',

  },
  en: {
    welcome: 'Welcome to DiamKey',
    login: 'Login',
    register: 'Register',
    profile: 'Profile',
    subscription: 'Diamond Plus',
    docs: 'My Documents',
    admin: 'Admin',
    logout: 'Logout',
    save: 'Save',
    cancel: 'Cancel',
    send: 'Send',
    back: 'Back',
    errorNetwork: 'Network error',
    errorLogin: 'Invalid login or password',
    errorRegister: 'Registration error',
    loginPlaceholder: 'Login',
    passwordPlaceholder: 'Password',
    search: 'Search...',
    noResults: 'Nothing found',
    today: 'Today',
    yesterday: 'Yesterday',
    older: 'Older'
  }
};

let currentLang = 'ru';
function t(key) { return (locales[currentLang]?.[key] || key); }

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;' })[m] || m);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.borderLeftColor = type === 'error' ? '#c0392b' : type === 'success' ? '#4a4a4a' : '#a8a8b3';
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function generateFastSecret() {
  return Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15);
}

function generateToken() {
  const adj = ['golden','silver','mystic','shadow','prime','crystal','onyx','brave','frost'];
  const nouns = ['falcon','tiger','phoenix','dragon','wolf','spark','nexus','core','vault','key'];
  return `diamkey_${adj[Math.floor(Math.random()*adj.length)]}_${nouns[Math.floor(Math.random()*nouns.length)]}_${nouns[Math.floor(Math.random()*nouns.length)]}_${Math.floor(1000+Math.random()*9000)}`;
}

function getAvatarFrame(user) {
  if (user.subscription_tier === 'diamond_plus') return 'linear-gradient(135deg, #fff, #c0c0c0)';
  if (user.role === 'admin') return '#f0c060';
  if (user.role === 'staff') return '#a8a8b3';
  return 'transparent';
}