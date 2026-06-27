// ========== DIAMKEY QR LOGIN ==========
let qrPollingInterval = null;

// Генерируем тикет и показываем QR-код
async function startQrLogin() {
    // Создаём тикет
    const ticket = 'qr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { error } = await _supabase.from('qr_tickets').insert({ ticket, status: 'pending' });
    if (error) {
        showToast('Ошибка создания QR-тикета');
        return;
    }

    // Показываем модалку с QR-кодом
    showQrModal(ticket);
}

function showQrModal(ticket) {
    // Удаляем старую модалку, если есть
    const existing = document.getElementById('qrModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qrModal';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;z-index:1000;';
    
    const modal = document.createElement('div');
    modal.className = 'modal-content glass-panel';
    modal.style.cssText = 'max-width:400px;width:90%;text-align:center;padding:30px;';
    
    const url = `https://diamkey.ru/qr-accept.html?ticket=${ticket}`;
    
    // Создаём холст для QR-кода
    modal.innerHTML = `
        <div style="display:flex;justify-content:center;margin-bottom:20px;">
            <canvas id="qrCanvas" width="220" height="220"></canvas>
        </div>
        <h3 style="margin-bottom:12px;">Вход через QR</h3>
        <p class="text-muted">Сканируйте код через камеру телефона</p>
        <p class="text-muted" style="font-size:13px;margin-top:8px;">Или откройте ссылку на телефоне</p>
        <button class="btn" onclick="document.getElementById('qrModal').remove(); clearInterval(qrPollingInterval);">Отмена</button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Генерируем QR-код с помощью библиотеки qrcode (должна быть загружена в index.html)
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCanvas'), {
            text: url,
            width: 220,
            height: 220,
            colorDark: '#0a0a0f',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        // Запасной вариант – рисуем текстовую заглушку
        const canvas = document.getElementById('qrCanvas');
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0,0,220,220);
        ctx.fillStyle = 'black';
        ctx.font = '12px monospace';
        ctx.fillText(url, 10, 110);
    }
    
    // Начинаем опрос статуса тикета
    qrPollingInterval = setInterval(async () => {
        const { data } = await _supabase.from('qr_tickets').select('status, login').eq('ticket', ticket).maybeSingle();
        if (!data) return;
        if (data.status === 'accepted') {
            clearInterval(qrPollingInterval);
            document.getElementById('qrModal').remove();
            // Автоматически логиним пользователя, чей логин указан в тикете
            const { data: user } = await _supabase.from('users').select('*').eq('login', data.login).maybeSingle();
            if (user) {
                currentUser = {
                    login: user.login,
                    email: user.email,
                    name: user.name||'',
                    avatar: user.avatar||'',
                    description: user.description||'',
                    created_at: user.created_at
                };
                localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
                showToast('Вход выполнен!');
                navigateTo('/home');
            }
        } else if (data.status === 'rejected') {
            clearInterval(qrPollingInterval);
            document.getElementById('qrModal').remove();
            showToast('Вход отклонён');
        }
    }, 2000);
}
