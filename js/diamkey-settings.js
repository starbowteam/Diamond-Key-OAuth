function loadSettings() {
    if (!currentUser) return;
    document.getElementById('settingsName').value = currentUser.name || '';
    document.getElementById('settingsLanguage').value = localStorage.getItem('diamkey_lang') || 'ru';
}

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const name = document.getElementById('settingsName').value.trim();
    const password = document.getElementById('settingsPassword').value;
    const file = document.getElementById('settingsAvatar').files[0];
    const lang = document.getElementById('settingsLanguage').value;

    const updates = {};
    if (name) updates.name = name;
    if (password) updates.password = password;
    if (file) {
        const reader = new FileReader();
        const avatar = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
        updates.avatar = avatar;
    }
    await updateProfile(updates);
    localStorage.setItem('diamkey_lang', lang);
    showToast('Настройки сохранены');
    loadProfile().then(() => renderProfile());
});

document.getElementById('deleteAccountBtn').addEventListener('click', () => {
    document.getElementById('deleteAccountModal').style.display = 'flex';
});
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    await deleteAccount();
    document.getElementById('deleteAccountModal').style.display = 'none';
});
