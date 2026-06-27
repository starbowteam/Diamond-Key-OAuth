let qrPollingInterval = null;

async function startQrLogin() {
    const modal = document.getElementById('loginModal');
    if (!modal) return;

    // Показываем спиннер, пока генерируется тикет
    const qrContainer = document.getElementById('qrContainer');
    if (!qrContainer) return;
    qrContainer.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-circle-notch fa-spin"></i> Создание QR-кода...</div>';
    qrContainer.style.display = 'block';

    const ticket = 'qr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { error } = await _supabase.from('qr_tickets').insert({ ticket, status: 'pending' });
    if (error) {
        showToast('Ошибка создания QR-тикета');
        qrContainer.innerHTML = '';
        return;
    }

    // Генерируем QR-код
    const url = `https://diamkey.ru/qr-accept.html?ticket=${ticket}`;
    qrContainer.innerHTML = `
        <div class="qr-code-wrapper">
            <div id="qrCodeCanvas" style="display:flex; justify-content:center; margin-bottom:16px;"></div>
            <p class="text-muted" style="margin-bottom:16px;">Сканируйте код через камеру телефона</p>
            <p class="text-muted" style="font-size:13px; margin-bottom:8px;">Или откройте ссылку на телефоне</p>
            <button class="btn btn-secondary" id="cancelQrBtn" style="width:100%;">Отмена</button>
        </div>
    `;

    // Рисуем QR-код с помощью библиотеки QRCode (подключена в index.html)
    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCodeCanvas'), {
            text: url,
            width: 200,
            height: 200,
            colorDark: '#0a0a0f',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        document.getElementById('qrCodeCanvas').innerHTML = '<canvas id="qrFallback" width="200" height="200"></canvas>';
        const canvas = document.getElementById('qrFallback');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0,0,200,200);
            ctx.fillStyle = 'black';
            ctx.font = '12px monospace';
            ctx.fillText(url, 10, 100);
        }
    }

    document.getElementById('cancelQrBtn').addEventListener('click', () => {
        clearInterval(qrPollingInterval);
        qrContainer.innerHTML = '';
        qrContainer.style.display = 'none';
    });

    // Опрос статуса тикета
    qrPollingInterval = setInterval(async () => {
        const { data } = await _supabase.from('qr_tickets').select('status, login').eq('ticket', ticket).maybeSingle();
        if (!data) return;
        if (data.status === 'accepted') {
            clearInterval(qrPollingInterval);
            closeModal('loginModal');
            qrContainer.innerHTML = '';
            qrContainer.style.display = 'none';
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
                smoothLoginSuccess();
            }
        } else if (data.status === 'rejected') {
            clearInterval(qrPollingInterval);
            qrContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Вход отклонён. Попробуйте снова.</p>';
            setTimeout(() => {
                qrContainer.innerHTML = '';
                qrContainer.style.display = 'none';
            }, 3000);
        }
    }, 2000);
}
