// ==================== DIAMKEY SUBSCRIPTION — Diamond Plus ====================

async function renderSubscriptionPage() {
  const page = document.getElementById('pageContent');
  if (!page) return;

  page.innerHTML = `
    <div class="subscription-hero">
      <h1><i class="fas fa-gem"></i> Diamond Plus</h1>
      <p>Подписка для тех, кто хочет больше от Diamond AI</p>
    </div>
    <div class="subscription-details card">
      <h2>350 ₽ / месяц</h2>
      <ul>
        <li><i class="fas fa-check-circle"></i> Более точные ответы ИИ</li>
        <li><i class="fas fa-check-circle"></i> Общение без границ</li>
        <li><i class="fas fa-check-circle"></i> Меньше правил и запретов</li>
        <li><i class="fas fa-check-circle"></i> Эксклюзивные бейджи и оформление профиля</li>
        <li><i class="fas fa-check-circle"></i> Приоритетная поддержка</li>
      </ul>
      ${currentUser ? `
        <button class="btn btn-primary" id="subscribeBtn"><i class="fas fa-crown"></i> Оформить подписку</button>
      ` : '<p>Войдите в аккаунт, чтобы оформить подписку</p>'}
      <div id="subscribeForm" style="display:none; margin-top:20px;">
        <p>Оставьте заявку, и я свяжусь с вами для обсуждения деталей.</p>
        <textarea id="subscribeMessage" placeholder="Ваши пожелания..."></textarea>
        <button class="btn" id="submitSubscribe">Отправить заявку</button>
      </div>
    </div>
  `;

  if (currentUser) {
    document.getElementById('subscribeBtn').addEventListener('click', () => {
      document.getElementById('subscribeForm').style.display = 'block';
    });
    document.getElementById('submitSubscribe').addEventListener('click', async () => {
      const msg = document.getElementById('subscribeMessage').value.trim();
      if (!msg) return showToast('Напишите сообщение');
      const { error } = await _supabase.from('purchase_discussions').insert([{
        user_login: currentUser.login,
        status: 'pending'
      }]);
      if (error) { showToast('Ошибка, попробуйте позже', 'error'); return; }
      showToast('Заявка отправлена! Я свяжусь с вами.', 'success');
    });
  }
}