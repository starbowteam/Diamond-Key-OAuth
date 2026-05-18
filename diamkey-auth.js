
async function login(login, password) {
  if (!login || !password) return showToast(t('errorLogin'), 'error');
  try {
    const { data: user, error } = await _supabase.from('users').select('*').eq('login', login).eq('password', password).maybeSingle();
    if (error || !user) { showToast(t('errorLogin'), 'error'); return; }
    if (!user.secret_word) {
      const secretWord = generateFastSecret();
      await _supabase.from('users').update({ secret_word: secretWord }).eq('login', user.login);
      user.secret_word = secretWord;
    }
    currentUser = {
      login: user.login,
      email: user.email || (user.login + '@diamkey.local'),
      secretWord: user.secret_word,
      name: user.name || '',
      avatar: user.avatar || '',
      description: user.description || '',
      fa_icon: user.fa_icon || '',
      role: user.role || 'user',
      cover_image: user.cover_image || '',
      status_text: user.status_text || '',
      trust_level: user.trust_level || 0,
      avatar_frame: user.avatar_frame || 'default',
      nickname_effect: user.nickname_effect || 'none',
      card_background: user.card_background || 'default',
      subscription_tier: user.subscription_tier || 'free',
      subscription_expires: user.subscription_expires || null,
      ip_address: user.ip_address || ''
    };
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
    updateAuthUI();
    navigate('/profile');
    showToast('Добро пожаловать, ' + currentUser.login, 'success');
  } catch (e) {
    console.error(e);
    showToast(t('errorNetwork'), 'error');
  }
}

async function register(login, password) {
  if (!login || password.length < 6) return showToast(t('errorRegister'), 'error');
  try {
    const { data: exist } = await _supabase.from('users').select('login').eq('login', login).maybeSingle();
    if (exist) { showToast('Логин уже занят', 'error'); return; }
    const secretWord = generateFastSecret();
    const token = generateToken();
    const email = login + '@diamkey.local';
    const { error } = await _supabase.from('users').insert([{
      login, email, password, token, secret_word: secretWord,
      name: '', avatar: '', description: '', fa_icon: '', role: 'user',
      cover_image: '', status_text: '', trust_level: 0,
      avatar_frame: 'default', nickname_effect: 'none',
      card_background: 'default', subscription_tier: 'free'
    }]);
    if (error) { showToast(t('errorRegister') + ': ' + error.message, 'error'); return; }
    currentUser = {
      login, email, secretWord, name: '', avatar: '', description: '', fa_icon: '',
      role: 'user', cover_image: '', status_text: '', trust_level: 0,
      avatar_frame: 'default', nickname_effect: 'none',
      card_background: 'default', subscription_tier: 'free',
      subscription_expires: null, ip_address: ''
    };
    localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
    updateAuthUI();
    navigate('/profile');
    showToast('Аккаунт создан!', 'success');
  } catch (e) {
    console.error(e);
    showToast(t('errorNetwork'), 'error');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('diamkey_current');
  updateAuthUI();
  navigate('/');
}

function updateAuthUI() {
  const authLink = document.getElementById('authLink');
  if (!authLink) return;
  if (currentUser) {
    authLink.innerHTML = `<i class="fas fa-sign-out-alt"></i> Выйти`;
    authLink.href = '#';
    authLink.onclick = (e) => { e.preventDefault(); logout(); };
  } else {
    authLink.innerHTML = `<i class="fas fa-sign-in-alt"></i> Войти`;
    authLink.href = '/';
    authLink.onclick = null;
  }
}