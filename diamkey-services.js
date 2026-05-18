// ==================== DIAMKEY SERVICES — статусы сервисов, уведомления, веб-пуши ====================

// Загрузка и отображение статусов сервисов
async function loadServicesStatus() {
  const container = document.getElementById('servicesContainer');
  if (!container) return;
  
  const { data: services, error } = await _supabase
    .from('service_health')
    .select('*')
    .order('service_name', { ascending: true });
    
  if (error) {
    console.warn('Ошибка загрузки статусов:', error);
    container.innerHTML = '<p class="text-muted">Не удалось загрузить статусы сервисов</p>';
    return;
  }
  
  if (!services || services.length === 0) {
    container.innerHTML = '<p class="text-muted">Нет данных о сервисах</p>';
    return;
  }
  
  container.innerHTML = services.map(service => {
    const statusIcon = service.status === 'online' ? 'fa-check-circle' : 
                      service.status === 'maintenance' ? 'fa-wrench' : 'fa-times-circle';
    const statusColor = service.status === 'online' ? 'var(--accent-blue)' : 
                       service.status === 'maintenance' ? '#f0c060' : '#c0392b';
    const statusText = service.status === 'online' ? 'Онлайн' : 
                      service.status === 'maintenance' ? 'Обслуживание' : 'Офлайн';
    
    return `
      <div class="card service-status-card">
        <div class="service-status-header">
          <i class="fas ${statusIcon}" style="color: ${statusColor}; font-size: 1.5rem;"></i>
          <h3>${escapeHtml(service.service_name)}</h3>
          <span class="status-badge" style="background: ${statusColor}20; color: ${statusColor};">${statusText}</span>
        </div>
        <div class="service-status-details">
          ${service.users_count ? `<span><i class="fas fa-users"></i> ${service.users_count} пользователей</span>` : ''}
          ${service.ping_ms ? `<span><i class="fas fa-clock"></i> ${service.ping_ms} мс</span>` : ''}
        </div>
        ${service.details ? `<p class="service-details">${escapeHtml(service.details)}</p>` : ''}
        ${service.last_ping ? `<small class="text-muted">Последняя проверка: ${new Date(service.last_ping).toLocaleString()}</small>` : ''}
      </div>
    `;
  }).join('');
}

// Загрузка уведомлений
async function loadNotifications() {
  if (!currentUser) return;
  const container = document.getElementById('notificationsContainer');
  if (!container) return;
  
  const { data: notifications, error } = await _supabase
    .from('notifications')
    .select('*')
    .eq('user_login', currentUser.login)
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    console.warn('Ошибка загрузки уведомлений:', error);
    return;
  }
  
  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<p class="text-muted">Нет уведомлений</p>';
    return;
  }
  
  container.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
      <div class="notification-content">
        <p>${escapeHtml(n.message)}</p>
        <small class="text-muted">${new Date(n.created_at).toLocaleString()}</small>
      </div>
      ${!n.read ? '<button class="btn btn-small mark-read-btn"><i class="fas fa-check"></i></button>' : ''}
    </div>
  `).join('');
  
  // Обработчики для отметки прочитанным
  container.querySelectorAll('.mark-read-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.notification-item');
      const id = item.dataset.id;
      await _supabase.from('notifications').update({ read: true }).eq('id', id);
      item.classList.add('read');
      btn.remove();
    });
  });
}

// Запрос разрешения на веб-пуши
async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Браузер не поддерживает веб-уведомления');
    return;
  }
  
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Разрешение на уведомления получено');
    // Здесь можно подписаться на push-уведомления через Service Worker
    subscribeToPushNotifications();
  } else {
    console.log('Разрешение на уведомления отклонено');
  }
}

// Базовая подписка на push-уведомления (заглушка для будущего расширения)
async function subscribeToPushNotifications() {
  if (!('serviceWorker' in navigator)) return;
  
  try {
    const registration = await navigator.serviceWorker.ready;
    // В будущем здесь будет подписка на push-сервер
    console.log('Service Worker готов для push-уведомлений');
  } catch (e) {
    console.warn('Ошибка подписки на push:', e);
  }
}

// Показать локальное уведомление (если разрешено)
function showLocalNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  new Notification(title, {
    body: body,
    icon: '/assets/KeyHold.png'
  });
}

// Подписка на Supabase Realtime для живых обновлений статусов
function subscribeToServiceUpdates() {
  const subscription = _supabase
    .channel('service-health-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'service_health' }, 
      (payload) => {
        console.log('Статус сервиса обновлён:', payload);
        loadServicesStatus(); // Перезагружаем статусы при изменениях
      }
    )
    .subscribe();
    
  return subscription;
}

// Подписка на новые уведомления в реальном времени
function subscribeToNotificationUpdates() {
  if (!currentUser) return;
  
  const subscription = _supabase
    .channel('notification-changes')
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_login=eq.${currentUser.login}`
      }, 
      (payload) => {
        console.log('Новое уведомление:', payload);
        loadNotifications(); // Обновляем список уведомлений
        // Показываем локальное уведомление, если разрешено
        showLocalNotification('DiamKey', payload.new.message);
      }
    )
    .subscribe();
    
  return subscription;
}

// Инициализация всех подписок при загрузке страницы
function initServices() {
  // Загружаем статусы при наличии контейнера
  if (document.getElementById('servicesContainer')) {
    loadServicesStatus();
  }
  
  // Загружаем уведомления при наличии контейнера
  if (document.getElementById('notificationsContainer') && currentUser) {
    loadNotifications();
  }
  
  // Подписываемся на обновления в реальном времени
  subscribeToServiceUpdates();
  if (currentUser) {
    subscribeToNotificationUpdates();
  }
  
  // Запрашиваем разрешение на уведомления (можно вызывать по кнопке)
  if (currentUser && !localStorage.getItem('notification_permission_asked')) {
    setTimeout(() => {
      requestNotificationPermission();
      localStorage.setItem('notification_permission_asked', 'true');
    }, 3000);
  }
}ы