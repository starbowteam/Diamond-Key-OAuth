let qrPollingInterval = null;
let qrGenerated = false;

function drawRoundedQR(dataUrl, size) {
    // Создаём временный canvas, чтобы извлечь изображение QR
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');
    const img = new Image();
    img.src = dataUrl;
    return new Promise((resolve) => {
        img.onload = () => {
            tempCtx.drawImage(img, 0, 0, size, size);
            const imageData = tempCtx.getImageData(0, 0, size, size);
            const data = imageData.data;
            const moduleCount = Math.floor(size / 8); // примерно определяем размер модуля, QR статичен
            const moduleSize = size / moduleCount;
            const radius = moduleSize * 0.25;

            // Создаём новый canvas для закруглённого QR
            const roundedCanvas = document.createElement('canvas');
            roundedCanvas.width = size;
            roundedCanvas.height = size;
            const ctx = roundedCanvas.getContext('2d');
            ctx.clearRect(0, 0, size, size);

            // Проходим по пикселям с шагом moduleSize, чтобы найти тёмные модули
            for (let y = 0; y < size; y += moduleSize) {
                for (let x = 0; x < size; x += moduleSize) {
                    // Проверяем центральный пиксель модуля
                    const pixelIndex = (Math.floor(y + moduleSize/2) * size + Math.floor(x + moduleSize/2)) * 4;
                    const r = data[pixelIndex];
                    const g = data[pixelIndex + 1];
                    const b = data[pixelIndex + 2];
                    // Белые модули – те, где цвет светлый (в нашем случае тёмный = чёрный? Мы инвертировали: фон прозрачный, модули белые)
                    // Но библиотека рисует чёрные модули. Мы ищем чёрные (r < 128).
                    if (r < 128 && g < 128 && b < 128) {
                        // Рисуем скруглённый квадрат белого цвета
                        ctx.fillStyle = '#ffffff';
                        ctx.beginPath();
                        ctx.moveTo(x + radius, y);
                        ctx.lineTo(x + moduleSize - radius, y);
                        ctx.quadraticCurveTo(x + moduleSize, y, x + moduleSize, y + radius);
                        ctx.lineTo(x + moduleSize, y + moduleSize - radius);
                        ctx.quadraticCurveTo(x + moduleSize, y + moduleSize, x + moduleSize - radius, y + moduleSize);
                        ctx.lineTo(x + radius, y + moduleSize);
                        ctx.quadraticCurveTo(x, y + moduleSize, x, y + moduleSize - radius);
                        ctx.lineTo(x, y + radius);
                        ctx.quadraticCurveTo(x, y, x + radius, y);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
            resolve(roundedCanvas.toDataURL());
        };
    });
}

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

    // Создаём временный canvas для стандартной генерации
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);
    const tempCanvasId = 'tempQrCanvas';
    tempContainer.innerHTML = `<div id="${tempCanvasId}"></div>`;

    if (typeof QRCode !== 'undefined') {
        const qr = new QRCode(document.getElementById(tempCanvasId), {
            text: url,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });

        // Ждём немного, пока QR отрисуется
        await new Promise(resolve => setTimeout(resolve, 100));

        const originalCanvas = document.querySelector(`#${tempCanvasId} canvas`);
        if (originalCanvas) {
            const dataUrl = originalCanvas.toDataURL();
            const roundedDataUrl = await drawRoundedQR(dataUrl, 200);
            container.innerHTML = `
                <div class="qr-rounded-wrapper">
                    <img src="${roundedDataUrl}" style="width:200px;height:200px;display:block;border-radius:24px;" />
                </div>
                <p class="text-muted" style="margin-top:12px;">Действует 10 минут</p>
            `;
        } else {
            container.innerHTML = '<p class="text-muted">Не удалось создать QR</p>';
        }
        tempContainer.remove();
    } else {
        container.innerHTML = '<p class="text-muted">Библиотека QR не загружена</p>';
        return;
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
