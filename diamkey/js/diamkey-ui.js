// ==================== DIAMKEY UI – навигация и инициализация ====================
document.addEventListener('DOMContentLoaded', () => {
    // Сайдбар
    document.querySelectorAll('.sidebar-icon').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (btn.tagName === 'A') return; // ссылка на Diamond AI
            e.preventDefault();
            document.querySelectorAll('.sidebar-icon').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const page = btn.dataset.page;
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${page}`).classList.add('active');
        });
    });

    // Если не авторизован – показать модалку
    if (!currentUser) {
        showAuthModal();
        return;
    }

    // Загружаем профиль и стартовые данные
    loadProfile().then(() => {
        renderWall();
        loadTopics();
        initGPX();
        renderProfile();
    });
});