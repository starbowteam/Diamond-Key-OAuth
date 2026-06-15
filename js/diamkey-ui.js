function updateHeroButton() {
    const btn = document.getElementById('heroActionBtn');
    if (!btn) return;
    if (currentUser) {
        btn.innerHTML = '<i class="fas fa-user"></i> Мой профиль';
        btn.onclick = () => { navigateTo('/profile'); };
    } else {
        btn.innerHTML = '<i class="fas fa-user-plus"></i> Создать DiamKey';
        btn.onclick = () => {
            const modal = document.getElementById('loginModal');
            if (modal) { modal.style.display = 'flex'; modal.classList.add('active'); }
        };
    }
}

function loadHomeData() {
    updateHeroButton();
    loadAnnouncement();
    loadGlobalStats();
}

document.getElementById('doLoginBtn').addEventListener('click', async () => {
    const res = await login(document.getElementById('loginIdentity').value.trim(), document.getElementById('loginPassword').value);
    if (res.error) return showToast(res.error);
    closeModal('loginModal');
    window.location.href = '/';
});
document.getElementById('doRegisterBtn').addEventListener('click', async () => {
    const res = await register(document.getElementById('loginIdentity').value.trim(), document.getElementById('loginPassword').value);
    if (res.error) return showToast(res.error);
    closeModal('loginModal');
    window.location.href = '/';
});
