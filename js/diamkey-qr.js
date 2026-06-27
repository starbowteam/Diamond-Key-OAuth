let qrPollingInterval = null;
let qrGenerated = false;

function drawRoundedQR(dataUrl, size) {
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
            
            // Определяем количество модулей (стандартный QR 200x200 при коррекции M даёт около 25 модулей)
            const moduleCount = 25;
            const moduleSize = size / moduleCount;
            const radius = moduleSize * 0.25; // небольшое скругление

            const roundedCanvas = document.createElement('canvas');
            roundedCanvas.width = size;
            roundedCanvas.height = size;
            const ctx = roundedCanvas.getContext('2d');
            ctx.clearRect(0, 0, size, size);

            // Функция проверки, является ли модуль частью углового маркера
            const isFinderPattern = (row, col) => {
                // Верхний левый
                if (row < 7 && col < 7) return true;
                // Верхний правый
                if (row < 7 && col >= moduleCount - 7) return true;
                // Нижний левый
                if (row >= moduleCount - 7 && col < 7) return true;
                return false;
            };

            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    const centerX = Math.floor(col * moduleSize + moduleSize / 2);
                    const centerY = Math.floor(row * moduleSize + moduleSize / 2);
                    const pixelIndex = (centerY * size + centerX) * 4;
                    const r = data[pixelIndex];
                    const g = data[pixelIndex + 1];
                    const b = data[pixelIndex + 2];
                    
                    // Тёмный модуль (в оригинале чёрный)
                    if (r < 128 && g < 128 && b < 128) {
                        const x = col * moduleSize;
                        const y = row * moduleSize;
                        
                        ctx.fillStyle = '#ffffff';
                        if (isFinderPattern(row, col)) {
                            // Угловые маркеры – без скругления
                            ctx.fillRect(x, y, moduleSize, moduleSize);
                        } else {
                            // Обычные модули – со скруглением
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

    // Генерируем обычный QR во временном контейнере
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    document.body.appendChild(tempContainer);
    tempContainer.innerHTML = '<div id="tempQrCanvas"></div>';

    if (typeof QRCode !== 'undefined') {
        new QRCode(document.getElementById('tempQrCanvas'), {
            text: url,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
        await new Promise(resolve => setTimeout(resolve, 200));
        const canvas = document.querySelector('#tempQrCanvas canvas');
        if (canvas) {
            const dataUrl = canvas.toDataURL();
            const roundedUrl = await drawRoundedQR(dataUrl, 200);
            container.innerHTML = `
                <div class="qr-rounded-wrapper">
                    <img src="${roundedUrl}" style="width:200px; height:200px; border-radius:24px; background:transparent;" />
                </div>
                <p class="text-muted" style="margin-top:12px;">Действует 10 минут</p>
            `;
        } else {
            container.innerHTML = '<p class="text-muted">Ошибка генерации</p>';
        }
        tempContainer.remove();
    } else {
        container.innerHTML = '<p class="text-muted">Библиотека QR не загружена</p>';
        return;
    }

    // Опрос статуса тикета
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
                    login: user.login, email: user.email, name: user.name||'',
                    avatar: user.avatar||'', description: user.description||'',
                    created_at: user.created_at
                };
                localStorage.setItem('diamkey_current', JSON.stringify(currentUser));
                smoothLoginSuccess();
            }
        } else if (data.status === 'rejected') {
            clearInterval(qrPollingInterval);
            container.innerHTML = '<p class="text-muted" style="text-align:center;">Вход отклонён</p>';
            setTimeout(() => { container.innerHTML = ''; container.style.display = 'none'; qrGenerated = false; }, 3000);
        }
    }, 2000);
    qrGenerated = true;
}
