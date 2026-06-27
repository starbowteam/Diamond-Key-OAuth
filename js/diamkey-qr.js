let qrPollingInterval = null;
let qrGenerated = false;

async function generateQrInModal() {
    const container = document.getElementById('qrContainer');
    if (!container || qrGenerated) return;

    container.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-circle-notch fa-spin"></i></div>';
    container.style.display = 'block';

    const ticket = 'qr_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    const { error } = await _supabase.from('qr_tickets').insert({ ticket, status: 'pending' });
    if (error) {
        container.innerHTML = '<p class="text-muted">Ошибка создания тикета</p>';
        return;
    }

    const url = `https://diamkey.ru/qr-confirm?ticket=${ticket}`;

    container.innerHTML = `
        <div class="qr-rounded-wrapper">
            <div id="qrCodeCanvas" style="display:flex; justify-content:center;"></div>
        </div>
        <p class="text-muted" style="margin-top:12px;">Действует 10 минут</p>
    `;

    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('qrCodeCanvas'), {
            text: url,
            width: 200,
            height: 200,
            colorDark: '#ffffff',
            colorLight: 'transparent',
            correctLevel: QRCode.CorrectLevel.M
        });
    } else {
        document.getElementById('qrCodeCanvas').innerHTML = '<canvas id="qrFallback" width="200" height="200"></canvas>';
        const canvas = document.getElementById('qrFallback');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, 200, 200);
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            ctx.fillText(url, 10, 100);
        }
    }

    qrPollingInterval = setInterval(async () => {
        const { data } = await _supabase.from('qr_tickets').select('status, login').eq('ticket', ticket).maybeSingle();
        if (!data) return;
        if (data.status === 'accepted') {
            clearInterval(qrPollingInterval);
            closeModal('loginModal');
            container.innerHTML = '';
            container.style.display = 'none';
            qrGenerated = false;
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
            container.innerHTML = '<p class="text-muted" style="text-align:center;">Вход отклонён</p>';
            setTimeout(() => {
                container.innerHTML = '';
                container.style.display = 'none';
                qrGenerated = false;
            }, 3000);
        }
    }, 2000);

    qrGenerated = true;
}
